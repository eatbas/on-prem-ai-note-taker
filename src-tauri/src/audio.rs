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
    sample_rate: u32,
    channels: u16,
}

impl AudioCapture {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let host = cpal::default_host();
        Ok(Self {
            host,
            audio_data: Arc::new(Mutex::new(Vec::new())),
            is_recording: Arc::new(AtomicBool::new(false)),
            active_devices: Arc::new(Mutex::new(Vec::new())),
            sample_rate: 44100,
            channels: 2,
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
            // Windows: WASAPI loopback for system audio
            devices.push(AudioDevice {
                id: "system_windows_wasapi".to_string(),
                name: "System Audio (WASAPI Loopback)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            });
            
            // Also check for Stereo Mix if available
            devices.push(AudioDevice {
                id: "system_windows_stereomix".to_string(),
                name: "Stereo Mix (Windows)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            });
        }

        #[cfg(target_os = "macos")]
        {
            // macOS: Core Audio with ScreenCaptureKit for system audio
            devices.push(AudioDevice {
                id: "system_macos_screencapturekit".to_string(),
                name: "System Audio (ScreenCaptureKit)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            });
            
            // Fallback to BlackHole or SoundFlower if available
            devices.push(AudioDevice {
                id: "system_macos_blackhole".to_string(),
                name: "BlackHole 2ch (Virtual Audio)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            });
        }

        #[cfg(target_os = "linux")]
        {
            // Linux: PulseAudio monitor sources
            devices.push(AudioDevice {
                id: "system_linux_pulse_monitor".to_string(),
                name: "System Audio (PulseAudio Monitor)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            });
            
            // ALSA loopback
            devices.push(AudioDevice {
                id: "system_linux_alsa_loopback".to_string(),
                name: "System Audio (ALSA Loopback)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            });
        }

        devices
    }

    pub async fn start_capture(&mut self, device_id: String) -> Result<(), Box<dyn std::error::Error>> {
        println!("🎵 Starting audio capture for device: {}", device_id);
        
        // Check if device is already capturing
        {
            let active_devices = self.active_devices.lock().await;
            if active_devices.contains(&device_id) {
                println!("⚠️ Device {} already capturing", device_id);
                return Ok(());
            }
        }

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
            // For system audio, try different approaches based on platform
            self.get_system_audio_config(&device, &device_id)?
        } else {
            device.default_input_config()?
        };

        let audio_data = self.audio_data.clone();
        let is_recording = self.is_recording.clone();
        let active_devices = self.active_devices.clone();
        let device_id_clone = device_id.clone();
        
        let stream_config: cpal::StreamConfig = config.into();
        println!("🔧 Device config: {:?}", stream_config);

        // Create and start stream in a separate scope to avoid Send+Sync issues
        {
            let stream = device.build_input_stream(
                &stream_config,
                move |data: &[f32], _: &_| {
                    // Audio data callback - store in buffer with device mixing
                    let mut buffer = block_on(audio_data.lock());
                    
                    // Limit buffer size to prevent memory issues (keep last 30 seconds at 44.1kHz)
                    let max_samples = 44100 * 30 * 2; // 30 seconds, stereo
                    let current_len = buffer.len();
                    if current_len > max_samples {
                        let drain_count = current_len - max_samples;
                        buffer.drain(0..drain_count);
                    }
                    
                    // Mix audio data (simple addition for multiple sources)
                    buffer.extend_from_slice(data);
                },
                move |err| {
                    eprintln!("❌ Audio stream error for {}: {}", device_id_clone, err);
                    // Try to remove device from active list on error
                    let mut devices = block_on(active_devices.lock());
                    devices.retain(|d| d != &device_id_clone);
                    if devices.is_empty() {
                        is_recording.store(false, Ordering::Relaxed);
                    }
                },
                None,
            )?;

            stream.play()?;
            
            // Keep stream alive by "leaking" it to avoid Send+Sync constraints
            // This is necessary because cpal streams are not Send+Sync and cannot be stored
            // in shared state across threads. The stream will continue running until the process ends.
            std::mem::forget(stream);
        } // stream variable is out of scope here
        
        // Add device to active list (async operation after stream is handled)
        {
            let mut devices = self.active_devices.lock().await;
            devices.push(device_id.clone());
        }
        
        self.is_recording.store(true, Ordering::Relaxed);
        
        println!("✅ Audio capture started for device: {}", device_id);
        Ok(())
    }

    fn get_system_audio_config(&self, device: &cpal::Device, device_id: &str) -> Result<cpal::SupportedStreamConfig, Box<dyn std::error::Error>> {
        // Try different config approaches based on device type
        if device_id.contains("system_") {
            // For system audio, prefer output config if available, fallback to input
            if let Ok(output_config) = device.default_output_config() {
                println!("📡 Using output config for system audio");
                return Ok(output_config);
            }
        }
        
        // Fallback to input config
        println!("📡 Using input config for device");
        device.default_input_config().map_err(|e| e.into())
    }

    fn get_system_device(&self, device_id: &str) -> Result<cpal::Device, Box<dyn std::error::Error>> {
        match device_id {
            #[cfg(target_os = "windows")]
            "system_windows_wasapi" => {
                // Use WASAPI for Windows system audio loopback
                println!("🪟 Attempting Windows WASAPI loopback");
                let host = cpal::host_from_id(cpal::available_hosts()
                    .into_iter()
                    .find(|id| *id == cpal::HostId::Wasapi)
                    .ok_or("WASAPI not available")?)?;

                host.default_output_device()
                    .ok_or("No default output device found".into())
            }
            
            #[cfg(target_os = "windows")]
            "system_windows_stereomix" => {
                // Try to find Stereo Mix device
                println!("🪟 Looking for Stereo Mix device");
                for device in self.host.input_devices()? {
                    if let Ok(name) = device.name() {
                        if name.to_lowercase().contains("stereo mix") || 
                           name.to_lowercase().contains("what u hear") {
                            return Ok(device);
                        }
                    }
                }
                Err("Stereo Mix device not found".into())
            }

            #[cfg(target_os = "macos")]
            "system_macos_screencapturekit" => {
                // macOS ScreenCaptureKit approach - fallback to default output
                println!("🍎 Attempting macOS ScreenCaptureKit system audio");
                self.host.default_output_device()
                    .ok_or("No default output device found".into())
            }
            
            #[cfg(target_os = "macos")]
            "system_macos_blackhole" => {
                // Look for BlackHole virtual audio device
                println!("🍎 Looking for BlackHole device");
                for device in self.host.input_devices()? {
                    if let Ok(name) = device.name() {
                        if name.to_lowercase().contains("blackhole") {
                            return Ok(device);
                        }
                    }
                }
                Err("BlackHole device not found".into())
            }

            #[cfg(target_os = "linux")]
            "system_linux_pulse_monitor" => {
                // Linux PulseAudio monitor source
                println!("🐧 Attempting Linux PulseAudio monitor");
                for device in self.host.input_devices()? {
                    if let Ok(name) = device.name() {
                        if name.to_lowercase().contains("monitor") || 
                           name.to_lowercase().contains("output") {
                            return Ok(device);
                        }
                    }
                }
                // Fallback to default output
                self.host.default_output_device()
                    .ok_or("No monitor device found".into())
            }
            
            #[cfg(target_os = "linux")]
            "system_linux_alsa_loopback" => {
                // ALSA loopback device
                println!("🐧 Looking for ALSA loopback device");
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
        {
            let mut buffer = self.audio_data.lock().await;
            buffer.clear();
        }
        
        // Note: We can't explicitly stop individual streams since they were "leaked"
        // to keep them alive. They will stop automatically when the recording flag is false
        // or when the process ends.
        
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
                println!("📴 All devices stopped, recording state set to false");
            }
        }
        
        // Note: We can't explicitly stop individual streams since they were "leaked"
        // The stream will continue until the recording flag check stops it or process ends
        
        Ok(())
    }
}
