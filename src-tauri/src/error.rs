use serde::{Deserialize, Serialize};
use std::fmt;


#[derive(Debug, Serialize, Deserialize)]
pub enum AppError {
    AudioError(String),
    FileSystemError(String),
    IPCError(String),
    WindowError(String),
    NotificationError(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AppError::AudioError(msg) => write!(f, "Audio Error: {}", msg),
            AppError::FileSystemError(msg) => write!(f, "File System Error: {}", msg),
            AppError::IPCError(msg) => write!(f, "IPC Error: {}", msg),
            AppError::WindowError(msg) => write!(f, "Window Error: {}", msg),
            AppError::NotificationError(msg) => write!(f, "Notification Error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}




