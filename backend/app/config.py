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
	whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "auto")
	whisper_download_root: Optional[str] = os.getenv("WHISPER_DOWNLOAD_ROOT")

	# Limits and concurrency
	max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "200"))
	max_concurrency: int = int(os.getenv("MAX_CONCURRENCY", "2"))

	# Logging
	log_level: str = os.getenv("LOG_LEVEL", "INFO")

	# Ollama
	ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
	ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
	ollama_timeout_seconds: int = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))

	# Basic Auth (optional; if both empty, auth is disabled)
	basic_auth_username: str = os.getenv("BASIC_AUTH_USERNAME", "")
	basic_auth_password: str = os.getenv("BASIC_AUTH_PASSWORD", "")

	# Redis Queue System
	redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
	queue_max_workers: int = int(os.getenv("QUEUE_MAX_WORKERS", "3"))
	use_queue_system: bool = os.getenv("USE_QUEUE_SYSTEM", "true").lower() == "true"


settings = Settings()


