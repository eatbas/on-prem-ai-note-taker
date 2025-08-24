import os
from typing import Optional


class Settings:
	"""Application settings loaded from environment variables."""

	# Server
	app_host: str = os.getenv("APP_HOST", "0.0.0.0")
	app_port: int = int(os.getenv("APP_PORT", "8000"))

	# CORS
	allowed_origins: list[str] = [
		origin.strip()
		for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
		if origin.strip()
	]

	# Transcription
	whisper_model_name: str = os.getenv("WHISPER_MODEL", "base")
	whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
	whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu")  # Force CPU for VPS
	whisper_cpu_threads: int = int(os.getenv("WHISPER_CPU_THREADS", "6"))  # Optimize for 6 vCPU
	whisper_memory_limit_gb: int = int(os.getenv("WHISPER_MEMORY_LIMIT_GB", "16"))  # Leave 2GB for system
	whisper_beam_size: int = int(os.getenv("WHISPER_BEAM_SIZE", "1"))  # Beam size for CPU optimization
	whisper_download_root: str = os.getenv("WHISPER_DOWNLOAD_ROOT", "./models")
	
	# Language Restrictions
	allowed_languages: list[str] = [
		lang.strip().lower() 
		for lang in os.getenv("ALLOWED_LANGUAGES", "tr,en,auto").split(",")
		if lang.strip()
	]
	force_language_validation: bool = os.getenv("FORCE_LANGUAGE_VALIDATION", "true").lower() == "true"

	# Limits and concurrency
	max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "200"))
	max_concurrency: int = int(os.getenv("MAX_CONCURRENCY", "2"))

	# Logging
	log_level: str = os.getenv("LOG_LEVEL", "INFO")

	# Ollama
	ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
	ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
	ollama_timeout_seconds: int = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))
	
	# Ollama VPS Optimizations
	ollama_cpu_threads: int = int(os.getenv("OLLAMA_CPU_THREADS", "6"))
	ollama_memory_limit_gb: int = int(os.getenv("OLLAMA_MEMORY_LIMIT_GB", "16"))

	# Basic Auth (optional; if both empty, auth is disabled)
	basic_auth_username: str = os.getenv("BASIC_AUTH_USERNAME", "")
	basic_auth_password: str = os.getenv("BASIC_AUTH_PASSWORD", "")

	# Redis Queue System
	redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
	queue_max_workers: int = int(os.getenv("QUEUE_MAX_WORKERS", "2"))
	use_queue_system: bool = os.getenv("USE_QUEUE_SYSTEM", "true").lower() == "true"
	
	# Performance optimizations
	max_text_length: int = int(os.getenv("MAX_TEXT_LENGTH", "4000"))
	enable_model_caching: bool = os.getenv("ENABLE_MODEL_CACHING", "true").lower() == "true"
	
	# Progress Tracking
	enable_progress_tracking: bool = os.getenv("ENABLE_PROGRESS_TRACKING", "true").lower() == "true"
	progress_update_interval_ms: int = int(os.getenv("PROGRESS_UPDATE_INTERVAL_MS", "500"))
	enable_sse: bool = os.getenv("ENABLE_SSE", "true").lower() == "true"


settings = Settings()


