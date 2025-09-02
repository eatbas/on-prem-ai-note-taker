use tauri::{WebviewWindowBuilder, Emitter, Manager};

pub struct WindowManager {
    floating_recorder: Option<tauri::WebviewWindow>,
}

impl WindowManager {
    pub fn new() -> Self {
        Self {
            floating_recorder: None,
        }
    }





    pub async fn show_floating_recorder(&mut self, app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
        // Check if window already exists
        if let Some(existing_window) = app.get_webview_window("floating-recorder") {
            existing_window.show()?;
            existing_window.set_focus()?;
            return Ok(());
        }

        // Create new floating recorder window
        let recorder_window = WebviewWindowBuilder::new(
            app,
            "floating-recorder",
            tauri::WebviewUrl::App("floating-recorder.html".into())
        )
        .title("Recording - dgMeets")
        .inner_size(280.0, 180.0)
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(true)
        .resizable(false)
        .build()?;

        // Position in bottom-right corner
        if let Ok(Some(monitor)) = recorder_window.primary_monitor() {
            let monitor_size = monitor.size();
            recorder_window.set_position(tauri::LogicalPosition::new(
                (monitor_size.width as f64) - 300.0,
                (monitor_size.height as f64) - 220.0,
            ))?;
        }

        recorder_window.show()?;
        recorder_window.set_focus()?;
        
        self.floating_recorder = Some(recorder_window);
        Ok(())
    }

    pub async fn hide_floating_recorder(&self) -> Result<(), Box<dyn std::error::Error>> {
        // First try to get the window by label (more reliable)
        if let Some(window) = &self.floating_recorder {
            window.hide()?;
        }
        Ok(())
    }

    pub async fn update_recorder_content(&self, content: String) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(window) = &self.floating_recorder {
            // Send content update to floating recorder
            window.emit("recorder-update", content)?;
        }
        Ok(())
    }
}
