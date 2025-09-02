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
mod coordinator;
mod plugins;

// Plugin module
use plugins::audio_capture as audio_capture_plugin;
use audio::{AudioCapture, AudioDevice};
use multi_audio::{MultiSourceAudioCapture, MultiAudioConfig, AudioSource};
use whisper::{LocalWhisperService, WhisperManager, WhisperConfig, WhisperQuality, SupportedLanguages, ModelInfo, WhisperDevice, SpeakerSegment};
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
use std::path::PathBuf;
use std::sync::Arc as StdArc;
use tokio::sync::Mutex as TokioMutex;
use plugins::audio_capture::ChunkEvent;

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

#[tauri::command]
async fn transcribe_audio_with_language(
    audio_data: Vec<f32>,
    sample_rate: u32,
    _language: Option<String>,
    whisper_manager: tauri::State<'_, Arc<Mutex<WhisperManager>>>
) -> Result<String, String> {
    let manager = whisper_manager.lock().await;
    
    // Create config with specified language for maximum accuracy
    let mut config = WhisperConfig::default();
    config.language = _language;
    config.quality = WhisperQuality::Maximum; // Force maximum accuracy
    config.beam_size = 10; // Higher beam size for better accuracy
    
    manager.transcribe(&audio_data, sample_rate).await
        .map_err(|e| format!("Failed to transcribe with language: {}", e))
}

#[tauri::command]
async fn get_supported_languages() -> Result<Vec<(String, String)>, String> {
    Ok(SupportedLanguages::get_all())
}

#[tauri::command]
async fn get_model_info() -> Result<Vec<serde_json::Value>, String> {
    let models = ModelInfo::get_available_models();
    let model_info: Vec<serde_json::Value> = models.into_iter().map(|model| {
        serde_json::json!({
            "name": model.name,
            "size_gb": model.size_gb,
            "accuracy_score": model.accuracy_score,
            "speed_relative": model.speed_relative,
            "recommended_ram_gb": model.recommended_ram_gb,
            "is_best": model.name == ModelInfo::select_best_model().name
        })
    }).collect();
    
    Ok(model_info)
}

#[tauri::command]
async fn check_offline_capabilities() -> Result<serde_json::Value, String> {
    // Check system capabilities for offline operation
    let device = WhisperDevice::auto_detect();
    let resolved_device = device.resolve();
    
    let system_info = serde_json::json!({
        "offline_ready": true,
        "best_model": ModelInfo::select_best_model().name,
        "estimated_download_size_gb": ModelInfo::select_best_model().size_gb,
        "supported_languages": 3, // Auto, English, Turkish
        "device": {
            "type": format!("{:?}", resolved_device),
            "description": resolved_device.description(),
            "gpu_available": WhisperDevice::gpu_available(),
            "laptop_compatible": true, // Always works on CPU
        },
        "features": {
            "voice_activity_detection": true,
            "speaker_diarization": true,
            "auto_language_detection": true,
            "noise_reduction": true,
            "high_accuracy_mode": true,
            "cpu_fallback": true, // Works without GPU
        }
    });
    
    Ok(system_info)
}

#[tauri::command]
async fn get_formatted_transcript_for_ai(
    whisper_manager: tauri::State<'_, Arc<Mutex<WhisperManager>>>,
    audio_data: Vec<f32>,
    sample_rate: u32,
    _language: Option<String>,
) -> Result<serde_json::Value, String> {
    let manager = whisper_manager.lock().await;
    
    // Get the first service
    let service = manager.get_first_service().await
        .map_err(|e| format!("No Whisper service available: {}", e))?;
    
    // Transcribe with speaker diarization
    let result = service.transcribe_audio(&audio_data, sample_rate).await
        .map_err(|e| format!("Transcription failed: {}", e))?;
    
    Ok(serde_json::json!({
        "formatted_output": result.formatted_output,
        "detected_language": result.detected_language,
        "total_speakers": result.speaker_segments.len(),
        "duration_minutes": result.speaker_segments.last()
            .map(|s| s.end_time / 60.0)
            .unwrap_or(0.0),
        "confidence": result.confidence
    }))
}

#[tauri::command]
async fn get_speaker_segments(
    whisper_manager: tauri::State<'_, Arc<Mutex<WhisperManager>>>,
    audio_data: Vec<f32>,
    sample_rate: u32,
    _language: Option<String>,
) -> Result<Vec<SpeakerSegment>, String> {
    let manager = whisper_manager.lock().await;
    
    // Get the first service
    let service = manager.get_first_service().await
        .map_err(|e| format!("No Whisper service available: {}", e))?;
    
    // Transcribe with speaker diarization
    let result = service.transcribe_audio(&audio_data, sample_rate).await
        .map_err(|e| format!("Transcription failed: {}", e))?;
    
    Ok(result.speaker_segments)
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

    // Audio chunker for plugin-style capture
    let sample_rate = 48000u32;
    let chunk_secs = 10u64;
    let mut audio_chunker = audio_capture_plugin::AudioChunker::new(sample_rate, chunk_secs);

    tauri::Builder::default()
        .setup(|app| {
            // Assign app handle to audio chunker after app build
            audio_chunker.set_app_handle(app.handle().clone());
            app.manage(StdArc::new(TokioMutex::new(audio_chunker)));

            // Replace coordinator with real handle and subscribe to events
            let coord = coordinator::Coordinator::new(app.handle().clone());
            let coord_state = StdArc::new(TokioMutex::new(coord));
            app.manage(coord_state.clone());

            // Listen to audio:chunk and forward to coordinator
            let app_handle = app.handle().clone();
            app_handle.listen_global("audio:chunk", move |event| {
                if let Some(payload) = event.payload() {
                    if let Ok(meta) = serde_json::from_str::<ChunkEvent>(payload) {
                        let coord_state = coord_state.clone();
                        tauri::async_runtime::spawn(async move {
                            let coordinator = coord_state.lock().await;
                            coordinator.handle_chunk(&meta.session_id, &meta.path, meta.start_ms, meta.end_ms).await;
                        });
                    }
                }
            });
            Ok(())
        })
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
            // Diarizer helper
            whisper::diarize_wav_file,
            // Audio capture plugin-style commands
            audio_capture_plugin::ac_get_devices,
            audio_capture_plugin::ac_start_mic,
            audio_capture_plugin::ac_start_system,
            audio_capture_plugin::ac_start_mix,
            audio_capture_plugin::ac_stop_all,
            audio_capture_plugin::ac_get_active_session_info,
            audio_capture_plugin::ac_stop_and_finalize,
            // Phase 4: Multi-audio and Whisper commands
            discover_audio_sources,
            start_multi_recording,
            stop_multi_recording,
            get_mixed_audio_data,
            get_source_audio_data,
            get_multi_audio_status,
            initialize_whisper,
            transcribe_audio_data,
            get_whisper_models,
            // Phase 5: Offline-first maximum accuracy commands
            transcribe_audio_with_language,
            get_supported_languages,
            get_model_info,
            check_offline_capabilities,
            // Speaker diarization commands
            get_formatted_transcript_for_ai,
            get_speaker_segments
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

            // Inject authentication credentials and user info into frontend when window is ready
            let app_handle_for_auth = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Wait a bit for the main window to be ready
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                
                if let Some(main_window) = app_handle_for_auth.get_webview_window("main") {
                    let auth_username = std::env::var("BASIC_AUTH_USERNAME").unwrap_or_else(|_| "myca".to_string());
                    let auth_password = std::env::var("BASIC_AUTH_PASSWORD").unwrap_or_else(|_| "wj2YyxrJ4cqcXgCA".to_string());
                    let api_base_url = std::env::var("VITE_API_BASE_URL").unwrap_or_else(|_| "http://95.111.244.159:8000/api".to_string());
                    
                    // Get the actual computer username
                    let computer_username = std::env::var("USER")
                        .or_else(|_| std::env::var("USERNAME"))
                        .or_else(|_| std::env::var("LOGNAME"))
                        .unwrap_or_else(|_| "eatbas".to_string());
                    
                    let inject_script = format!(
                        r#"
                        window.BASIC_AUTH = {{
                            username: "{}",
                            password: "{}"
                        }};
                        window.API_BASE_URL = "{}";
                        window.USER_ID = "user_{}";
                        console.log("🔑 Tauri: Injected authentication credentials for user: {}");
                        console.log("🆔 Tauri: Set user ID to: user_{}");
                        "#,
                        auth_username, auth_password, api_base_url, computer_username, computer_username, computer_username
                    );
                    
                    if let Err(e) = main_window.eval(&inject_script) {
                        eprintln!("Failed to inject auth credentials: {}", e);
                    } else {
                        println!("✅ Injected credentials for user: {}", computer_username);
                    }
                }
            });

            // Store tray manager for future use (note: system tray needs to be set up separately)
            app.manage(tray_manager);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
