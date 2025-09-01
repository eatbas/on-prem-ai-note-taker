"""
Emergency Memory Management System for VPS Performance

This module provides critical memory management to prevent VPS freezing
during Whisper model processing and large audio file handling.
"""

import gc
import os
import psutil
import logging
import time
from typing import Optional, Dict, Any
from functools import wraps
import threading

logger = logging.getLogger(__name__)

class MemoryManager:
    """
    Emergency memory management system to prevent VPS crashes.
    
    Features:
    - Real-time memory monitoring
    - Automatic garbage collection
    - Whisper model cleanup
    - Memory threshold alerts
    - Process resource tracking
    """
    
    def __init__(self):
        self.process = psutil.Process()
        self.whisper_model_instance = None
        self.memory_threshold_mb = 12000  # 12GB threshold for 16GB VPS
        self.critical_threshold_mb = 14000  # 14GB critical threshold
        self.monitoring_enabled = True
        self._lock = threading.Lock()
        
        # Memory usage tracking
        self.memory_stats = {
            'peak_usage_mb': 0,
            'current_usage_mb': 0,
            'model_loaded_at': None,
            'last_cleanup_at': None,
            'cleanup_count': 0
        }
    
    def get_memory_usage(self) -> Dict[str, Any]:
        """Get current memory usage statistics."""
        try:
            # System memory info
            system_mem = psutil.virtual_memory()
            
            # Process memory info
            process_mem = self.process.memory_info()
            process_percent = self.process.memory_percent()
            
            current_mb = process_mem.rss / 1024 / 1024
            
            # Update tracking
            self.memory_stats['current_usage_mb'] = current_mb
            if current_mb > self.memory_stats['peak_usage_mb']:
                self.memory_stats['peak_usage_mb'] = current_mb
            
            return {
                'system': {
                    'total_mb': system_mem.total / 1024 / 1024,
                    'available_mb': system_mem.available / 1024 / 1024,
                    'used_mb': system_mem.used / 1024 / 1024,
                    'percent': system_mem.percent
                },
                'process': {
                    'rss_mb': current_mb,
                    'vms_mb': process_mem.vms / 1024 / 1024,
                    'percent': process_percent,
                    'peak_mb': self.memory_stats['peak_usage_mb']
                },
                'thresholds': {
                    'warning_mb': self.memory_threshold_mb,
                    'critical_mb': self.critical_threshold_mb,
                    'is_warning': current_mb > self.memory_threshold_mb,
                    'is_critical': current_mb > self.critical_threshold_mb
                }
            }
        except Exception as e:
            logger.error(f"Failed to get memory usage: {e}")
            return {}
    
    def check_memory_pressure(self) -> bool:
        """Check if system is under memory pressure."""
        try:
            memory_info = self.get_memory_usage()
            current_mb = memory_info.get('process', {}).get('rss_mb', 0)
            
            if current_mb > self.critical_threshold_mb:
                logger.error(f"🚨 CRITICAL: Memory usage {current_mb:.1f}MB exceeds critical threshold {self.critical_threshold_mb}MB")
                return True
            elif current_mb > self.memory_threshold_mb:
                logger.warning(f"⚠️ WARNING: Memory usage {current_mb:.1f}MB exceeds threshold {self.memory_threshold_mb}MB")
                return True
            
            return False
        except Exception as e:
            logger.error(f"Failed to check memory pressure: {e}")
            return False
    
    def register_whisper_model(self, model_instance):
        """Register Whisper model instance for cleanup tracking."""
        with self._lock:
            self.whisper_model_instance = model_instance
            self.memory_stats['model_loaded_at'] = time.time()
            logger.info(f"📝 Whisper model registered for cleanup tracking")
    
    def cleanup_whisper_model(self, force: bool = False) -> bool:
        """
        Clean up Whisper model from memory.
        
        Args:
            force: Force cleanup even if not under memory pressure
            
        Returns:
            bool: True if cleanup was performed
        """
        try:
            with self._lock:
                if self.whisper_model_instance is None and not force:
                    logger.debug("No Whisper model to cleanup")
                    return False
                
                # Get memory usage before cleanup
                before_mb = self.get_memory_usage().get('process', {}).get('rss_mb', 0)
                
                # Clean up model
                if self.whisper_model_instance is not None:
                    del self.whisper_model_instance
                    self.whisper_model_instance = None
                    logger.info("🗑️ Whisper model instance deleted")
                
                # Force garbage collection
                self.force_garbage_collection()
                
                # Update stats
                self.memory_stats['last_cleanup_at'] = time.time()
                self.memory_stats['cleanup_count'] += 1
                
                # Get memory usage after cleanup
                after_mb = self.get_memory_usage().get('process', {}).get('rss_mb', 0)
                freed_mb = before_mb - after_mb
                
                logger.info(f"✅ Memory cleanup completed: freed {freed_mb:.1f}MB (before: {before_mb:.1f}MB, after: {after_mb:.1f}MB)")
                return True
                
        except Exception as e:
            logger.error(f"❌ Failed to cleanup Whisper model: {e}")
            return False
    
    def force_garbage_collection(self):
        """Force comprehensive garbage collection."""
        try:
            # Multiple GC passes for thorough cleanup
            collected = 0
            for generation in range(3):
                collected += gc.collect(generation)
            
            logger.info(f"🧹 Garbage collection completed: {collected} objects collected")
            
            # Additional memory cleanup
            if hasattr(gc, 'set_threshold'):
                # Temporarily lower GC thresholds for aggressive cleanup
                old_thresholds = gc.get_threshold()
                gc.set_threshold(700, 10, 10)
                gc.collect()
                gc.set_threshold(*old_thresholds)
                
        except Exception as e:
            logger.error(f"Failed to force garbage collection: {e}")
    
    def validate_audio_file_size(self, file_size_bytes: int) -> bool:
        """
        Validate audio file size against memory limits.
        
        Args:
            file_size_bytes: Size of audio file in bytes
            
        Returns:
            bool: True if file size is acceptable
        """
        file_size_mb = file_size_bytes / 1024 / 1024
        max_file_size_mb = 100  # 100MB max per file
        
        current_memory = self.get_memory_usage().get('process', {}).get('rss_mb', 0)
        available_memory = self.memory_threshold_mb - current_memory
        
        if file_size_mb > max_file_size_mb:
            logger.error(f"❌ Audio file too large: {file_size_mb:.1f}MB > {max_file_size_mb}MB limit")
            return False
        
        if file_size_mb > available_memory:
            logger.error(f"❌ Insufficient memory for file: {file_size_mb:.1f}MB needed, {available_memory:.1f}MB available")
            return False
        
        logger.info(f"✅ Audio file size validated: {file_size_mb:.1f}MB (available: {available_memory:.1f}MB)")
        return True
    
    def monitor_memory_usage(self):
        """Monitor memory usage and trigger cleanup if needed."""
        if not self.monitoring_enabled:
            return
        
        try:
            is_under_pressure = self.check_memory_pressure()
            
            if is_under_pressure:
                logger.warning("🧹 Memory pressure detected, triggering cleanup...")
                
                # Try cleanup
                if self.cleanup_whisper_model():
                    logger.info("✅ Emergency cleanup completed")
                else:
                    logger.warning("⚠️ Cleanup attempted but no model to clean")
                
                # Force additional GC
                self.force_garbage_collection()
                
        except Exception as e:
            logger.error(f"Failed to monitor memory usage: {e}")


def memory_monitor(func):
    """
    Decorator to monitor memory usage around function execution.
    Automatically triggers cleanup if memory pressure is detected.
    """
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        # Check memory before execution
        memory_manager.monitor_memory_usage()
        
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            # Check memory after execution and cleanup if needed
            memory_manager.monitor_memory_usage()
    
    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        # Check memory before execution
        memory_manager.monitor_memory_usage()
        
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            # Check memory after execution and cleanup if needed
            memory_manager.monitor_memory_usage()
    
    # Return appropriate wrapper based on function type
    import asyncio
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    else:
        return sync_wrapper


def memory_cleanup_after(func):
    """
    Decorator to force memory cleanup after function execution.
    Use for memory-intensive operations like Whisper processing.
    """
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            logger.info(f"🧹 Forcing memory cleanup after {func.__name__}")
            memory_manager.cleanup_whisper_model(force=True)
    
    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            logger.info(f"🧹 Forcing memory cleanup after {func.__name__}")
            memory_manager.cleanup_whisper_model(force=True)
    
    # Return appropriate wrapper based on function type
    import asyncio
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    else:
        return sync_wrapper


# Global memory manager instance
memory_manager = MemoryManager()


def get_memory_stats() -> Dict[str, Any]:
    """Get current memory statistics."""
    return memory_manager.get_memory_usage()


def validate_file_size(file_size_bytes: int) -> bool:
    """Validate file size against memory constraints."""
    return memory_manager.validate_audio_file_size(file_size_bytes)


def emergency_cleanup() -> bool:
    """Trigger emergency memory cleanup."""
    return memory_manager.cleanup_whisper_model(force=True)
