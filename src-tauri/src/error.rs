use serde::{Deserialize, Serialize};
use std::fmt;
use chrono;

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

pub type Result<T> = std::result::Result<T, AppError>;

pub struct ErrorHandler;

impl ErrorHandler {
    pub fn log_error(error: &AppError, context: &str) {
        eprintln!("❌ Error in {}: {}", context, error);

        // Could send to frontend for user notification
        // or write to log file
    }

    pub async fn handle_recoverable_error(error: AppError, context: &str) -> Result<()> {
        Self::log_error(&error, context);

        // Implement recovery strategies based on error type
        match error {
            AppError::AudioError(_) => {
                // Try to restart audio system
                Err(error)
            }
            AppError::FileSystemError(_) => {
                // Try alternative file location
                Err(error)
            }
            _ => Err(error),
        }
    }

    pub fn create_error_report(error: &AppError) -> String {
        format!(
            "Error Report\n============\nType: {:?}\nMessage: {}\nTimestamp: {}\nPlatform: {}\n",
            error,
            error,
            chrono::Utc::now().to_rfc3339(),
            std::env::consts::OS
        )
    }
}
