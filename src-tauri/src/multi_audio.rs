// Enhanced multi-source audio capture for simultaneous system + microphone recording
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashMap;
use anyhow::{anyhow, Result};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioSource {
    pub id: String,
    pub name: String,
    pub device_type: AudioSourceType,
    pub channels: u16,
    pub sample_rate: u32,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum AudioSourceType {
    SystemAudio,
    Microphone,
    LineIn,
    Virtual,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MultiAudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
    pub max_sources: usize,
    pub mix_output: bool,
}

impl Default for MultiAudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 44100,
            channels: 2,
            buffer_size: 1024,
            max_sources: 4,
            mix_output: true,
        }
    }
}

/// Enhanced audio capture supporting multiple simultaneous sources
pub struct MultiSourceAudioCapture {
    host: cpal::Host,
    config: MultiAudioConfig,
    sources: Arc<Mutex<HashMap<String, AudioSource>>>,
    audio_buffers: Arc<Mutex<HashMap<String, Vec<f32>>>>,
    mixed_buffer: Arc<Mutex<Vec<f32>>>,
    is_recording: Arc<AtomicBool>,
    active_streams: Arc<Mutex<Vec<String>>>,
}

impl MultiSourceAudioCapture {
    /// Create new multi-source audio capture
    pub fn new(config: MultiAudioConfig) -> Self {
        let host = cpal::default_host();
        
        Self {
            host,
            config,
            sources: Arc::new(Mutex::new(HashMap::new())),
            audio_buffers: Arc::new(Mutex::new(HashMap::new())),
            mixed_buffer: Arc::new(Mutex::new(Vec::new())),
            is_recording: Arc::new(AtomicBool::new(false)),
            active_streams: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Discover all available audio sources
    pub async fn discover_sources(&self) -> Result<Vec<AudioSource>> {
        let mut sources = Vec::new();

        // Get system audio devices
        let system_devices = self.get_system_audio_devices().await?;
        sources.extend(system_devices);

        // Get microphone devices
        let mic_devices = self.get_microphone_devices().await?;
        sources.extend(mic_devices);

        // Update internal sources map
        let mut sources_map = self.sources.lock().await;
        for source in &sources {
            sources_map.insert(source.id.clone(), source.clone());
        }

        Ok(sources)
    }

    /// Get system audio devices
    async fn get_system_audio_devices(&self) -> Result<Vec<AudioSource>> {
        let mut devices = Vec::new();

        #[cfg(target_os = "windows")]
        {
            // Windows WASAPI system audio
            if let Some(device) = self.host.default_output_device() {
                if let Ok(name) = device.name() {
                    devices.push(AudioSource {
                        id: "system_audio_wasapi".to_string(),
                        name: format!("System Audio ({})", name),
                        device_type: AudioSourceType::SystemAudio,
                        channels: 2,
                        sample_rate: 44100,
                        is_active: false,
                    });
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            // macOS CoreAudio system audio
            if let Some(device) = self.host.default_output_device() {
                if let Ok(name) = device.name() {
                    devices.push(AudioSource {
                        id: "system_audio_coreaudio".to_string(),
                        name: format!("System Audio ({})", name),
                        device_type: AudioSourceType::SystemAudio,
                        channels: 2,
                        sample_rate: 44100,
                        is_active: false,
                    });
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            // Linux PulseAudio system audio
            if let Some(device) = self.host.default_output_device() {
                if let Ok(name) = device.name() {
                    devices.push(AudioSource {
                        id: "system_audio_pulse".to_string(),
                        name: format!("System Audio ({})", name),
                        device_type: AudioSourceType::SystemAudio,
                        channels: 2,
                        sample_rate: 44100,
                        is_active: false,
                    });
                }
            }
        }

        Ok(devices)
    }

    /// Get microphone devices
    async fn get_microphone_devices(&self) -> Result<Vec<AudioSource>> {
        let mut devices = Vec::new();

        if let Ok(input_devices) = self.host.input_devices() {
            for device in input_devices {
            if let Ok(name) = device.name() {
                let device_id = format!("mic_{}", devices.len());
                devices.push(AudioSource {
                    id: device_id,
                    name,
                    device_type: AudioSourceType::Microphone,
                    channels: 1, // Most mics are mono
                    sample_rate: 44100,
                    is_active: false,
                });
            }
        }
        }

        Ok(devices)
    }

    /// Start recording from multiple sources
    pub async fn start_multi_recording(&self, source_ids: Vec<String>) -> Result<()> {
        if self.is_recording.load(Ordering::Relaxed) {
            return Err(anyhow!("Already recording"));
        }

        println!("🎙️ Starting multi-source recording with {} sources", source_ids.len());

        let sources = self.sources.lock().await;
        let mut active_streams = self.active_streams.lock().await;

        for source_id in source_ids {
            if let Some(source) = sources.get(&source_id) {
                match self.start_source_recording(source).await {
                    Ok(_) => {
                        active_streams.push(source_id.clone());
                        println!("✅ Started recording: {}", source.name);
                    }
                    Err(e) => {
                        println!("❌ Failed to start {}: {}", source.name, e);
                    }
                }
            }
        }

        if !active_streams.is_empty() {
            self.is_recording.store(true, Ordering::Relaxed);
            println!("🔴 Multi-source recording active with {} sources", active_streams.len());
            Ok(())
        } else {
            Err(anyhow!("No sources started successfully"))
        }
    }

    /// Start recording from a specific source
    async fn start_source_recording(&self, source: &AudioSource) -> Result<()> {
        match source.device_type {
            AudioSourceType::SystemAudio => self.start_system_audio_capture(source).await,
            AudioSourceType::Microphone => self.start_microphone_capture(source).await,
            _ => Err(anyhow!("Unsupported source type: {:?}", source.device_type)),
        }
    }

    /// Start system audio capture
    async fn start_system_audio_capture(&self, source: &AudioSource) -> Result<()> {
        println!("🔊 Starting system audio capture: {}", source.name);

        // Initialize buffer for this source
        let mut buffers = self.audio_buffers.lock().await;
        buffers.insert(source.id.clone(), Vec::new());

        // Platform-specific system audio capture
        #[cfg(target_os = "windows")]
        {
            self.start_wasapi_loopback(&source.id).await
        }

        #[cfg(target_os = "macos")]
        {
            self.start_coreaudio_loopback(&source.id).await
        }

        #[cfg(target_os = "linux")]
        {
            self.start_pulse_monitor(&source.id).await
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Err(anyhow!("System audio capture not supported on this platform"))
        }
    }

    /// Start microphone capture
    async fn start_microphone_capture(&self, source: &AudioSource) -> Result<()> {
        println!("🎤 Starting microphone capture: {}", source.name);

        // Find the microphone device
        let devices: Vec<_> = match self.host.input_devices() {
            Ok(devices) => devices.collect(),
            Err(e) => return Err(anyhow!("Failed to get input devices: {}", e)),
        };
        let device_index = source.id.strip_prefix("mic_")
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(0);

        let device = devices.get(device_index)
            .ok_or_else(|| anyhow!("Microphone device not found"))?;

        // Configure stream
        let config = cpal::StreamConfig {
            channels: source.channels,
            sample_rate: cpal::SampleRate(source.sample_rate),
            buffer_size: cpal::BufferSize::Fixed(self.config.buffer_size as u32),
        };

        // Initialize buffer
        let mut buffers = self.audio_buffers.lock().await;
        buffers.insert(source.id.clone(), Vec::new());
        drop(buffers);

        // Create audio stream
        let audio_buffers = Arc::clone(&self.audio_buffers);
        let source_id = source.id.clone();

        let stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let audio_buffers = Arc::clone(&audio_buffers);
                let source_id = source_id.clone();

                let data_copy = data.to_vec(); // Copy data to avoid lifetime issues
                tokio::spawn(async move {
                    if let Ok(mut buffers) = audio_buffers.try_lock() {
                        if let Some(buffer) = buffers.get_mut(&source_id) {
                            buffer.extend_from_slice(&data_copy);
                        }
                    }
                });
            },
            |err| {
                eprintln!("❌ Microphone stream error: {}", err);
            },
            None,
        )?;

        stream.play()?;
        std::mem::forget(stream); // Keep stream alive

        Ok(())
    }

    /// Platform-specific system audio implementations
    #[cfg(target_os = "windows")]
    async fn start_wasapi_loopback(&self, source_id: &str) -> Result<()> {
        // Windows WASAPI loopback capture
        println!("🪟 Using WASAPI loopback for system audio");
        
        let device = self.host.default_output_device()
            .ok_or_else(|| anyhow!("No output device found"))?;

        let config = cpal::StreamConfig {
            channels: 2,
            sample_rate: cpal::SampleRate(44100),
            buffer_size: cpal::BufferSize::Fixed(self.config.buffer_size as u32),
        };

        let audio_buffers = Arc::clone(&self.audio_buffers);
        let source_id = source_id.to_string();

        let stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let audio_buffers = Arc::clone(&audio_buffers);
                let source_id = source_id.clone();

                let data_copy = data.to_vec(); // Copy data to avoid lifetime issues
                tokio::spawn(async move {
                    if let Ok(mut buffers) = audio_buffers.try_lock() {
                        if let Some(buffer) = buffers.get_mut(&source_id) {
                            buffer.extend_from_slice(&data_copy);
                        }
                    }
                });
            },
            |err| eprintln!("❌ WASAPI stream error: {}", err),
            None,
        )?;

        stream.play()?;
        std::mem::forget(stream);
        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn start_coreaudio_loopback(&self, source_id: &str) -> Result<()> {
        // macOS CoreAudio aggregate device
        println!("🍎 Using CoreAudio for system audio");
        
        // For now, use similar approach to WASAPI
        // TODO: Implement proper CoreAudio aggregate device
        let device = self.host.default_output_device()
            .ok_or_else(|| anyhow!("No output device found"))?;

        let config = cpal::StreamConfig {
            channels: 2,
            sample_rate: cpal::SampleRate(44100),
            buffer_size: cpal::BufferSize::Fixed(self.config.buffer_size as u32),
        };

        let audio_buffers = Arc::clone(&self.audio_buffers);
        let source_id = source_id.to_string();

        let stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let audio_buffers = Arc::clone(&audio_buffers);
                let source_id = source_id.clone();

                let data_copy = data.to_vec(); // Copy data to avoid lifetime issues
                tokio::spawn(async move {
                    if let Ok(mut buffers) = audio_buffers.try_lock() {
                        if let Some(buffer) = buffers.get_mut(&source_id) {
                            buffer.extend_from_slice(&data_copy);
                        }
                    }
                });
            },
            |err| eprintln!("❌ CoreAudio stream error: {}", err),
            None,
        )?;

        stream.play()?;
        std::mem::forget(stream);
        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn start_pulse_monitor(&self, source_id: &str) -> Result<()> {
        // Linux PulseAudio monitor
        println!("🐧 Using PulseAudio monitor for system audio");
        
        // TODO: Implement proper PulseAudio monitor source
        // For now, use default approach
        let device = self.host.default_output_device()
            .ok_or_else(|| anyhow!("No output device found"))?;

        let config = cpal::StreamConfig {
            channels: 2,
            sample_rate: cpal::SampleRate(44100),
            buffer_size: cpal::BufferSize::Fixed(self.config.buffer_size as u32),
        };

        let audio_buffers = Arc::clone(&self.audio_buffers);
        let source_id = source_id.to_string();

        let stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let audio_buffers = Arc::clone(&audio_buffers);
                let source_id = source_id.clone();

                let data_copy = data.to_vec(); // Copy data to avoid lifetime issues
                tokio::spawn(async move {
                    if let Ok(mut buffers) = audio_buffers.try_lock() {
                        if let Some(buffer) = buffers.get_mut(&source_id) {
                            buffer.extend_from_slice(&data_copy);
                        }
                    }
                });
            },
            |err| eprintln!("❌ PulseAudio stream error: {}", err),
            None,
        )?;

        stream.play()?;
        std::mem::forget(stream);
        Ok(())
    }

    /// Stop all recording
    pub async fn stop_recording(&self) -> Result<()> {
        if !self.is_recording.load(Ordering::Relaxed) {
            return Ok(());
        }

        self.is_recording.store(false, Ordering::Relaxed);
        
        let mut active_streams = self.active_streams.lock().await;
        active_streams.clear();
        
        println!("⏹️ Multi-source recording stopped");
        Ok(())
    }

    /// Get mixed audio output
    pub async fn get_mixed_audio(&self, max_samples: Option<usize>) -> Vec<f32> {
        if self.config.mix_output {
            self.mix_audio_sources(max_samples).await
        } else {
            // Return primary source or empty if no mixing
            Vec::new()
        }
    }

    /// Mix audio from all active sources
    async fn mix_audio_sources(&self, max_samples: Option<usize>) -> Vec<f32> {
        let buffers = self.audio_buffers.lock().await;
        let active_streams = self.active_streams.lock().await;

        if active_streams.is_empty() {
            return Vec::new();
        }

        // Find the minimum length across all buffers
        let min_length = active_streams.iter()
            .filter_map(|id| buffers.get(id))
            .map(|buffer| buffer.len())
            .min()
            .unwrap_or(0);

        let samples_to_mix = max_samples.map(|max| max.min(min_length)).unwrap_or(min_length);
        
        if samples_to_mix == 0 {
            return Vec::new();
        }

        let mut mixed = vec![0.0f32; samples_to_mix];
        let num_sources = active_streams.len() as f32;

        // Mix all sources
        for stream_id in active_streams.iter() {
            if let Some(buffer) = buffers.get(stream_id) {
                for (i, sample) in buffer.iter().take(samples_to_mix).enumerate() {
                    mixed[i] += sample / num_sources; // Average mixing
                }
            }
        }

        mixed
    }

    /// Get separate audio data from specific source
    pub async fn get_source_audio(&self, source_id: &str, max_samples: Option<usize>) -> Vec<f32> {
        let mut buffers = self.audio_buffers.lock().await;
        
        if let Some(buffer) = buffers.get_mut(source_id) {
            let samples_to_take = max_samples.map(|max| max.min(buffer.len())).unwrap_or(buffer.len());
            let result = buffer.drain(0..samples_to_take).collect();
            result
        } else {
            Vec::new()
        }
    }

    /// Get recording status
    pub async fn get_status(&self) -> serde_json::Value {
        let active_streams = self.active_streams.lock().await;
        let buffers = self.audio_buffers.lock().await;
        
        let buffer_sizes: HashMap<String, usize> = buffers.iter()
            .map(|(id, buffer)| (id.clone(), buffer.len()))
            .collect();

        serde_json::json!({
            "is_recording": self.is_recording.load(Ordering::Relaxed),
            "active_sources": active_streams.len(),
            "source_ids": *active_streams,
            "buffer_sizes": buffer_sizes,
            "total_samples": buffer_sizes.values().sum::<usize>()
        })
    }

    /// Check if currently recording
    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::Relaxed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_multi_audio_creation() {
        let config = MultiAudioConfig::default();
        let capture = MultiSourceAudioCapture::new(config);
        assert!(!capture.is_recording());
    }

    #[tokio::test]
    async fn test_source_discovery() {
        let config = MultiAudioConfig::default();
        let capture = MultiSourceAudioCapture::new(config);
        
        // This might fail in CI without audio devices, so we allow errors
        let _sources = capture.discover_sources().await;
        // Just test that it doesn't panic
    }
}
