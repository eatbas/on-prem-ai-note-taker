use std::time::Instant;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerformanceMetrics {
    pub audio_capture_latency: f64,
    pub memory_usage: u64,
    pub cpu_usage: f64,
    pub file_operations_time: f64,
}

pub struct PerformanceMonitor {
    start_time: Instant,
    metrics: PerformanceMetrics,
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        Self {
            start_time: Instant::now(),
            metrics: PerformanceMetrics {
                audio_capture_latency: 0.0,
                memory_usage: 0,
                cpu_usage: 0.0,
                file_operations_time: 0.0,
            },
        }
    }

    pub async fn measure_audio_capture(&mut self, operation: impl FnOnce() -> ()) {
        let start = Instant::now();
        operation();
        self.metrics.audio_capture_latency = start.elapsed().as_millis() as f64;
    }

    pub async fn measure_file_operation(&mut self, operation: impl FnOnce() -> ()) {
        let start = Instant::now();
        operation();
        self.metrics.file_operations_time = start.elapsed().as_millis() as f64;
    }

    pub async fn update_system_metrics(&mut self) {
        // Get system memory and CPU usage
        #[cfg(target_os = "windows")]
        {
            self.update_windows_metrics().await;
        }

        #[cfg(target_os = "macos")]
        {
            self.update_macos_metrics().await;
        }

        #[cfg(target_os = "linux")]
        {
            self.update_linux_metrics().await;
        }
    }

    pub fn get_metrics(&self) -> &PerformanceMetrics {
        &self.metrics
    }

    #[cfg(target_os = "windows")]
    async fn update_windows_metrics(&mut self) {
        // Use Windows API to get system metrics
        // Implementation would use winapi crate
        self.metrics.memory_usage = 100 * 1024 * 1024; // Mock 100MB
        self.metrics.cpu_usage = 15.5; // Mock 15.5%
    }

    #[cfg(target_os = "macos")]
    async fn update_macos_metrics(&mut self) {
        // Use macOS system APIs
        self.metrics.memory_usage = 120 * 1024 * 1024; // Mock 120MB
        self.metrics.cpu_usage = 12.3; // Mock 12.3%
    }

    #[cfg(target_os = "linux")]
    async fn update_linux_metrics(&mut self) {
        // Use Linux /proc filesystem
        self.metrics.memory_usage = 90 * 1024 * 1024; // Mock 90MB
        self.metrics.cpu_usage = 18.7; // Mock 18.7%
    }
}
