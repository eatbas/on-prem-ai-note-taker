use tauri::AppHandle;

pub struct NotificationManager {
    app_handle: Option<AppHandle>,
}

impl NotificationManager {
    pub fn new() -> Self {
        Self { app_handle: None }
    }

    pub fn new_with_handle(app_handle: AppHandle) -> Self {
        Self { app_handle: Some(app_handle) }
    }

    pub async fn show_notification(&self, title: &str, body: &str) -> Result<(), Box<dyn std::error::Error>> {
        // Use system notifications
        #[cfg(target_os = "windows")]
        {
            self.show_windows_notification(title, body).await
        }

        #[cfg(target_os = "macos")]
        {
            self.show_macos_notification(title, body).await
        }

        #[cfg(target_os = "linux")]
        {
            self.show_linux_notification(title, body).await
        }
    }

    #[cfg(target_os = "windows")]
    async fn show_windows_notification(&self, title: &str, body: &str) -> Result<(), Box<dyn std::error::Error>> {
        use std::process::Command;
        let script = format!(
            r#"
            [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
            [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
            [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

            $template = @"
            <toast>
                <visual>
                    <binding template="ToastGeneric">
                        <text>{}</text>
                        <text>{}</text>
                    </binding>
                </visual>
            </toast>
            "@

            $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
            $xml.LoadXml($template)
            $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
            [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("dgMeets").Show($toast)
            "#,
            title, body
        );

        Command::new("powershell")
            .arg("-Command")
            .arg(script)
            .output()?;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn show_macos_notification(&self, title: &str, body: &str) -> Result<(), Box<dyn std::error::Error>> {
        use std::process::Command;
        Command::new("osascript")
            .arg("-e")
            .arg(format!("display notification \"{}\" with title \"{}\"", body, title))
            .output()?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn show_linux_notification(&self, title: &str, body: &str) -> Result<(), Box<dyn std::error::Error>> {
        use std::process::Command;
        Command::new("notify-send")
            .arg(title)
            .arg(body)
            .output()?;
        Ok(())
    }

    pub async fn show_recording_notification(&self, is_recording: bool) -> Result<(), Box<dyn std::error::Error>> {
        if is_recording {
            self.show_notification(
                "Recording Started",
                "dgMeets is now recording your meeting"
            ).await
        } else {
            self.show_notification(
                "Recording Stopped",
                "Your meeting recording has been saved"
            ).await
        }
    }
}
