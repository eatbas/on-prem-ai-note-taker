use tauri::{AppHandle, Manager, Emitter};

pub struct TrayManager {
    app_handle: AppHandle,
}

impl TrayManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    // Simplified tray implementation for Tauri 2.x
    // System tray setup will be handled in main.rs
    pub async fn handle_tray_event(&self, event: &str) {
        match event {
            "show" => {
                if let Some(window) = self.app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "start_recording" => {
                // Emit event to frontend
                let _ = self.app_handle.emit("start-recording", {});
            }
            "stop_recording" => {
                // Emit event to frontend
                let _ = self.app_handle.emit("stop-recording", {});
            }
            "quit" => {
                self.app_handle.exit(0);
            }
            _ => {}
        }
    }

    pub fn update_recording_state(&self, _is_recording: bool) {
        // In Tauri 2.x, tray menu updates are more complex
        // For now, we'll keep it simple
    }
}
