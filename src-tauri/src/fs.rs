use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub modified: String,
}

pub struct FileSystemManager;

impl FileSystemManager {
    pub fn new() -> Self {
        Self
    }

    pub async fn ensure_app_data_dir(&self) -> Result<String, Box<dyn std::error::Error>> {
        let app_data_dir = self.get_app_data_dir();

        if !Path::new(&app_data_dir).exists() {
            fs::create_dir_all(&app_data_dir)?;
        }

        Ok(app_data_dir)
    }

    pub async fn save_recording(&self, data: Vec<u8>, filename: String) -> Result<String, Box<dyn std::error::Error>> {
        let app_data_dir = self.ensure_app_data_dir().await?;
        let filepath = Path::new(&app_data_dir).join("recordings").join(filename);

        // Ensure recordings directory exists
        if let Some(parent) = filepath.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(&filepath, data)?;
        Ok(filepath.to_string_lossy().to_string())
    }

    pub async fn list_recordings(&self) -> Result<Vec<FileInfo>, Box<dyn std::error::Error>> {
        let app_data_dir = self.ensure_app_data_dir().await?;
        let recordings_dir = Path::new(&app_data_dir).join("recordings");

        if !recordings_dir.exists() {
            return Ok(Vec::new());
        }

        let mut files = Vec::new();
        for entry in fs::read_dir(recordings_dir)? {
            let entry = entry?;
            let path = entry.path();
            let metadata = entry.metadata()?;

            files.push(FileInfo {
                name: path.file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                path: path.to_string_lossy().to_string(),
                size: metadata.len(),
                is_dir: metadata.is_dir(),
                modified: format!("{:?}", metadata.modified()?),
            });
        }

        Ok(files)
    }

    fn get_app_data_dir(&self) -> String {
        #[cfg(target_os = "windows")]
        {
            format!("{}\\dgMeets", std::env::var("APPDATA").unwrap_or_default())
        }

        #[cfg(target_os = "macos")]
        {
            format!("{}/Library/Application Support/dgMeets", std::env::var("HOME").unwrap_or_default())
        }

        #[cfg(target_os = "linux")]
        {
            format!("{}/.dgmeets", std::env::var("HOME").unwrap_or_default())
        }
    }
}
