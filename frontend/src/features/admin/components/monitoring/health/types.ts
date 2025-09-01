export interface SystemHealth {
  vps: {
    status: 'healthy' | 'warning' | 'critical'
    cpu_usage: number
    memory_usage: number
    disk_usage: number
    response_time: number
  }
  redis: {
    status: 'connected' | 'disconnected'
    memory_usage: number
    connected_clients: number
    queue_length: number
  }
  celery: {
    status: 'healthy' | 'warning' | 'critical'
    active_workers: number
    pending_tasks: number
    failed_tasks_24h: number
    avg_task_duration: number
  }
  whisper: {
    model_loaded: boolean
    memory_usage_mb: number
    processing_queue: number
    avg_processing_time: number
  }
  speaker_intelligence: {
    total_meetings_processed: number
    enhanced_summaries_count: number
    avg_speaker_count: number
    accuracy_score: number
  }
}

export interface PerformanceMetrics {
  meeting_processing: {
    avg_duration_minutes: number
    success_rate: number
    throughput_per_hour: number
  }
  frontend: {
    dashboard_load_time: number
    search_response_time: number
    ui_responsiveness_score: number
  }
  audio_streaming: {
    avg_startup_time: number
    buffer_health: number
    stream_quality: 'excellent' | 'good' | 'fair' | 'poor'
  }
}


