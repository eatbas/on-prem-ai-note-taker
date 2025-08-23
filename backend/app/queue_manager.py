"""Queue management system using Redis for handling concurrent AI processing requests"""

import asyncio
import json
import logging
import time
import uuid
from typing import Any, Dict, Optional, Callable
from dataclasses import dataclass

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class QueueTask:
    """Represents a task in the processing queue"""
    task_id: str
    task_type: str  # 'transcription', 'summarization', 'transcribe_and_summarize'
    user_id: str
    data: Dict[str, Any]
    created_at: float
    priority: int = 0  # Higher numbers = higher priority


class QueueManager:
    """Manages AI processing requests using Redis as a queue backend"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379", max_workers: int = 3):
        self.redis_url = redis_url
        self.max_workers = max_workers
        self.redis_client: Optional[redis.Redis] = None
        self.workers: list[asyncio.Task] = []
        self.is_running = False
        self.task_handlers: Dict[str, Callable] = {}
        
        # Queue names
        self.pending_queue = "ai_tasks:pending"
        self.processing_queue = "ai_tasks:processing"
        self.completed_queue = "ai_tasks:completed"
        self.failed_queue = "ai_tasks:failed"
        
        # Task status tracking
        self.task_status_prefix = "task_status:"
        self.task_result_prefix = "task_result:"
        
    async def initialize(self):
        """Initialize Redis connection and start workers"""
        if not REDIS_AVAILABLE:
            logger.warning("Redis not available. Queue system will run in fallback mode.")
            return
            
        try:
            self.redis_client = redis.from_url(self.redis_url)
            await self.redis_client.ping()
            logger.info(f"Connected to Redis at {self.redis_url}")
            
            # Start worker tasks
            await self.start_workers()
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis queue: {e}")
            self.redis_client = None
    
    async def start_workers(self):
        """Start background worker tasks"""
        if not self.redis_client:
            return
            
        self.is_running = True
        self.workers = []
        
        for i in range(self.max_workers):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self.workers.append(worker)
            
        logger.info(f"Started {self.max_workers} queue workers")
    
    async def stop_workers(self):
        """Stop all worker tasks"""
        self.is_running = False
        
        for worker in self.workers:
            worker.cancel()
            
        if self.workers:
            await asyncio.gather(*self.workers, return_exceptions=True)
            
        logger.info("Stopped all queue workers")
    
    def register_handler(self, task_type: str, handler: Callable):
        """Register a handler function for a specific task type"""
        self.task_handlers[task_type] = handler
        logger.info(f"Registered handler for task type: {task_type}")
    
    async def enqueue_task(self, task_type: str, user_id: str, data: Dict[str, Any], priority: int = 0) -> str:
        """Add a task to the processing queue"""
        task_id = str(uuid.uuid4())
        
        task = QueueTask(
            task_id=task_id,
            task_type=task_type,
            user_id=user_id,
            data=data,
            created_at=time.time(),
            priority=priority
        )
        
        if self.redis_client:
            # Use Redis queue
            task_data = {
                "task_id": task.task_id,
                "task_type": task.task_type,
                "user_id": task.user_id,
                "data": task.data,
                "created_at": task.created_at,
                "priority": task.priority
            }
            
            # Add to pending queue with priority (higher score = higher priority)
            await self.redis_client.zadd(self.pending_queue, {json.dumps(task_data): -priority})
            
            # Set initial status
            await self.redis_client.setex(
                f"{self.task_status_prefix}{task_id}",
                3600,  # 1 hour TTL
                json.dumps({"status": "pending", "created_at": task.created_at})
            )
            
            logger.info(f"Enqueued task {task_id} of type {task_type} for user {user_id}")
        else:
            # Fallback: process immediately without queue
            logger.warning(f"Redis unavailable, processing task {task_id} immediately")
            await self._process_task_fallback(task)
            
        return task_id
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get the current status of a task"""
        if not self.redis_client:
            return {"status": "completed", "message": "Processed without queue"}
            
        status_data = await self.redis_client.get(f"{self.task_status_prefix}{task_id}")
        if status_data:
            return json.loads(status_data)
        return None
    
    async def get_task_result(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get the result of a completed task"""
        if not self.redis_client:
            return None
            
        result_data = await self.redis_client.get(f"{self.task_result_prefix}{task_id}")
        if result_data:
            return json.loads(result_data)
        return None
    
    async def get_queue_stats(self) -> Dict[str, int]:
        """Get statistics about the queue"""
        if not self.redis_client:
            return {"pending": 0, "processing": 0, "completed": 0, "failed": 0}
            
        stats = {
            "pending": await self.redis_client.zcard(self.pending_queue),
            "processing": await self.redis_client.llen(self.processing_queue),
            "completed": await self.redis_client.llen(self.completed_queue),
            "failed": await self.redis_client.llen(self.failed_queue),
        }
        
        return stats
    
    async def _worker(self, worker_name: str):
        """Background worker that processes tasks from the queue"""
        logger.info(f"Worker {worker_name} started")
        
        while self.is_running:
            try:
                # Get highest priority task from pending queue
                task_data = await self.redis_client.bzpopmax(self.pending_queue, timeout=1)
                
                if not task_data:
                    continue
                    
                # Parse task data
                _, task_json, _ = task_data
                task_info = json.loads(task_json)
                
                task = QueueTask(
                    task_id=task_info["task_id"],
                    task_type=task_info["task_type"],
                    user_id=task_info["user_id"],
                    data=task_info["data"],
                    created_at=task_info["created_at"],
                    priority=task_info["priority"]
                )
                
                logger.info(f"Worker {worker_name} processing task {task.task_id}")
                
                # Move to processing queue
                await self.redis_client.lpush(self.processing_queue, task_json)
                
                # Update status
                await self.redis_client.setex(
                    f"{self.task_status_prefix}{task.task_id}",
                    3600,
                    json.dumps({
                        "status": "processing",
                        "worker": worker_name,
                        "started_at": time.time()
                    })
                )
                
                # Process the task
                result = await self._process_task(task)
                
                # Remove from processing queue
                await self.redis_client.lrem(self.processing_queue, 1, task_json)
                
                if result.get("success"):
                    # Move to completed queue
                    await self.redis_client.lpush(self.completed_queue, task_json)
                    
                    # Store result
                    await self.redis_client.setex(
                        f"{self.task_result_prefix}{task.task_id}",
                        3600,
                        json.dumps(result["data"])
                    )
                    
                    # Update status
                    await self.redis_client.setex(
                        f"{self.task_status_prefix}{task.task_id}",
                        3600,
                        json.dumps({
                            "status": "completed",
                            "completed_at": time.time()
                        })
                    )
                    
                    logger.info(f"Worker {worker_name} completed task {task.task_id}")
                else:
                    # Move to failed queue
                    await self.redis_client.lpush(self.failed_queue, task_json)
                    
                    # Update status
                    await self.redis_client.setex(
                        f"{self.task_status_prefix}{task.task_id}",
                        3600,
                        json.dumps({
                            "status": "failed",
                            "error": result.get("error", "Unknown error"),
                            "failed_at": time.time()
                        })
                    )
                    
                    logger.error(f"Worker {worker_name} failed to process task {task.task_id}: {result.get('error')}")
                
            except asyncio.CancelledError:
                logger.info(f"Worker {worker_name} cancelled")
                break
            except Exception as e:
                logger.error(f"Worker {worker_name} error: {e}")
                await asyncio.sleep(1)  # Brief pause before retrying
        
        logger.info(f"Worker {worker_name} stopped")
    
    async def _process_task(self, task: QueueTask) -> Dict[str, Any]:
        """Process a single task using the registered handler"""
        try:
            handler = self.task_handlers.get(task.task_type)
            if not handler:
                return {
                    "success": False,
                    "error": f"No handler registered for task type: {task.task_type}"
                }
            
            # Call the handler
            result = await handler(task.data)
            
            return {
                "success": True,
                "data": result
            }
            
        except Exception as e:
            logger.error(f"Error processing task {task.task_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _process_task_fallback(self, task: QueueTask):
        """Process task immediately when Redis is not available"""
        try:
            handler = self.task_handlers.get(task.task_type)
            if handler:
                await handler(task.data)
                logger.info(f"Processed task {task.task_id} in fallback mode")
            else:
                logger.error(f"No handler for task type {task.task_type}")
        except Exception as e:
            logger.error(f"Fallback processing failed for task {task.task_id}: {e}")


# Global queue manager instance
queue_manager = QueueManager()
