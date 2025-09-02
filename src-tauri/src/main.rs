#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod audio;
mod multi_audio;
mod whisper;
mod env;
mod windows;
mod tray;
mod ipc;
mod notifications;
mod fs;
mod performance;
mod error;

use audio::{AudioCapture, AudioDevice};
use multi_audio::{MultiSourceAudioCapture, MultiAudioConfig, AudioSource};
use whisper::{LocalWhisperService, WhisperManager, WhisperConfig};
use windows::WindowManager;
use tray::TrayManager;
use ipc::IPCBridge;
use notifications::NotificationManager;
use fs::FileSystemManager;
use performance::PerformanceMonitor;
use env::load_environment;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;

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
    app: tauri::AppHandle,
    window_manager: tauri::State<'_, Arc<Mutex<WindowManager>>>
) -> Result<(), String> {
    let mut manager = window_manager.lock().await;
    manager.show_floating_recorder(&app).await
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
async fn show_main_window(
    app: tauri::AppHandle
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| format!("Failed to show main window: {}", e))?;
        window.set_focus().map_err(|e| format!("Failed to focus main window: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn handle_tray_event(
    event: String,
    tray_manager: tauri::State<'_, Arc<Mutex<TrayManager>>>
) -> Result<(), String> {
    let tray = tray_manager.lock().await;
    tray.handle_tray_event(&event).await;
    Ok(())
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

#[tauri::command]
async fn is_recording(
    audio_capture: tauri::State<'_, Arc<Mutex<AudioCapture>>>
) -> Result<bool, String> {
    let capture = audio_capture.lock().await;
    Ok(capture.is_recording())
}

#[tauri::command]
async fn get_active_audio_devices(
    audio_capture: tauri::State<'_, Arc<Mutex<AudioCapture>>>
) -> Result<Vec<String>, String> {
    let capture = audio_capture.lock().await;
    Ok(capture.get_active_devices().await)
}

#[tauri::command]
async fn get_audio_buffer_size(
    audio_capture: tauri::State<'_, Arc<Mutex<AudioCapture>>>
) -> Result<usize, String> {
    let capture = audio_capture.lock().await;
    capture.get_audio_buffer_size().await
        .map_err(|e| format!("Failed to get buffer size: {}", e))
}

#[tauri::command]
async fn get_audio_data_chunk(
    max_samples: usize,
    audio_capture: tauri::State<'_, Arc<Mutex<AudioCapture>>>
) -> Result<Vec<f32>, String> {
    let capture = audio_capture.lock().await;
    capture.get_audio_data_chunk(max_samples).await
        .map_err(|e| format!("Failed to get audio chunk: {}", e))
}

#[tauri::command]
async fn stop_device_capture(
    device_id: String,
    audio_capture: tauri::State<'_, Arc<Mutex<AudioCapture>>>
) -> Result<(), String> {
    let mut capture = audio_capture.lock().await;
    capture.stop_device_capture(&device_id).await
        .map_err(|e| format!("Failed to stop device capture: {}", e))
}

// ============ NEW PHASE 4 COMMANDS: Multi-Audio & Whisper ============

#[tauri::command]
async fn discover_audio_sources(
    multi_audio: tauri::State<'_, Arc<Mutex<MultiSourceAudioCapture>>>
) -> Result<Vec<AudioSource>, String> {
    let capture = multi_audio.lock().await;
    capture.discover_sources().await
        .map_err(|e| format!("Failed to discover audio sources: {}", e))
}

#[tauri::command]
async fn start_multi_recording(
    source_ids: Vec<String>,
    multi_audio: tauri::State<'_, Arc<Mutex<MultiSourceAudioCapture>>>
) -> Result<(), String> {
    let capture = multi_audio.lock().await;
    capture.start_multi_recording(source_ids).await
        .map_err(|e| format!("Failed to start multi-recording: {}", e))
}

#[tauri::command]
async fn stop_multi_recording(
    multi_audio: tauri::State<'_, Arc<Mutex<MultiSourceAudioCapture>>>
) -> Result<(), String> {
    let capture = multi_audio.lock().await;
    capture.stop_recording().await
        .map_err(|e| format!("Failed to stop multi-recording: {}", e))
}

#[tauri::command]
async fn get_mixed_audio_data(
    max_samples: Option<usize>,
    multi_audio: tauri::State<'_, Arc<Mutex<MultiSourceAudioCapture>>>
) -> Result<Vec<f32>, String> {
    let capture = multi_audio.lock().await;
    Ok(capture.get_mixed_audio(max_samples).await)
}

#[tauri::command]
async fn get_source_audio_data(
    source_id: String,
    max_samples: Option<usize>,
    multi_audio: tauri::State<'_, Arc<Mutex<MultiSourceAudioCapture>>>
) -> Result<Vec<f32>, String> {
    let capture = multi_audio.lock().await;
    Ok(capture.get_source_audio(&source_id, max_samples).await)
}

#[tauri::command]
async fn get_multi_audio_status(
    multi_audio: tauri::State<'_, Arc<Mutex<MultiSourceAudioCapture>>>
) -> Result<serde_json::Value, String> {
    let capture = multi_audio.lock().await;
    Ok(capture.get_status().await)
}

#[tauri::command]
async fn initialize_whisper(
    whisper_manager: tauri::State<'_, Arc<Mutex<WhisperManager>>>
) -> Result<(), String> {
    let manager = whisper_manager.lock().await;
    
    // Add default Whisper service
    let config = WhisperConfig::default();
    let service = LocalWhisperService::new(config);
    
    manager.add_service(service).await
        .map_err(|e| format!("Failed to initialize Whisper: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn transcribe_audio_data(
    audio_data: Vec<f32>,
    sample_rate: u32,
    whisper_manager: tauri::State<'_, Arc<Mutex<WhisperManager>>>
) -> Result<String, String> {
    let manager = whisper_manager.lock().await;
    manager.transcribe(&audio_data, sample_rate).await
        .map_err(|e| format!("Failed to transcribe audio: {}", e))
}

#[tauri::command]
async fn get_whisper_models(
    whisper_manager: tauri::State<'_, Arc<Mutex<WhisperManager>>>
) -> Result<Vec<serde_json::Value>, String> {
    let manager = whisper_manager.lock().await;
    Ok(manager.list_services().await)
}

fn main() {
    let audio_capture = Arc::new(Mutex::new(AudioCapture::new().unwrap()));
    let window_manager = Arc::new(Mutex::new(WindowManager::new()));
    let perf_monitor = Arc::new(Mutex::new(PerformanceMonitor::new()));
    let ipc_bridge = Arc::new(Mutex::new(IPCBridge::new()));
    let notification_manager = Arc::new(Mutex::new(NotificationManager::new()));
    let fs_manager = Arc::new(Mutex::new(FileSystemManager::new()));
    
    // Phase 4: Multi-audio and Whisper managers
    let multi_audio_config = MultiAudioConfig::default();
    let multi_audio = Arc::new(Mutex::new(MultiSourceAudioCapture::new(multi_audio_config)));
    let whisper_manager = Arc::new(Mutex::new(WhisperManager::new()));

    tauri::Builder::default()
        .manage(audio_capture)
        .manage(window_manager.clone())
        .manage(perf_monitor)
        .manage(ipc_bridge.clone())
        .manage(notification_manager.clone())
        .manage(fs_manager)
        .manage(multi_audio)
        .manage(whisper_manager)
        .invoke_handler(tauri::generate_handler![
            get_audio_devices,
            start_audio_capture,
            stop_audio_capture,
            get_audio_data,
            is_recording,
            get_active_audio_devices,
            get_audio_buffer_size,
            get_audio_data_chunk,
            stop_device_capture,
            show_floating_recorder,
            hide_floating_recorder,
            show_main_window,
            handle_tray_event,
            start_recording,
            stop_recording,
            ipc::send_ipc_message,
            ipc::broadcast_ipc_message,
            show_notification,
            save_recording_file,
            list_recording_files,
            get_performance_metrics,
            // Phase 4: Multi-audio and Whisper commands
            discover_audio_sources,
            start_multi_recording,
            stop_multi_recording,
            get_mixed_audio_data,
            get_source_audio_data,
            get_multi_audio_status,
            initialize_whisper,
            transcribe_audio_data,
            get_whisper_models
        ])
        .setup(move |app| {
            let tray_manager = Arc::new(Mutex::new(TrayManager::new_with_handle(app.handle().clone())));

            // Initialize IPC bridge with app handle
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut ipc = ipc_bridge.lock().await;
                *ipc = IPCBridge::new_with_handle(app_handle.clone());
                
                let mut notification = notification_manager.lock().await;
                *notification = NotificationManager::new_with_handle(app_handle);
            });

            // Load environment variables
            load_environment().map_err(|e| {
                eprintln!("Failed to load environment: {}", e);
            }).ok();

            // Store tray manager for future use (note: system tray needs to be set up separately)
            app.manage(tray_manager);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
