"""
🚨 PHASE 3.4: Celery Application Configuration

Production-grade job queue system with Redis backend for reliable
meeting processing, job persistence, and distributed worker support.
"""

import os
import logging
from celery import Celery
from celery.signals import setup_logging
from kombu import Queue

from .config import settings

logger = logging.getLogger(__name__)

# Create Celery application
celery_app = Celery(
    "dgmeets_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.celery_tasks"
    ]
)

# Celery Configuration
celery_app.conf.update(
    # Task routing and queues
    task_routes={
        "app.workers.celery_tasks.process_meeting_audio_celery": {
            "queue": "audio_processing"
        },
        "app.workers.celery_tasks.cleanup_temp_files": {
            "queue": "cleanup"
        },
        "app.workers.celery_tasks.health_check": {
            "queue": "monitoring"
        },
    },
    
    # Define queues with priorities
    task_queues=(
        Queue("audio_processing", routing_key="audio_processing", priority=10),
        Queue("cleanup", routing_key="cleanup", priority=5),
        Queue("monitoring", routing_key="monitoring", priority=1),
    ),
    
    # Task execution settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Worker optimization for 6 CPU, 16GB RAM
    worker_prefetch_multiplier=2,  # Conservative prefetch for memory management
    task_acks_late=True,           # Acknowledge tasks only after completion
    worker_disable_rate_limits=False,
    
    # Task timeouts and retries
    task_soft_time_limit=1800,     # 30 minutes soft limit
    task_time_limit=2100,          # 35 minutes hard limit
    task_max_retries=3,
    task_default_retry_delay=300,  # 5 minutes between retries
    
    # Result backend settings
    result_expires=3600,           # Results expire after 1 hour
    result_backend_transport_options={
        "master_name": "mymaster"
    },
    
    # Memory and performance settings
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks to prevent memory leaks
    worker_max_memory_per_child=4000000,  # ~4GB per worker (allowing 4 workers on 16GB)
    
    # Monitoring and logging
    worker_send_task_events=True,
    task_send_sent_event=True,
    
    # 🚨 PHASE 3.4: Custom retry configuration for meeting processing
    task_annotations={
        "app.workers.celery_tasks.process_meeting_audio_celery": {
            "rate_limit": "2/m",  # Max 2 audio processing tasks per minute
            "max_retries": 2,
            "default_retry_delay": 600,  # 10 minutes for audio processing retries
        }
    }
)

# Configure logging
@setup_logging.connect
def config_loggers(*args, **kwargs):
    """Configure logging for Celery workers"""
    from logging.config import dictConfig
    
    dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "[%(asctime)s: %(levelname)s/%(processName)s] %(message)s",
            },
        },
        "handlers": {
            "console": {
                "level": "INFO",
                "class": "logging.StreamHandler",
                "formatter": "default",
            },
        },
        "root": {
            "level": "INFO",
            "handlers": ["console"],
        },
        "loggers": {
            "celery": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
            "app": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
        },
    })

# Health check for monitoring worker status
@celery_app.task(bind=True, name="health_check")
def health_check(self):
    """Simple health check task for monitoring"""
    return {"status": "healthy", "worker_id": self.request.id}

# 🚨 PHASE 3.4: Enhanced task state tracking
class TaskState:
    """Enhanced task state management"""
    PENDING = "PENDING"
    STARTED = "STARTED" 
    PROGRESS = "PROGRESS"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    RETRY = "RETRY"
    REVOKED = "REVOKED"

# Custom task base class with enhanced tracking
from celery import Task

class CallbackTask(Task):
    """Base task class with enhanced progress tracking and callbacks"""
    
    def on_success(self, retval, task_id, args, kwargs):
        """Called when task succeeds"""
        logger.info(f"✅ Task {task_id} completed successfully")
        
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails"""
        logger.error(f"❌ Task {task_id} failed: {exc}")
        
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Called when task is retried"""
        logger.warning(f"🔄 Task {task_id} retrying: {exc}")

# Set default task base class
celery_app.Task = CallbackTask

# Worker startup/shutdown hooks
from celery.signals import worker_process_init as celery_worker_init

@celery_worker_init.connect
def worker_process_init(sender=None, conf=None, **kwargs):
    """Initialize worker process"""
    logger.info("🚀 Celery worker process starting...")
    
    # Initialize memory manager for this worker
    try:
        from ..core.memory_manager import memory_manager
        memory_manager.monitor_memory_usage()
        logger.info("💾 Memory manager initialized for worker")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize memory manager: {e}")

from celery.signals import worker_process_shutdown as celery_worker_shutdown

@celery_worker_shutdown.connect
def worker_process_shutdown(sender=None, conf=None, **kwargs):
    """Cleanup on worker shutdown"""
    logger.info("🛑 Celery worker process shutting down...")
    
    # Cleanup resources
    try:
        from ..core.memory_manager import memory_manager
        memory_manager.cleanup_whisper_model(force=True)
        logger.info("🧹 Worker cleanup completed")
    except Exception as e:
        logger.warning(f"⚠️ Worker cleanup error: {e}")

def get_celery_app() -> Celery:
    """Get the configured Celery application"""
    return celery_app
