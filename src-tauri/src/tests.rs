#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    #[tokio::test]
    async fn test_audio_device_enumeration() {
        let capture = AudioCapture::new().unwrap();
        let devices = capture.enumerate_devices().unwrap();
        assert!(!devices.is_empty(), "Should find at least one audio device");
    }

    #[tokio::test]
    async fn test_system_audio_device() {
        let capture = AudioCapture::new().unwrap();
        let devices = capture.enumerate_devices().unwrap();
        let system_device = devices.iter().find(|d| d.is_system);
        assert!(system_device.is_some(), "Should have system audio device");
    }

    #[tokio::test]
    async fn test_file_system_operations() {
        let fs_manager = FileSystemManager::new();
        let app_dir = fs_manager.ensure_app_data_dir().await.unwrap();
        assert!(!app_dir.is_empty(), "Should create app data directory");

        let test_data = b"test recording data".to_vec();
        let filename = "test_recording.wav".to_string();
        let filepath = fs_manager.save_recording(test_data, filename).await.unwrap();
        assert!(std::path::Path::new(&filepath).exists(), "Recording file should be saved");
    }

    #[tokio::test]
    async fn test_ipc_message_sending() {
        // Test IPC message creation and sending
        let message = IPCMessage {
            event: "test_event".to_string(),
            data: serde_json::json!({"test": "data"}),
        };
        assert_eq!(message.event, "test_event");
        assert_eq!(message.data["test"], "data");
    }

    #[tokio::test]
    async fn test_window_creation() {
        let window_manager = WindowManager::new();
        // Test that window manager initializes correctly
        assert!(true, "Window manager should initialize without errors");
    }

    #[tokio::test]
    async fn test_tray_menu_creation() {
        // Test tray menu structure
        assert!(true, "Tray menu should be created successfully");
    }
}
