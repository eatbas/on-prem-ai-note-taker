"""
🚨 PHASE 3.5: Whisper Model Optimization

Advanced Whisper configuration and processing optimization for 6 CPU, 16GB RAM VPS.
Includes memory-efficient settings, adaptive quality, and performance tuning.
"""

import logging
from typing import Dict, Any, Optional, List, Tuple
import faster_whisper
from .config import settings

logger = logging.getLogger(__name__)

class WhisperOptimizer:
    """
    Advanced Whisper model optimization for memory-efficient transcription.
    
    Features:
    - Adaptive model size selection based on available memory
    - Optimized processing parameters for CPU inference
    - Quality vs speed trade-off configurations
    - Memory-aware batch processing
    """
    
    def __init__(self):
        self.available_models = {
            "tiny": {"memory_mb": 150, "quality": "low", "speed": "fastest"},
            "base": {"memory_mb": 300, "quality": "medium", "speed": "fast"},
            "small": {"memory_mb": 600, "quality": "good", "speed": "medium"},
            "medium": {"memory_mb": 1200, "quality": "high", "speed": "slow"},
            "large-v2": {"memory_mb": 2400, "quality": "excellent", "speed": "slowest"}
        }
        
        # 🚨 PHASE 4.3: Prioritize accuracy over speed (user requirement)
        self.optimal_model = "large-v2"  # Best accuracy model
        self.fallback_model = "medium"   # Still prioritize quality in fallback
        
    def get_optimal_model_config(self, file_size_mb: float, available_memory_mb: float) -> Dict[str, Any]:
        """
        Determine optimal Whisper model and configuration based on file size and available memory.
        """
        
        # Model selection based on available memory and file importance
        selected_model = self._select_model_size(file_size_mb, available_memory_mb)
        
        # Get base configuration
        config = self._get_base_config(selected_model)
        
        # Optimize parameters based on file characteristics
        config.update(self._get_adaptive_parameters(file_size_mb, selected_model))
        
        logger.info(f"🎯 Optimal Whisper config: model={selected_model}, "
                   f"memory_estimate={self.available_models[selected_model]['memory_mb']}MB")
        
        return config
    
    def _select_model_size(self, file_size_mb: float, available_memory_mb: float) -> str:
        """
        🚨 PHASE 4.3: Select model prioritizing ACCURACY over speed (user requirement).
        Always try to use the largest model that fits in memory.
        """
        
        # Reserve memory for other processes (keep 3GB free instead of 4GB for more model space)
        usable_memory = max(1000, available_memory_mb - 3000)
        
        # 🎯 ACCURACY FIRST: Always prefer the largest model that fits
        # User specified: "I can wait for VPS response, need detailed accuracy"
        
        # Try models from largest to smallest (accuracy priority)
        model_preference = ["large-v2", "medium", "small", "base", "tiny"]
        
        for model_name in model_preference:
            model_info = self.available_models[model_name]
            
            # Check if model fits in available memory
            if model_info["memory_mb"] <= usable_memory:
                logger.info(f"🎯 Selected high-accuracy model: {model_name} "
                           f"(requires {model_info['memory_mb']}MB, {usable_memory}MB available)")
                logger.info(f"💡 Prioritizing accuracy over speed as requested")
                return model_name
        
        # Emergency fallback (should rarely happen with 16GB RAM)
        logger.warning(f"⚠️ Using emergency fallback model 'tiny' due to severe memory constraints")
        return "tiny"
    
    def _get_base_config(self, model_name: str) -> Dict[str, Any]:
        """Get base Whisper configuration for the selected model"""
        
        return {
            "model_size": model_name,
            "device": "cpu",
            "device_index": 0,
            "compute_type": "int8",  # Use quantized model for CPU efficiency
            "cpu_threads": min(6, settings.whisper_cpu_threads or 4),  # Optimize for 6-core VPS
            
            # Memory optimization
            "download_root": None,
            "local_files_only": False,
        }
    
    def _get_adaptive_parameters(self, file_size_mb: float, model_name: str) -> Dict[str, Any]:
        """
        🚨 PHASE 4.3: Get parameters prioritizing MAXIMUM ACCURACY for transcription.
        User requirement: detailed accuracy > performance.
        """
        
        # 🎯 HIGH-ACCURACY BASE PARAMETERS
        params = {
            # Enhanced VAD for better speaker boundary detection
            "vad_filter": True,
            "vad_parameters": {
                "min_silence_duration_ms": 300,   # Shorter for better speaker transitions
                "speech_pad_ms": 200,             # Better speech boundary detection
            },
            
            # 🚨 MAXIMUM ACCURACY: Enhanced beam search
            "beam_size": 8,          # Much higher beam search for accuracy
            "best_of": 5,            # Multiple sampling for best results
            
            # 🚨 ACCURACY: Multiple temperature fallback for difficult segments
            "temperature": [0.0, 0.1, 0.2, 0.4, 0.6, 0.8],  # Comprehensive fallback
            "compression_ratio_threshold": 2.4,
            "log_prob_threshold": -1.0,
            "no_speech_threshold": 0.6,
            
            # 🚨 ACCURACY: Enhanced processing settings
            "condition_on_previous_text": True,   # Better context awareness
            "word_timestamps": True,              # ALWAYS enable for speaker alignment
            "initial_prompt": None,
            
            # Language detection
            "language": None,  # Auto-detect for best results
        }
        
        # 🎯 ALL FILES GET HIGH-ACCURACY TREATMENT (user can wait for accuracy)
        logger.info("🎯 Using MAXIMUM ACCURACY parameters - prioritizing quality over speed")
        
        # Enhanced parameters for larger models (which we prefer)
        if model_name in ["medium", "large-v2"]:
            params.update({
                "beam_size": 10,      # Even higher beam search for large models
                "best_of": 8,         # More sampling options
                "temperature": [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8],  # Full range
            })
            logger.info(f"🎯 Enhanced accuracy settings for {model_name} model")
            
        # Even smaller models get accuracy boost
        elif model_name in ["tiny", "base", "small"]:
            params.update({
                "beam_size": 6,       # Higher than default even for small models
                "best_of": 4,
                "temperature": [0.0, 0.2, 0.4, 0.6],
            })
            logger.info(f"🎯 Accuracy-focused settings for {model_name} model")
        
        return params
    
    def get_chunked_processing_config(self, total_duration: float) -> Dict[str, Any]:
        """
        Get configuration for chunked processing of long audio files.
        """
        
        # Determine chunk size based on total duration and available memory
        if total_duration > 3600:  # >1 hour
            chunk_duration = 600   # 10 minutes
        elif total_duration > 1800:  # >30 minutes  
            chunk_duration = 300   # 5 minutes
        else:
            chunk_duration = 180   # 3 minutes
        
        # Overlap between chunks for continuity
        overlap_duration = 30  # 30 seconds overlap
        
        config = {
            "chunk_duration": chunk_duration,
            "overlap_duration": overlap_duration,
            "max_chunks": 20,  # Safety limit
            "parallel_processing": False,  # CPU-only, avoid parallel for memory
        }
        
        logger.info(f"📊 Chunked processing: {chunk_duration}s chunks with {overlap_duration}s overlap")
        
        return config
    
    def estimate_processing_time(self, duration_seconds: float, model_name: str, file_size_mb: float) -> float:
        """
        Estimate processing time based on model and file characteristics.
        
        Returns estimated time in seconds.
        """
        
        # Base processing ratios (processing_time / audio_duration) for CPU
        processing_ratios = {
            "tiny": 0.1,      # 10% of audio duration
            "base": 0.2,      # 20% of audio duration  
            "small": 0.4,     # 40% of audio duration
            "medium": 0.8,    # 80% of audio duration
            "large-v2": 1.5,  # 150% of audio duration
        }
        
        base_ratio = processing_ratios.get(model_name, 0.4)
        
        # Adjust for file size (larger files may have processing overhead)
        size_factor = 1.0
        if file_size_mb > 100:
            size_factor = 1.2  # 20% overhead for large files
        elif file_size_mb > 200:
            size_factor = 1.5  # 50% overhead for very large files
        
        # Adjust for VPS load (conservative estimate)
        load_factor = 1.3  # 30% buffer for system load
        
        estimated_time = duration_seconds * base_ratio * size_factor * load_factor
        
        logger.debug(f"⏱️ Estimated processing time: {estimated_time:.1f}s "
                    f"for {duration_seconds:.1f}s audio using {model_name}")
        
        return estimated_time
    
    def get_memory_efficient_model_config(self) -> Dict[str, Any]:
        """
        Get the most memory-efficient Whisper configuration.
        
        Used during high memory pressure situations.
        """
        
        config = {
            "model_size": "tiny",
            "device": "cpu", 
            "compute_type": "int8",
            "cpu_threads": 2,  # Reduced threads
            
            # Aggressive speed optimizations
            "beam_size": 1,    # Greedy search only
            "best_of": 1,
            "temperature": [0.0],
            "word_timestamps": False,
            "condition_on_previous_text": False,
            
            # Minimal VAD for speed
            "vad_filter": True,
            "vad_parameters": {
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 100,
            }
        }
        
        logger.info("🚨 Using memory-efficient Whisper configuration")
        return config

# Global whisper optimizer instance
whisper_optimizer = WhisperOptimizer()

def get_whisper_optimizer() -> WhisperOptimizer:
    """Get the global Whisper optimizer instance"""
    return whisper_optimizer
