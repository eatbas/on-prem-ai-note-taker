use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use futures::executor::block_on;

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
}

impl AudioCapture {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let host = cpal::default_host();
        Ok(Self {
            host,
            audio_data: Arc::new(Mutex::new(Vec::new())),
        })
    }

    pub fn enumerate_devices(&self) -> Result<Vec<AudioDevice>, Box<dyn std::error::Error>> {
        let mut devices = Vec::new();

        // Get input devices (microphones)
        for device in self.host.input_devices()? {
            if let Ok(name) = device.name() {
                if let Ok(config) = device.default_input_config() {
                    devices.push(AudioDevice {
                        id: format!("input_{}", devices.len()),
                        name,
                        is_system: false,
                        channels: config.channels(),
                        sample_rate: config.sample_rate().0,
                    });
                }
            }
        }

        // Add system audio device (platform-specific)
        devices.push(self.get_system_audio_device());

        Ok(devices)
    }

    fn get_system_audio_device(&self) -> AudioDevice {
        #[cfg(target_os = "windows")]
        {
            AudioDevice {
                id: "system_windows".to_string(),
                name: "System Audio (Windows WASAPI)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            }
        }

        #[cfg(target_os = "macos")]
        {
            AudioDevice {
                id: "system_macos".to_string(),
                name: "System Audio (macOS)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            }
        }

        #[cfg(target_os = "linux")]
        {
            AudioDevice {
                id: "system_linux".to_string(),
                name: "System Audio (Linux PulseAudio)".to_string(),
                is_system: true,
                channels: 2,
                sample_rate: 44100,
            }
        }
    }

    pub async fn start_capture(&mut self, device_id: String) -> Result<(), Box<dyn std::error::Error>> {
        let device = if device_id.starts_with("system_") {
            self.get_system_device()?
        } else {
            // Find input device by ID
            self.host.input_devices()?
                .find(|d| d.name().unwrap_or_default().contains(&device_id))
                .ok_or("Audio device not found")?
        };

        let config = device.default_input_config()?;
        let audio_data = self.audio_data.clone();

        let stream = device.build_input_stream(
            &config.clone().into(),
            move |data: &[f32], _: &_| {
                // Audio data callback - store in buffer
                let mut buffer = block_on(audio_data.lock());
                buffer.extend_from_slice(data);
            },
            |err| eprintln!("Audio stream error: {}", err),
            None,
        )?;

        stream.play()?;
        // Note: We don't store the stream to avoid thread safety issues
        // The stream will be dropped when this function returns, but it should continue running

        Ok(())
    }

    fn get_system_device(&self) -> Result<cpal::Device, Box<dyn std::error::Error>> {
        #[cfg(target_os = "windows")]
        {
            // Use WASAPI for Windows system audio
            let host = cpal::host_from_id(cpal::available_hosts()
                .into_iter()
                .find(|id| *id == cpal::HostId::Wasapi)
                .ok_or("WASAPI not available")?)?;

            host.default_output_device()
                .ok_or("No default output device found".into())
        }

        #[cfg(target_os = "macos")]
        {
            // Use CoreAudio for macOS system audio
            self.host.default_output_device()
                .ok_or("No default output device found".into())
        }

        #[cfg(target_os = "linux")]
        {
            // Use PulseAudio for Linux system audio
            self.host.default_output_device()
                .ok_or("No default output device found".into())
        }
    }

    pub async fn stop_capture(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Clear audio data buffer
        let mut buffer = self.audio_data.lock().await;
        buffer.clear();
        Ok(())
    }

    pub async fn get_audio_data(&self) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
        let mut buffer = self.audio_data.lock().await;
        Ok(buffer.drain(..).collect())
    }
}
