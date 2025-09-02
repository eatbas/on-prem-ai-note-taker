use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Arc, time::{Duration}};
use tokio::{sync::Mutex, time::sleep};
use anyhow::{Result, anyhow};
use uuid::Uuid;
use tauri::{Emitter, Manager};

use crate::multi_audio::{MultiSourceAudioCapture, MultiAudioConfig, AudioSource, AudioSourceType};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChunkEvent {
    pub session_id: String,
    pub index: u64,
    pub path: String,
    pub start_ms: u128,
    pub end_ms: u128,
    pub duration_ms: u128,
    pub bytes: u64,
    pub kind: String, // mic | system | mix
}

pub struct AudioChunker {
    app_handle: Option<tauri::AppHandle>,
    capture: Arc<MultiSourceAudioCapture>,
    session_id: Option<String>,
    session_dir: Option<PathBuf>,
    chunk_secs: u64,
    sample_rate: u32,
    active_sources: Vec<String>,
    kind: Option<String>,
    start_instant_ms: u128,
    chunk_index: u64,
    emit_separate: bool,
}

impl AudioChunker {
    pub fn new(sample_rate: u32, chunk_secs: u64) -> Self {
        let config = MultiAudioConfig {
            sample_rate,
            channels: 1,
            buffer_size: 1024,
            max_sources: 4,
            mix_output: true,
        };
        Self {
            app_handle: None,
            capture: Arc::new(MultiSourceAudioCapture::new(config)),
            session_id: None,
            session_dir: None,
            chunk_secs,
            sample_rate,
            active_sources: Vec::new(),
            kind: None,
            start_instant_ms: 0,
            chunk_index: 0,
            emit_separate: false,
        }
    }

    pub fn set_app_handle(&mut self, handle: tauri::AppHandle) {
        self.app_handle = Some(handle);
    }

    pub async fn get_devices(&self) -> Result<Vec<AudioSource>> {
        self.capture.discover_sources().await
    }

    pub async fn start_mic(&mut self) -> Result<String> {
        let sources = self.capture.discover_sources().await?;
        let mic = sources.into_iter().find(|s| s.device_type == AudioSourceType::Microphone)
            .ok_or_else(|| anyhow!("No microphone source found"))?;
        self.start_session(vec![mic.id], "mic").await
    }

    pub async fn start_system(&mut self) -> Result<String> {
        let sources = self.capture.discover_sources().await?;
        let sys = sources.into_iter().find(|s| s.device_type == AudioSourceType::SystemAudio)
            .ok_or_else(|| anyhow!("No system audio source found"))?;
        self.start_session(vec![sys.id], "system").await
    }

    pub async fn start_mix(&mut self) -> Result<String> {
        let sources = self.capture.discover_sources().await?;
        let mut ids = Vec::new();
        if let Some(mic) = sources.iter().find(|s| s.device_type == AudioSourceType::Microphone) {
            ids.push(mic.id.clone());
        }
        if let Some(sys) = sources.iter().find(|s| s.device_type == AudioSourceType::SystemAudio) {
            ids.push(sys.id.clone());
        }
        if ids.is_empty() {
            return Err(anyhow!("No available sources for mix"));
        }
        self.start_session(ids, "mix").await
    }

    pub async fn stop_all(&mut self) -> Result<()> {
        let _ = self.capture.stop_recording().await;
        self.active_sources.clear();
        self.kind = None;
        self.session_id = None;
        self.session_dir = None;
        self.start_instant_ms = 0;
        self.chunk_index = 0;
        Ok(())
    }

    async fn start_session(&mut self, source_ids: Vec<String>, kind: &str) -> Result<String> {
        let _ = self.stop_all().await;

        let session_id = Uuid::new_v4().to_string();
        let dir = self.resolve_session_dir(&session_id)?;
        std::fs::create_dir_all(&dir)?;

        self.capture.start_multi_recording(source_ids.clone()).await?;

        self.start_instant_ms = chrono::Utc::now().timestamp_millis() as u128;
        self.chunk_index = 0;
        let app = self.app_handle.clone();
        let capture = Arc::clone(&self.capture);
        let session_dir = dir.clone();
        let session_id_clone = session_id.clone();
        let chunk_secs = self.chunk_secs;
        let sample_rate = self.sample_rate;
        let src_ids = source_ids.clone();
        let kind_string = kind.to_string();
        let emit_separate_flag = self.emit_separate;

        tokio::spawn(async move {
            let mut accumulated: Vec<f32> = Vec::new();
            let target_samples: usize = (sample_rate as usize) * (chunk_secs as usize);
            let mut index: u64 = 0;
            loop {
                sleep(Duration::from_millis(200)).await;

                let mut new_samples: Vec<f32> = if src_ids.len() > 1 {
                    capture.get_mixed_audio(Some(target_samples / 5)).await
                } else {
                    capture.get_source_audio(&src_ids[0], Some(target_samples / 5)).await
                };

                if new_samples.is_empty() {
                    continue;
                }

                accumulated.append(&mut new_samples);
                if accumulated.len() >= target_samples {
                    let chunk: Vec<f32> = accumulated.drain(0..target_samples).collect();
                    index += 1;
                    let path = session_dir.join(format!("chunk_{:04}.wav", index as usize));
                    if let Err(e) = write_wav_chunk(&path, sample_rate, &chunk) { 
                        eprintln!("Failed to write wav chunk: {}", e);
                        continue;
                    }
                    if let Some(ref handle) = app {
                        let meta = ChunkEvent {
                            session_id: session_id_clone.clone(),
                            index,
                            path: path.to_string_lossy().to_string(),
                            start_ms: (index as u128 - 1) * (chunk_secs as u128) * 1000,
                            end_ms: (index as u128) * (chunk_secs as u128) * 1000,
                            duration_ms: (chunk_secs as u128) * 1000,
                            bytes: std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0),
                            kind: kind_string.clone(),
                        };
                        // Emit to frontend
                        let _ = handle.emit("audio:chunk", meta.clone());
                        // Also forward to coordinator server-side
                        if let Some(state_ref) = handle.try_state::<std::sync::Arc<tokio::sync::Mutex<crate::coordinator::Coordinator>>>() {
                            let coord_state = state_ref.inner().clone();
                            let meta_for_bg = meta.clone();
                            tauri::async_runtime::spawn(async move {
                                let coordinator = coord_state.lock().await;
                                coordinator.handle_chunk(&meta_for_bg.session_id, &meta_for_bg.path, meta_for_bg.start_ms, meta_for_bg.end_ms).await;
                            });
                        }

                        // Optionally emit separate mic/system chunks if available
                        if emit_separate_flag && src_ids.len() > 1 {
                            let mic_buf = capture.get_source_audio(&src_ids[0], Some(target_samples / 5)).await;
                            let sys_buf = capture.get_source_audio(&src_ids[1], Some(target_samples / 5)).await;
                            if !mic_buf.is_empty() {
                                let mic_path = session_dir.join(format!("chunk_{:04}_mic.wav", index as usize));
                                let _ = write_wav_chunk(&mic_path, sample_rate, &mic_buf);
                                let mut m = ChunkEvent { ..meta.clone() };
                                m.path = mic_path.to_string_lossy().to_string();
                                m.kind = "mic".to_string();
                                let _ = handle.emit("audio:chunk_mic", m);
                            }
                            if !sys_buf.is_empty() {
                                let sys_path = session_dir.join(format!("chunk_{:04}_sys.wav", index as usize));
                                let _ = write_wav_chunk(&sys_path, sample_rate, &sys_buf);
                                let mut m = ChunkEvent { ..meta.clone() };
                                m.path = sys_path.to_string_lossy().to_string();
                                m.kind = "system".to_string();
                                let _ = handle.emit("audio:chunk_sys", m);
                            }
                        }
                    }
                }
            }
        });

        self.session_id = Some(session_id.clone());
        self.session_dir = Some(dir);
        self.active_sources = source_ids;
        self.kind = Some(kind.to_string());

        Ok(session_id)
    }

    fn resolve_session_dir(&self, session_id: &str) -> Result<PathBuf> {
        let handle = self.app_handle.as_ref().ok_or_else(|| anyhow!("App handle not set"))?;
        let base = handle
            .path()
            .app_data_dir()
            .map_err(|e| anyhow!("Failed to get app_data_dir: {}", e))?;
        Ok(base.join("recordings").join(session_id))
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionInfo {
    pub session_id: Option<String>,
    pub session_dir: Option<String>,
}

#[tauri::command]
pub async fn ac_get_active_session_info(state: tauri::State<'_, Arc<Mutex<AudioChunker>>>) -> Result<SessionInfo, String> {
    let chunker = state.lock().await;
    Ok(SessionInfo {
        session_id: chunker.session_id.clone(),
        session_dir: chunker.session_dir.as_ref().map(|p| p.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub async fn ac_stop_and_finalize(
  state: tauri::State<'_, Arc<Mutex<AudioChunker>>>,
  coord_state: tauri::State<'_, Arc<tokio::sync::Mutex<crate::coordinator::Coordinator>>>
) -> Result<(), String> {
    // Grab session dir before stopping
    let session_dir = {
        let chunker = state.lock().await;
        chunker.session_dir.clone()
    };
    {
        let mut chunker = state.lock().await;
        let _ = chunker.stop_all().await;
    }
    if let Some(dir) = session_dir {
        let coordinator = coord_state.lock().await;
        coordinator.post_process(&dir.to_string_lossy()).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn ac_toggle_separate_emission(state: tauri::State<'_, Arc<Mutex<AudioChunker>>>, enabled: bool) -> Result<(), String> {
    let mut chunker = state.lock().await;
    chunker.emit_separate = enabled;
    Ok(())
}

fn write_wav_chunk(path: &PathBuf, sample_rate: u32, data: &[f32]) -> Result<()> {
    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(path, spec)?;
    for &sample in data {
        let s = (sample.max(-1.0).min(1.0) * i16::MAX as f32) as i16;
        writer.write_sample(s)?;
    }
    writer.finalize()?;
    Ok(())
}

#[tauri::command]
pub async fn ac_get_devices(state: tauri::State<'_, Arc<Mutex<AudioChunker>>>) -> Result<Vec<AudioSource>, String> {
    let chunker = state.lock().await;
    chunker.get_devices().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ac_start_mic(state: tauri::State<'_, Arc<Mutex<AudioChunker>>>) -> Result<String, String> {
    let mut chunker = state.lock().await;
    chunker.start_mic().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ac_start_system(state: tauri::State<'_, Arc<Mutex<AudioChunker>>>) -> Result<String, String> {
    let mut chunker = state.lock().await;
    chunker.start_system().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ac_start_mix(state: tauri::State<'_, Arc<Mutex<AudioChunker>>>) -> Result<String, String> {
    let mut chunker = state.lock().await;
    chunker.start_mix().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ac_stop_all(state: tauri::State<'_, Arc<Mutex<AudioChunker>>>) -> Result<(), String> {
    let mut chunker = state.lock().await;
    chunker.stop_all().await.map_err(|e| e.to_string())
}


