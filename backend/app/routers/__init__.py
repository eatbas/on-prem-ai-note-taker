"""API routers for different endpoint groups"""

from .transcription import router as transcription_router
from .meetings import router as meetings_router
from .admin import router as admin_router
from .workspaces import router as workspaces_router
from .health import router as health_router
from .chat import router as chat_router
from .queue_management import router as queue_router
from .job_management import router as job_router
from .tags import router as tags_router

__all__ = [
    "transcription_router",
    "meetings_router", 
    "admin_router",
    "workspaces_router",
    "health_router",
    "chat_router",
    "queue_router",
    "job_router",
    "tags_router",
]
