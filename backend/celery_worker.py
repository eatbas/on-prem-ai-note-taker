#!/usr/bin/env python3
"""
🚨 PHASE 3.4: Celery Worker Startup Script

Production-ready Celery worker with optimized settings for 6 CPU, 16GB RAM VPS.
Handles meeting audio processing with automatic memory management and job recovery.

Usage:
    python celery_worker.py
    
Environment Variables:
    CELERY_LOG_LEVEL=INFO
    CELERY_CONCURRENCY=3
    REDIS_URL=redis://localhost:6379/0
"""

import os
import sys
import signal
import logging
from pathlib import Path

# Add the app directory to Python path
app_dir = Path(__file__).parent / "app"
sys.path.insert(0, str(app_dir))

from app.core.celery_app import celery_app
from app.core.config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv("CELERY_LOG_LEVEL", "INFO")),
    format='[%(asctime)s: %(levelname)s/%(name)s] %(message)s'
)

logger = logging.getLogger(__name__)

def start_worker():
    """Start Celery worker with optimized settings"""
    
    # Worker configuration optimized for VPS specs
    concurrency = int(os.getenv("CELERY_CONCURRENCY", "3"))  # 3 workers for 6 CPU cores
    log_level = os.getenv("CELERY_LOG_LEVEL", "INFO")
    
    logger.info("🚀 Starting dgMeets Celery Worker...")
    logger.info(f"📊 Configuration:")
    logger.info(f"   - Concurrency: {concurrency} workers")
    logger.info(f"   - Log Level: {log_level}")
    logger.info(f"   - Redis URL: {settings.redis_url}")
    logger.info(f"   - Queues: audio_processing, cleanup, monitoring")
    
    # Celery worker arguments
    worker_args = [
        "worker",
        "--app=app.core.celery_app:celery_app",
        f"--concurrency={concurrency}",
        f"--loglevel={log_level}",
        "--queues=audio_processing,cleanup,monitoring",
        "--hostname=dgmeets-worker@%h",
        "--max-tasks-per-child=50",     # Restart worker after 50 tasks
        "--max-memory-per-child=4000",  # ~4GB memory limit per child
        "--optimization=fair",
        "--prefetch-multiplier=2",      # Conservative prefetch
        "--without-gossip",             # Disable gossip for performance
        "--without-mingle",             # Disable mingle for faster startup
        "--without-heartbeat",          # Disable heartbeat for performance
    ]
    
    # 🚨 PHASE 3.4: Add production optimizations
    if os.getenv("CELERY_PRODUCTION", "false").lower() == "true":
        worker_args.extend([
            "--time-limit=2100",        # 35 minute hard timeout
            "--soft-time-limit=1800",   # 30 minute soft timeout
            "--max-tasks-per-child=30", # More conservative in production
        ])
        logger.info("🏭 Production mode enabled")
    
    # Handle graceful shutdown
    def signal_handler(signum, frame):
        logger.info(f"🛑 Received signal {signum}, shutting down gracefully...")
        celery_app.control.shutdown()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Start the worker
        celery_app.worker_main(worker_args)
        
    except KeyboardInterrupt:
        logger.info("🛑 Worker interrupted by user")
    except Exception as e:
        logger.error(f"❌ Worker startup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    start_worker()
