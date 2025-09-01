"""
🚨 PHASE 3.3: Advanced Rate Limiting System for VPS Protection

This module provides intelligent rate limiting with queue management,
user feedback, and adaptive backoff to prevent VPS overload.
"""

import time
import json
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict, deque

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

class AdvancedRateLimiter:
    """
    Advanced rate limiting system with intelligent queuing and user feedback.
    
    Features:
    - Per-user rate limiting with different tiers
    - Queue position tracking and feedback
    - Adaptive rate limiting based on VPS load
    - Exponential backoff recommendations
    - Memory-aware rate adjustments
    """
    
    def __init__(self):
        # Rate limiting configuration
        self.default_upload_rate = "2/minute"  # 2 uploads per minute per user
        self.premium_upload_rate = "4/minute"  # Premium users get higher limits
        self.burst_upload_rate = "1/10seconds"  # Burst protection
        
        # Queue management
        self.processing_queue = deque()
        self.user_queues = defaultdict(deque)
        self.user_last_request = {}
        self.user_retry_count = defaultdict(int)
        
        # VPS load tracking
        self.vps_load_factor = 1.0  # 1.0 = normal, >1.0 = overloaded
        self.recent_failures = deque(maxlen=10)
        
        # Initialize SlowAPI limiter
        self.limiter = Limiter(
            key_func=self._get_user_identifier,
            default_limits=["100/minute"],  # General API limit
            storage_uri="memory://"  # Use in-memory storage (can be Redis in production)
        )
    
    def _get_user_identifier(self, request: Request) -> str:
        """Get unique identifier for rate limiting (user ID or IP)"""
        # Try to get user ID from headers first
        user_id = request.headers.get("X-User-Id")
        if user_id:
            return f"user:{user_id}"
        
        # Fallback to IP address
        return f"ip:{get_remote_address(request)}"
    
    def _get_user_tier(self, user_identifier: str) -> str:
        """Determine user tier for rate limiting (basic/premium)"""
        # TODO: Implement actual user tier logic based on database
        # For now, all users are basic tier
        return "basic"
    
    def _calculate_dynamic_rate_limit(self, user_tier: str) -> str:
        """Calculate rate limit based on VPS load and user tier"""
        base_rates = {
            "basic": 2,     # 2 uploads per minute
            "premium": 4,   # 4 uploads per minute
        }
        
        base_rate = base_rates.get(user_tier, 2)
        
        # Adjust based on VPS load
        adjusted_rate = max(1, int(base_rate / self.vps_load_factor))
        
        return f"{adjusted_rate}/minute"
    
    def _update_vps_load_factor(self, success: bool, processing_time: float = None):
        """Update VPS load factor based on recent processing results"""
        timestamp = time.time()
        
        if not success:
            self.recent_failures.append(timestamp)
        
        # Calculate failure rate in last 5 minutes
        recent_failures = [t for t in self.recent_failures if timestamp - t < 300]
        failure_rate = len(recent_failures) / 10  # As fraction of recent requests
        
        # Adjust load factor (1.0 = normal, 2.0 = double restriction)
        if failure_rate > 0.5:  # More than 50% failure rate
            self.vps_load_factor = min(3.0, self.vps_load_factor + 0.2)
        elif failure_rate < 0.1:  # Less than 10% failure rate
            self.vps_load_factor = max(0.5, self.vps_load_factor - 0.1)
        
        logger.info(f"📊 VPS load factor updated: {self.vps_load_factor:.2f} (failure rate: {failure_rate:.2f})")
    
    def get_queue_position(self, user_identifier: str) -> Dict[str, Any]:
        """Get current queue position and estimated wait time for user"""
        user_queue = self.user_queues[user_identifier]
        global_position = len(self.processing_queue)
        user_position = len(user_queue)
        
        # Estimate wait time (assuming 2 minutes per request on average)
        estimated_wait_minutes = global_position * 2
        
        return {
            "global_queue_position": global_position,
            "user_queue_position": user_position,
            "estimated_wait_minutes": estimated_wait_minutes,
            "queue_status": "busy" if global_position > 5 else "normal",
            "recommended_action": self._get_recommended_action(global_position, user_identifier)
        }
    
    def _get_recommended_action(self, queue_position: int, user_identifier: str) -> str:
        """Get recommended action for user based on queue status"""
        retry_count = self.user_retry_count[user_identifier]
        
        if queue_position == 0:
            return "proceed"
        elif queue_position <= 2:
            return "wait_short"
        elif queue_position <= 5:
            backoff_time = min(300, 30 * (2 ** retry_count))  # Exponential backoff, max 5 minutes
            return f"wait_long_retry_in_{backoff_time}_seconds"
        else:
            backoff_time = min(900, 60 * (2 ** retry_count))  # Exponential backoff, max 15 minutes
            return f"server_busy_retry_in_{backoff_time}_seconds"
    
    def add_to_queue(self, user_identifier: str, request_type: str = "upload") -> Dict[str, Any]:
        """Add user request to processing queue"""
        timestamp = time.time()
        
        # Add to global queue
        self.processing_queue.append({
            "user": user_identifier,
            "type": request_type,
            "timestamp": timestamp
        })
        
        # Add to user-specific queue
        self.user_queues[user_identifier].append({
            "type": request_type,
            "timestamp": timestamp
        })
        
        # Update user's last request time
        self.user_last_request[user_identifier] = timestamp
        
        queue_info = self.get_queue_position(user_identifier)
        
        logger.info(f"📋 Added to queue: {user_identifier} - Position: {queue_info['global_queue_position']}")
        
        return queue_info
    
    def remove_from_queue(self, user_identifier: str, success: bool = True, processing_time: float = None):
        """Remove user request from queue and update metrics"""
        # Remove from global queue
        self.processing_queue = deque([
            item for item in self.processing_queue 
            if item["user"] != user_identifier
        ])
        
        # Remove from user queue
        if user_identifier in self.user_queues:
            if self.user_queues[user_identifier]:
                self.user_queues[user_identifier].popleft()
        
        # Update retry count
        if success:
            self.user_retry_count[user_identifier] = 0  # Reset on success
        else:
            self.user_retry_count[user_identifier] += 1
        
        # Update VPS load metrics
        self._update_vps_load_factor(success, processing_time)
        
        logger.info(f"📤 Removed from queue: {user_identifier} - Success: {success}")
    
    def check_rate_limit(self, request: Request, endpoint_type: str = "upload") -> Tuple[bool, Dict[str, Any]]:
        """
        Check if request should be rate limited.
        
        Returns:
            (allowed: bool, info: Dict) - Whether request is allowed and additional info
        """
        user_identifier = self._get_user_identifier(request)
        user_tier = self._get_user_tier(user_identifier)
        current_time = time.time()
        
        # Check last request time for minimum interval
        last_request = self.user_last_request.get(user_identifier, 0)
        min_interval = 10  # Minimum 10 seconds between upload requests
        
        if current_time - last_request < min_interval:
            remaining_time = min_interval - (current_time - last_request)
            return False, {
                "error": "rate_limited",
                "message": f"Please wait {remaining_time:.1f} more seconds before next upload",
                "retry_after": remaining_time,
                "type": "too_frequent"
            }
        
        # Check dynamic rate limit
        dynamic_limit = self._calculate_dynamic_rate_limit(user_tier)
        
        # Get queue information
        queue_info = self.get_queue_position(user_identifier)
        
        # Check if VPS is overloaded
        if self.vps_load_factor > 2.0:
            return False, {
                "error": "server_overloaded",
                "message": "VPS is currently overloaded. Please try again later.",
                "retry_after": 300,  # 5 minutes
                "vps_load_factor": self.vps_load_factor,
                "queue_info": queue_info,
                "type": "server_overload"
            }
        
        # Check queue size
        if queue_info["global_queue_position"] > 10:
            backoff_time = min(600, 60 * self.user_retry_count[user_identifier])
            return False, {
                "error": "queue_full",
                "message": f"Processing queue is full. Please try again in {backoff_time//60} minutes.",
                "retry_after": backoff_time,
                "queue_info": queue_info,
                "type": "queue_full"
            }
        
        # Request is allowed
        return True, {
            "allowed": True,
            "user_tier": user_tier,
            "rate_limit": dynamic_limit,
            "queue_info": queue_info,
            "vps_load_factor": self.vps_load_factor
        }
    
    def get_retry_recommendation(self, user_identifier: str, last_error: str = None) -> Dict[str, Any]:
        """Get intelligent retry recommendation with exponential backoff"""
        retry_count = self.user_retry_count[user_identifier]
        base_backoff = 30  # 30 seconds base
        
        # Calculate exponential backoff
        backoff_time = min(900, base_backoff * (2 ** retry_count))  # Max 15 minutes
        
        # Adjust based on error type
        if last_error and "memory" in last_error.lower():
            backoff_time *= 2  # Double backoff for memory issues
        elif last_error and "server_overload" in last_error.lower():
            backoff_time *= 1.5  # 1.5x backoff for server overload
        
        return {
            "retry_count": retry_count,
            "recommended_wait_seconds": backoff_time,
            "recommended_wait_minutes": backoff_time // 60,
            "next_retry_at": datetime.now() + timedelta(seconds=backoff_time),
            "message": self._get_retry_message(backoff_time, retry_count)
        }
    
    def _get_retry_message(self, backoff_time: int, retry_count: int) -> str:
        """Generate user-friendly retry message"""
        minutes = backoff_time // 60
        
        if retry_count == 0:
            return "You can try again immediately."
        elif retry_count <= 2:
            return f"Please wait {minutes} minute{'s' if minutes != 1 else ''} before retrying."
        else:
            return f"Multiple attempts detected. Please wait {minutes} minute{'s' if minutes != 1 else ''} to help reduce server load."


# Global rate limiter instance
rate_limiter = AdvancedRateLimiter()


# Custom rate limit exceeded handler
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded errors"""
    user_identifier = rate_limiter._get_user_identifier(request)
    
    # Get retry recommendation
    retry_info = rate_limiter.get_retry_recommendation(user_identifier)
    queue_info = rate_limiter.get_queue_position(user_identifier)
    
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please slow down.",
            "retry_after": retry_info["recommended_wait_seconds"],
            "retry_info": retry_info,
            "queue_info": queue_info,
            "timestamp": datetime.now().isoformat()
        }
    )


def get_rate_limiter() -> AdvancedRateLimiter:
    """Get the global rate limiter instance"""
    return rate_limiter
