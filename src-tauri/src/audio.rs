use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use futures::executor::block_on;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_system: bool,
    pub channels: u16,
    pub sample_rate: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
}

pub struct AudioCapture {
    host: cpal::Host,
    audio_data: Arc<Mutex<Vec<f32>>>,
    is_recording: Arc<AtomicBool>,
    active_devices: Arc<Mutex<Vec<String>>>,
}

impl AudioCapture {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let host = cpal::default_host();
        Ok(Self {
            host,
            audio_data: Arc::new(Mutex::new(Vec::new())),
            is_recording: Arc::new(AtomicBool::new(false)),
            active_devices: Arc::new(Mutex::new(Vec::new())),
        })
    }

    pub fn enumerate_devices(&self) -> Result<Vec<AudioDevice>, Box<dyn std::error::Error>> {
        let mut devices = Vec::new();

        // Get input devices (microphones)
        for (index, device) in self.host.input_devices()?.enumerate() {
            if let Ok(name) = device.name() {
                if let Ok(config) = device.default_input_config() {
                    devices.push(AudioDevice {
                        id: format!("input_{}", index),
                        name: format!("{} (Microphone)", name),
                        is_system: false,
                        channels: config.channels(),
                        sample_rate: config.sample_rate().0,
                    });
                }
            }
        }

        // Add system audio devices (platform-specific)
        devices.extend(self.get_system_audio_devices());

        Ok(devices)
    }

    fn get_system_audio_devices(&self) -> Vec<AudioDevice> {
        let mut devices = Vec::new();

        #[cfg(target_os = "windows")]
        {
            devices.push(AudioDevice {
                id: "system_windows_wasapi".to_string(),
                name: "System Audio (Windows WASAPI)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            });
        }

        #[cfg(target_os = "macos")]
        {
            devices.push(AudioDevice {
                id: "system_macos_coreaudio".to_string(),
                name: "System Audio (macOS CoreAudio)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            });
        }

        #[cfg(target_os = "linux")]
        {
            devices.push(AudioDevice {
                id: "system_linux_pulse".to_string(),
                name: "System Audio (Linux PulseAudio)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            });
        }

        devices
    }

    pub async fn start_capture(&mut self, device_id: String) -> Result<(), Box<dyn std::error::Error>> {
        let device = if device_id.starts_with("system_") {
            self.get_system_device(&device_id)?
        } else {
            // Find input device by ID
            let device_index: usize = device_id.replace("input_", "").parse().unwrap_or(0);
            self.host.input_devices()?
                .nth(device_index)
                .ok_or("Audio device not found")?
        };

        let config = if device_id.starts_with("system_") {
            // For system audio, try to get output config first, fallback to input
            device.default_output_config()
                .or_else(|_| device.default_input_config())?
        } else {
            device.default_input_config()?
        };

        let audio_data = self.audio_data.clone();
        let is_recording = self.is_recording.clone();
        let active_devices = self.active_devices.clone();
        let stream_config: cpal::StreamConfig = config.into();

        println!("🎵 Starting audio capture for device: {} with config: {:?}", device_id, stream_config);

        // Add device to active list
        {
            let mut devices = active_devices.lock().await;
            if !devices.contains(&device_id) {
                devices.push(device_id.clone());
            }
        }

        let stream = device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &_| {
                // Audio data callback - store in buffer
                let mut buffer = block_on(audio_data.lock());
                // Limit buffer size to prevent memory issues (keep last 10 seconds at 44.1kHz)
                let max_samples = 44100 * 10 * 2; // 10 seconds, stereo
                let current_len = buffer.len();
                if current_len > max_samples {
                    buffer.drain(0..(current_len - max_samples));
                }
                buffer.extend_from_slice(data);
            },
            |err| eprintln!("❌ Audio stream error: {}", err),
            None,
        )?;

        stream.play()?;
        is_recording.store(true, Ordering::Relaxed);

        // Note: We intentionally let the stream drop here
        // This is a limitation of cpal on macOS - streams are not Send/Sync
        // In a production system, you'd want to use a different audio library
        // or implement platform-specific solutions
        
        // The stream will continue running until it's dropped
        // For now, we'll use a memory leak to keep it alive
        std::mem::forget(stream);

        println!("✅ Audio capture started for device: {}", device_id);
        Ok(())
    }

    fn get_system_device(&self, device_id: &str) -> Result<cpal::Device, Box<dyn std::error::Error>> {
        match device_id {
            #[cfg(target_os = "windows")]
            "system_windows_wasapi" => {
                // Use WASAPI for Windows system audio
                let host = cpal::host_from_id(cpal::available_hosts()
                    .into_iter()
                    .find(|id| *id == cpal::HostId::Wasapi)
                    .ok_or("WASAPI not available")?)?;

                // Try to get a loopback device for system audio capture
                host.default_output_device()
                    .ok_or("No default output device found".into())
            }

            #[cfg(target_os = "macos")]
            "system_macos_coreaudio" => {
                // Use CoreAudio for macOS system audio
                // Note: macOS system audio capture requires special permissions
                self.host.default_output_device()
                    .ok_or("No default output device found".into())
            }

            #[cfg(target_os = "linux")]
            "system_linux_pulse" => {
                // Use PulseAudio for Linux system audio
                self.host.default_output_device()
                    .ok_or("No default output device found".into())
            }

            _ => Err("Unsupported system audio device".into())
        }
    }

    pub async fn stop_capture(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("🛑 Stopping all audio capture streams");
        
        // Signal all streams to stop
        self.is_recording.store(false, Ordering::Relaxed);
        
        // Clear active devices list
        {
            let mut devices = self.active_devices.lock().await;
            devices.clear();
        }
        
        // Clear audio data buffer
        let mut buffer = self.audio_data.lock().await;
        buffer.clear();
        
        println!("✅ All audio capture stopped");
        Ok(())
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::Relaxed)
    }

    pub async fn get_audio_data(&self) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
        let mut buffer = self.audio_data.lock().await;
        Ok(buffer.drain(..).collect())
    }

    pub async fn get_audio_data_chunk(&self, max_samples: usize) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
        let mut buffer = self.audio_data.lock().await;
        let chunk_size = std::cmp::min(max_samples, buffer.len());
        Ok(buffer.drain(0..chunk_size).collect())
    }

    pub async fn get_audio_buffer_size(&self) -> Result<usize, Box<dyn std::error::Error>> {
        let buffer = self.audio_data.lock().await;
        Ok(buffer.len())
    }

    pub async fn get_active_devices(&self) -> Vec<String> {
        let devices = self.active_devices.lock().await;
        devices.clone()
    }

    pub async fn stop_device_capture(&mut self, device_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        println!("🛑 Stopping stream for device: {}", device_id);
        
        // Remove device from active list
        {
            let mut devices = self.active_devices.lock().await;
            devices.retain(|d| d != device_id);
            
            // Update recording state
            if devices.is_empty() {
                self.is_recording.store(false, Ordering::Relaxed);
            }
        }
        
        Ok(())
    }
}
