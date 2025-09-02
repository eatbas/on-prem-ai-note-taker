#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod audio;
mod env;
mod windows;
mod tray;
mod ipc;
mod notifications;
mod fs;
mod performance;
mod error;

use audio::{AudioCapture, AudioDevice};
use windows::WindowManager;
use tray::TrayManager;
use ipc::{IPCBridge, IPCMessage};
use notifications::NotificationManager;
use fs::FileSystemManager;
use performance::PerformanceMonitor;
use error::{AppError, ErrorHandler};
use env::load_environment;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{Manager, Emitter};

#[tauri::command]
async fn get_audio_devices(
    audio_capture: tauri::State<'_, Arc<Mutex<AudioCapture>>>
) -> Result<Vec<AudioDevice>, String> {
    let capture = audio_capture.lock().await;
    capture.enumerate_devices()
        .map_err(|e| format!("Failed to enumerate devices: {}", e))
}

#[tauri::command]
async fn start_audio_capture(
    device_id: String,
    audio_capture: tauri::State<'_, Arc<Mutex<AudioCapture>>>
) -> Result<(), String> {
    let mut capture = audio_capture.lock().await;
    capture.start_capture(device_id).await
        .map_err(|e| format!("Failed to start capture: {}", e))
}

#[tauri::command]
async fn stop_audio_capture(
    audio_capture: tauri::State<'_, Arc<Mutex<AudioCapture>>>
) -> Result<(), String> {
    let mut capture = audio_capture.lock().await;
    capture.stop_capture().await
        .map_err(|e| format!("Failed to stop capture: {}", e))
}

#[tauri::command]
async fn get_audio_data(
    audio_capture: tauri::State<'_, Arc<Mutex<AudioCapture>>>
) -> Result<Vec<f32>, String> {
    let capture = audio_capture.lock().await;
    capture.get_audio_data().await
        .map_err(|e| format!("Failed to get audio data: {}", e))
}

#[tauri::command]
async fn show_floating_recorder(
    window_manager: tauri::State<'_, Arc<Mutex<WindowManager>>>
) -> Result<(), String> {
    let manager = window_manager.lock().await;
    manager.show_floating_recorder().await
        .map_err(|e| format!("Failed to show floating recorder: {}", e))
}

#[tauri::command]
async fn hide_floating_recorder(
    window_manager: tauri::State<'_, Arc<Mutex<WindowManager>>>
) -> Result<(), String> {
    let manager = window_manager.lock().await;
    manager.hide_floating_recorder().await
        .map_err(|e| format!("Failed to hide floating recorder: {}", e))
}

#[tauri::command]
async fn start_recording(
    window_manager: tauri::State<'_, Arc<Mutex<WindowManager>>>,
    tray_manager: tauri::State<'_, Arc<Mutex<TrayManager>>>
) -> Result<(), String> {
    // Update tray state
    let tray = tray_manager.lock().await;
    tray.update_recording_state(true);

    // Update floating recorder
    let windows = window_manager.lock().await;
    windows.update_recorder_content("Recording...".to_string()).await
        .map_err(|e| format!("Failed to update recorder: {}", e))
}

#[tauri::command]
async fn stop_recording(
    window_manager: tauri::State<'_, Arc<Mutex<WindowManager>>>,
    tray_manager: tauri::State<'_, Arc<Mutex<TrayManager>>>
) -> Result<(), String> {
    // Update tray state
    let tray = tray_manager.lock().await;
    tray.update_recording_state(false);

    // Update floating recorder
    let windows = window_manager.lock().await;
    windows.update_recorder_content("Ready to record".to_string()).await
        .map_err(|e| format!("Failed to update recorder: {}", e))
}

#[tauri::command]
async fn show_notification(
    title: String,
    body: String,
    notification_manager: tauri::State<'_, Arc<Mutex<NotificationManager>>>
) -> Result<(), String> {
    let manager = notification_manager.lock().await;
    manager.show_notification(&title, &body).await
        .map_err(|e| format!("Failed to show notification: {}", e))
}

#[tauri::command]
async fn save_recording_file(
    data: Vec<u8>,
    filename: String,
    fs_manager: tauri::State<'_, Arc<Mutex<FileSystemManager>>>
) -> Result<String, String> {
    let manager = fs_manager.lock().await;
    manager.save_recording(data, filename).await
        .map_err(|e| format!("Failed to save recording: {}", e))
}

#[tauri::command]
async fn list_recording_files(
    fs_manager: tauri::State<'_, Arc<Mutex<FileSystemManager>>>
) -> Result<Vec<fs::FileInfo>, String> {
    let manager = fs_manager.lock().await;
    manager.list_recordings().await
        .map_err(|e| format!("Failed to list recordings: {}", e))
}

#[tauri::command]
async fn get_performance_metrics(
    perf_monitor: tauri::State<'_, Arc<Mutex<PerformanceMonitor>>>
) -> Result<performance::PerformanceMetrics, String> {
    let mut monitor = perf_monitor.lock().await;
    monitor.update_system_metrics().await;
    Ok(monitor.get_metrics().clone())
}

fn main() {
    let audio_capture = Arc::new(Mutex::new(AudioCapture::new().unwrap()));
    let window_manager = Arc::new(Mutex::new(WindowManager::new()));
    let perf_monitor = Arc::new(Mutex::new(PerformanceMonitor::new()));

    tauri::Builder::default()
        .manage(audio_capture)
        .manage(window_manager.clone())
        .manage(perf_monitor)
        .invoke_handler(tauri::generate_handler![
            get_audio_devices,
            start_audio_capture,
            stop_audio_capture,
            get_audio_data,
            show_floating_recorder,
            hide_floating_recorder,
            start_recording,
            stop_recording,
            ipc::send_ipc_message,
            ipc::broadcast_ipc_message,
            show_notification,
            save_recording_file,
            list_recording_files,
            get_performance_metrics
        ])
        .setup(move |app| {
            let tray_manager = Arc::new(Mutex::new(TrayManager::new(app.handle().clone())));

            // Initialize IPC bridge
            {
                let mut ipc = ipc_bridge.lock().unwrap();
                *ipc = IPCBridge::new(app.handle().clone());
            }

            // Initialize notification manager
            {
                let mut notification = notification_manager.lock().unwrap();
                *notification = NotificationManager::new(app.handle().clone());
            }

            // Load environment variables
            load_environment().map_err(|e| {
                eprintln!("Failed to load environment: {}", e);
            }).ok();

            // Create floating recorder window
            let window_manager_clone = window_manager.clone();
            tokio::spawn(async move {
                let mut manager = window_manager_clone.lock().await;
                if let Err(e) = manager.create_floating_recorder(app).await {
                    eprintln!("Failed to create floating recorder: {}", e);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
