import os
from typing import Optional

# Load centralized environment variables from root .env file
from .env_loader import load_root_env
load_root_env()


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

	whisper_beam_size: int = int(os.getenv("WHISPER_BEAM_SIZE", "1"))  # Beam size for CPU optimization
	whisper_best_of: int = int(os.getenv("WHISPER_BEST_OF", "3"))
	whisper_temperature: float = float(os.getenv("WHISPER_TEMPERATURE", "0.0"))
	whisper_condition_on_previous_text: bool = os.getenv("WHISPER_CONDITION_ON_PREVIOUS_TEXT", "true").lower() == "true"
	whisper_word_timestamps: bool = os.getenv("WHISPER_WORD_TIMESTAMPS", "false").lower() == "true"
	whisper_vad_min_silence_ms: int = int(os.getenv("WHISPER_VAD_MIN_SILENCE_MS", "500"))
	whisper_vad_speech_pad_ms: int = int(os.getenv("WHISPER_VAD_SPEECH_PAD_MS", "100"))
	whisper_initial_prompt: Optional[str] = os.getenv("WHISPER_INITIAL_PROMPT", None)
	whisper_log_prob_threshold: float = float(os.getenv("WHISPER_LOG_PROB_THRESHOLD", "-1.0"))
	whisper_compression_ratio_threshold: float = float(os.getenv("WHISPER_COMPRESSION_RATIO_THRESHOLD", "2.4"))
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
	ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
	ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct")
	ollama_timeout_seconds: int = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "3600"))
	
	# Ollama VPS Optimizations
	ollama_cpu_threads: int = int(os.getenv("OLLAMA_CPU_THREADS", "6"))
	ollama_memory_limit_gb: int = int(os.getenv("OLLAMA_MEMORY_LIMIT_GB", "16"))

	# Basic Auth (optional; if both empty, auth is disabled)
	basic_auth_username: str = os.getenv("BASIC_AUTH_USERNAME", "")
	basic_auth_password: str = os.getenv("BASIC_AUTH_PASSWORD", "")

	# Redis Queue System
	redis_url: str = os.getenv("REDIS_URL", "redis://redis:6385")
	queue_max_workers: int = int(os.getenv("QUEUE_MAX_WORKERS", "2"))
	use_queue_system: bool = os.getenv("USE_QUEUE_SYSTEM", "true").lower() == "true"
	
	# Performance optimizations
	max_text_length: int = int(os.getenv("MAX_TEXT_LENGTH", "4000"))
	enable_model_caching: bool = os.getenv("ENABLE_MODEL_CACHING", "true").lower() == "true"

	# Audio chunking (for backend processing)
	chunk_duration_seconds: int = int(os.getenv("CHUNK_DURATION_SECONDS", "45"))
	chunk_overlap_seconds: int = int(os.getenv("CHUNK_OVERLAP_SECONDS", "8"))
	
	# Enhanced speaker identification settings
	enable_speaker_identification: bool = os.getenv("ENABLE_SPEAKER_IDENTIFICATION", "true").lower() == "true"
	max_speakers: int = int(os.getenv("MAX_SPEAKERS", "6"))
	speaker_change_threshold_ms: int = int(os.getenv("SPEAKER_CHANGE_THRESHOLD_MS", "800"))
	speaker_similarity_threshold: float = float(os.getenv("SPEAKER_SIMILARITY_THRESHOLD", "0.7"))
	
	# Progress Tracking
	enable_progress_tracking: bool = os.getenv("ENABLE_PROGRESS_TRACKING", "true").lower() == "true"
	progress_update_interval_ms: int = int(os.getenv("PROGRESS_UPDATE_INTERVAL_MS", "500"))
	
	# Audio Preprocessing Optimizations (Stage 1)
	enable_audio_normalization: bool = os.getenv("ENABLE_AUDIO_NORMALIZATION", "true").lower() == "true"
	audio_normalization_timeout: int = int(os.getenv("AUDIO_NORMALIZATION_TIMEOUT", "120"))  # seconds
	
	# Enhanced VAD Settings (Stage 1) - 5-10% accuracy improvement
	enhanced_vad_enabled: bool = os.getenv("ENHANCED_VAD_ENABLED", "true").lower() == "true"
	vad_aggressiveness: int = int(os.getenv("VAD_AGGRESSIVENESS", "2"))  # 0-3, higher = more aggressive
	vad_frame_duration: int = int(os.getenv("VAD_FRAME_DURATION", "30"))  # ms, 10, 20, or 30
	
	# Hierarchical Summarization (Stage 2) - 40-60% quality improvement
	enable_hierarchical_summarization: bool = os.getenv("ENABLE_HIERARCHICAL_SUMMARIZATION", "true").lower() == "true"
	hierarchical_chunk_size: int = int(os.getenv("HIERARCHICAL_CHUNK_SIZE", "4000"))  # characters
	hierarchical_max_chunks: int = int(os.getenv("HIERARCHICAL_MAX_CHUNKS", "20"))  # max chunks to process
	
	# Schema-first JSON Output (Stage 3) - 25-40% actionable content improvement
	enable_schema_first_json: bool = os.getenv("ENABLE_SCHEMA_FIRST_JSON", "true").lower() == "true"
	json_validation_strict: bool = os.getenv("JSON_VALIDATION_STRICT", "false").lower() == "true"
	json_retry_attempts: int = int(os.getenv("JSON_RETRY_ATTEMPTS", "2"))  # retries for invalid JSON
	enable_sse: bool = os.getenv("ENABLE_SSE", "true").lower() == "true"


settings = Settings()


