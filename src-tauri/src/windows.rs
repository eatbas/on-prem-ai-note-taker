use tauri::{WebviewWindowBuilder, Emitter};

pub struct WindowManager {
    main_window: Option<tauri::WebviewWindow>,
    floating_recorder: Option<tauri::WebviewWindow>,
}

impl WindowManager {
    pub fn new() -> Self {
        Self {
            main_window: None,
            floating_recorder: None,
        }
    }

    pub fn set_main_window(&mut self, window: tauri::WebviewWindow) {
        self.main_window = Some(window);
    }

    pub async fn create_floating_recorder(&mut self, app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
        let recorder_window = WebviewWindowBuilder::new(
            app,
            "floating-recorder",
            tauri::WebviewUrl::App("floating-recorder.html".into())
        )
        .title("Recording - dgMeets")
        .inner_size(300.0, 200.0)
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(true)
        .build()?;

        // Position in bottom-right corner
        let monitor = recorder_window.primary_monitor()?.unwrap();
        let monitor_size = monitor.size();
        let window_size = recorder_window.inner_size()?;

        recorder_window.set_position(tauri::LogicalPosition::new(
            (monitor_size.width - window_size.width) as f64 - 20.0,
            (monitor_size.height - window_size.height) as f64 - 60.0,
        ))?;

        self.floating_recorder = Some(recorder_window);
        Ok(())
    }

    pub async fn show_floating_recorder(&self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(window) = &self.floating_recorder {
            window.show()?;
            window.set_focus()?;
        }
        Ok(())
    }

    pub async fn hide_floating_recorder(&self) -> Result<(), Box<dyn std::error::Error>> {
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
