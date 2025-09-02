use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Arc, time::{Duration, Instant}};
use tokio::{sync::Mutex, task::JoinHandle, time::sleep};
use anyhow::{Result, anyhow};
use uuid::Uuid;

// Reuse the app's multi-audio capture engine for cross-platform inputs
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
    chunk_task: Option<JoinHandle<()>>,
    start_instant: Option<Instant>,
    chunk_index: u64,
}

impl AudioChunker {
    pub fn new(sample_rate: u32, chunk_secs: u64) -> Self {
        let config = MultiAudioConfig {
            sample_rate,
            channels: 1,           // mono for ASR
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
            chunk_task: None,
            start_instant: None,
            chunk_index: 0,
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
        if let Some(handle) = self.chunk_task.take() {
            handle.abort();
        }
        let _ = self.capture.stop_recording().await;
        self.active_sources.clear();
        self.kind = None;
        self.session_id = None;
        self.session_dir = None;
        self.start_instant = None;
        self.chunk_index = 0;
        Ok(())
    }

    async fn start_session(&mut self, source_ids: Vec<String>, kind: &str) -> Result<String> {
        // Stop any active session first
        let _ = self.stop_all().await;

        // Prepare session
        let session_id = Uuid::new_v4().to_string();
        let dir = self.resolve_session_dir(&session_id)?;
        std::fs::create_dir_all(&dir)?;

        // Start capture
        self.capture.start_multi_recording(source_ids.clone()).await?;

        // Launch chunking task
        let app = self.app_handle.clone();
        let capture = Arc::clone(&self.capture);
        let session_dir = dir.clone();
        let session_id_clone = session_id.clone();
        let chunk_secs = self.chunk_secs;
        let sample_rate = self.sample_rate;
        let src_ids = source_ids.clone();
        let kind_string = kind.to_string();

        self.start_instant = Some(Instant::now());
        self.chunk_index = 0;

        let task = tokio::spawn(async move {
            let mut accumulated: Vec<f32> = Vec::new();
            let target_samples: usize = (sample_rate as usize) * (chunk_secs as usize);
            loop {
                // Pull fresh audio every 200ms
                sleep(Duration::from_millis(200)).await;

                // Prefer mixed output if multiple sources, else take first source
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
                    // Take exactly target samples
                    let chunk: Vec<f32> = accumulated.drain(0..target_samples).collect();
                    let index = write_wav_chunk(&session_dir, sample_rate, &chunk)
                        .unwrap_or_else(|_| 0);

                    if let Some(ref handle) = app {
                        let now = Instant::now();
                        let start_ms = 0u128; // relative timing can be refined later
                        let end_ms = ((index as u128) * (chunk_secs as u128) * 1000) as u128;
                        let path = session_dir.join(format!("chunk_{:04}.wav", index));
                        let metadata = ChunkEvent {
                            session_id: session_id_clone.clone(),
                            index: index as u64,
                            path: path.to_string_lossy().to_string(),
                            start_ms,
                            end_ms,
                            duration_ms: (chunk_secs as u128) * 1000,
                            bytes: std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0),
                            kind: kind_string.clone(),
                        };
                        let _ = handle.emit("audio:chunk", metadata);
                    }
                }
            }
        });

        self.session_id = Some(session_id.clone());
        self.session_dir = Some(dir);
        self.active_sources = source_ids;
        self.kind = Some(kind.to_string());
        self.chunk_task = Some(task);

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

fn write_wav_chunk(dir: &PathBuf, sample_rate: u32, data: &[f32]) -> Result<usize> {
    std::fs::create_dir_all(dir)?;
    // Count existing chunks to determine next index
    let mut max_idx = 0usize;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if let Some(num_str) = name.strip_prefix("chunk_").and_then(|s| s.strip_suffix(".wav")) {
                    if let Ok(n) = num_str.parse::<usize>() { if n > max_idx { max_idx = n; } }
                }
            }
        }
    }
    let next = max_idx + 1;
    let path = dir.join(format!("chunk_{:04}.wav", next));

    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(&path, spec)?;
    for &sample in data {
        let s = (sample.max(-1.0).min(1.0) * i16::MAX as f32) as i16;
        writer.write_sample(s)?;
    }
    writer.finalize()?;
    Ok(next)
}

// Tauri commands bridging to the chunker state
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


