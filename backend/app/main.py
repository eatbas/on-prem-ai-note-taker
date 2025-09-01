"""
dgMeets - Main FastAPI Application

This is a clean, organized main application file that follows best practices.
All business logic has been extracted to dedicated modules and routers.
"""

import asyncio
import logging
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.rate_limiter import rate_limiter, custom_rate_limit_handler
from slowapi.errors import RateLimitExceeded
from .models import JobType
from .workers.job_manager import job_manager
from .workers.queue_manager import queue_manager
from .routers import (
    health_router,
    transcription_router,
    chat_router,
    meetings_router,
    admin_router,
    workspaces_router,
    queue_router,
    job_router,
    progress_router,
    tags_router,
)
from .api import router as jobs_router  # Keep the existing jobs router
from .workers.job_handlers import (
    handle_transcription_job,
    handle_summarization_job, 
    handle_transcribe_and_summarize_job,
    handle_transcription_task,
    handle_summarization_task,
    handle_transcribe_and_summarize_task,
)

# Initialize FastAPI app
app = FastAPI(
    title="dgMeets", 
    version="1.0.0",
    description="AI-powered meeting transcription and summarization service 🎙️✨"
)

# 🚨 PHASE 3.3: Add rate limiting middleware
app.state.limiter = rate_limiter.limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)

# Configure logging
_level = getattr(logging, settings.log_level.upper(), logging.INFO)
logging.basicConfig(level=_level)
logger = logging.getLogger("dgmeets")


# Configure CORS
# If wildcard is requested, use regex so it works with allow_credentials=True
allow_origin_regex = None
if settings.allowed_origins == ["*"]:
    allow_origins = []  # required when using allow_origin_regex
    allow_origin_regex = ".*"
else:
    allow_origins = settings.allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(health_router)
app.include_router(transcription_router)
app.include_router(chat_router)
app.include_router(meetings_router)
app.include_router(admin_router)
app.include_router(workspaces_router)
app.include_router(tags_router)
app.include_router(queue_router)
app.include_router(job_router)
app.include_router(progress_router)
app.include_router(jobs_router)  # Keep existing jobs router for compatibility


@app.on_event("startup")
async def startup_event():
    """Initialize queue manager and register handlers with resource optimization"""
    
    # Initialize database tables
    from .database import init_db
    init_db()
    
    # Optimize for 6 CPU / 16GB RAM constraints
    import os
    import torch
    
    # Set global CPU optimization
    if torch.cuda.is_available():
        logger.info("🚀 GPU detected for acceleration")
    else:
        logger.info("💻 CPU-only mode: Optimizing for 6 CPU cores, 16GB RAM")
        torch.set_num_threads(6)  # Global PyTorch thread limit
        os.environ['OMP_NUM_THREADS'] = '6'  # OpenMP optimization
        os.environ['MKL_NUM_THREADS'] = '6'  # Intel MKL optimization
        logger.info("🔧 Global CPU optimization applied: 6 threads for PyTorch/OpenMP/MKL")
    
    if settings.use_queue_system:
        # Configure queue manager
        queue_manager.redis_url = settings.redis_url
        queue_manager.max_workers = settings.queue_max_workers
        
        # Register task handlers
        queue_manager.register_handler("transcription", handle_transcription_task)
        queue_manager.register_handler("summarization", handle_summarization_task)
        queue_manager.register_handler("transcribe_and_summarize", handle_transcribe_and_summarize_task)
        
        # Initialize queue manager
        await queue_manager.initialize()
        logger.info("Queue management system initialized")
    
    # Initialize job manager and register handlers
    job_manager.register_handler(JobType.TRANSCRIPTION, handle_transcription_job)
    job_manager.register_handler(JobType.SUMMARIZATION, handle_summarization_job)
    job_manager.register_handler(JobType.TRANSCRIBE_AND_SUMMARIZE, handle_transcribe_and_summarize_job)
    logger.info("Job management system initialized")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup queue manager and job manager"""
    if settings.use_queue_system:
        await queue_manager.stop_workers()
        logger.info("Queue management system stopped")
    
    # Cleanup job manager
    await job_manager.cleanup_completed_jobs()
    logger.info("Job management system stopped")


# Root endpoint
@app.get("/")
def read_root() -> Dict[str, Any]:
    """Welcome message and API information"""
    return {
        "message": "🎙️ Welcome to dgMeets! ✨",
        "version": "1.0.0",
        "description": "AI-powered meeting transcription and summarization service",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "features": [
            "🎯 Audio transcription with Whisper",
            "📝 AI-powered summarization with Ollama", 
            "📊 Meeting management",
            "🏷️ Tag organization",
            "⚡ Real-time progress tracking",
            "🔐 Basic authentication",
            "🚀 Queue-based processing",
        ]
    }
