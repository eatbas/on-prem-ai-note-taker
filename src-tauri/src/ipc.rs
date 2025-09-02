use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize)]
pub struct IPCMessage {
    pub event: String,
    pub data: serde_json::Value,
}

pub struct IPCBridge {
    app_handle: Option<AppHandle>,
}

impl IPCBridge {
    pub fn new() -> Self {
        Self { app_handle: None }
    }

    pub fn new_with_handle(app_handle: AppHandle) -> Self {
        Self { app_handle: Some(app_handle) }
    }

    // Send message to frontend
    pub async fn send_to_frontend(&self, event: &str, data: serde_json::Value) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(ref handle) = self.app_handle {
            handle.emit(event, data)?;
            Ok(())
        } else {
            Err("App handle not available".into())
        }
    }



    // Broadcast to all windows
    pub async fn broadcast(&self, event: &str, data: serde_json::Value) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(ref handle) = self.app_handle {
            handle.emit(event, data)?;
            Ok(())
        } else {
            Err("App handle not available".into())
        }
    }
}

// Tauri commands for IPC
#[tauri::command]
pub async fn send_ipc_message(
    message: IPCMessage,
    ipc_bridge: tauri::State<'_, std::sync::Arc<tokio::sync::Mutex<IPCBridge>>>
) -> Result<(), String> {
    let bridge = ipc_bridge.lock().await;
    bridge.send_to_frontend(&message.event, message.data).await
        .map_err(|e| format!("Failed to send IPC message: {}", e))
}

#[tauri::command]
pub async fn broadcast_ipc_message(
    message: IPCMessage,
    ipc_bridge: tauri::State<'_, std::sync::Arc<tokio::sync::Mutex<IPCBridge>>>
) -> Result<(), String> {
    let bridge = ipc_bridge.lock().await;
    bridge.broadcast(&message.event, message.data).await
        .map_err(|e| format!("Failed to broadcast IPC message: {}", e))
}
