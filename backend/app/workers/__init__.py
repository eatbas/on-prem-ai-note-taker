"""Background workers and job processing"""

from .job_manager import job_manager, JobPhase
from .queue_manager import queue_manager
from .progress import job_store, Phase
from .chunked_service import chunked_service
from .job_handlers import (
    handle_transcription_job,
    handle_summarization_job,
    handle_transcribe_and_summarize_job,
    handle_transcription_task,
    handle_summarization_task,
    handle_transcribe_and_summarize_task,
)

__all__ = [
    "job_manager",
    "JobPhase",
    "queue_manager", 
    "job_store",
    "Phase",
    "chunked_service",
    "handle_transcription_job",
    "handle_summarization_job",
    "handle_transcribe_and_summarize_job",
    "handle_transcription_task",
    "handle_summarization_task",
    "handle_transcribe_and_summarize_task",
]
