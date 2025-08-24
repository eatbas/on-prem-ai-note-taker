"""Audio processing utilities for transcription pipeline"""

import os
import tempfile
import subprocess
import json
from typing import Tuple, Optional, List
import logging

logger = logging.getLogger(__name__)


def get_audio_duration(file_path: str) -> float:
    """
    Get audio duration in seconds using ffmpeg.
    Falls back to pydub if ffmpeg not available.
    """
    try:
        # Try ffmpeg first (most reliable)
        result = subprocess.run([
            'ffmpeg', '-i', file_path, 
            '-f', 'null', '-'
        ], capture_output=True, text=True, timeout=10)
        
        # Parse duration from stderr output
        for line in result.stderr.split('\n'):
            if 'Duration:' in line:
                time_str = line.split('Duration:')[1].split(',')[0].strip()
                return parse_time_string(time_str)
                
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
        logger.warning("ffmpeg not available, trying pydub fallback")
        
        try:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(file_path)
            return len(audio) / 1000.0  # Convert ms to seconds
        except ImportError:
            logger.warning("pydub not available, using fallback duration estimation")
            # Fallback: estimate based on file size (rough approximation)
            return estimate_duration_from_size(file_path)
    
    return 0.0


def parse_time_string(time_str: str) -> float:
    """Parse time string like '00:01:23.45' to seconds"""
    try:
        parts = time_str.split(':')
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        return 0.0
    except (ValueError, IndexError):
        return 0.0


def estimate_duration_from_size(file_path: str) -> float:
    """Rough duration estimation based on file size and format"""
    try:
        file_size = os.path.getsize(file_path)
        # Rough estimation: assume 16-bit mono at 44.1kHz
        # This is very approximate and should only be used as fallback
        estimated_duration = file_size / (44100 * 2)  # 2 bytes per sample
        return max(estimated_duration, 1.0)  # Minimum 1 second
    except OSError:
        return 60.0  # Default fallback


def split_audio_into_chunks(
    file_path: str, 
    chunk_duration: int = 45,  # 45 seconds per chunk
    overlap: int = 5  # 5 second overlap
) -> List[Tuple[str, float, float]]:
    """
    Split audio file into chunks using ffmpeg.
    Returns list of (chunk_path, start_time, end_time) tuples.
    """
    chunks = []
    
    try:
        # Get total duration
        total_duration = get_audio_duration(file_path)
        if total_duration <= 0:
            return [(file_path, 0.0, total_duration)]
        
        # Calculate chunk boundaries
        start_time = 0.0
        chunk_index = 0
        
        while start_time < total_duration:
            end_time = min(start_time + chunk_duration, total_duration)
            
            # Create temporary chunk file
            chunk_path = f"{file_path}_chunk_{chunk_index:03d}.wav"
            
            try:
                # Extract chunk using ffmpeg
                subprocess.run([
                    'ffmpeg', '-y',  # Overwrite output
                    '-i', file_path,
                    '-ss', str(start_time),
                    '-t', str(end_time - start_time),
                    '-c:a', 'pcm_s16le',  # 16-bit PCM
                    '-ar', '16000',  # 16kHz sample rate (good for Whisper)
                    '-ac', '1',  # Mono
                    chunk_path
                ], capture_output=True, check=True, timeout=30)
                
                chunks.append((chunk_path, start_time, end_time))
                chunk_index += 1
                
            except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as e:
                logger.error(f"Failed to create chunk {chunk_index}: {e}")
                break
            
            # Move to next chunk (with overlap)
            start_time = end_time - overlap
            if start_time >= total_duration:
                break
        
        # If no chunks created, return original file
        if not chunks:
            return [(file_path, 0.0, total_duration)]
            
        return chunks
        
    except Exception as e:
        logger.error(f"Error splitting audio: {e}")
        # Return original file as single chunk
        return [(file_path, 0.0, get_audio_duration(file_path))]


def cleanup_chunk_files(chunk_paths: List[str]):
    """Clean up temporary chunk files"""
    for chunk_path in chunk_paths:
        try:
            if os.path.exists(chunk_path) and chunk_path.endswith('_chunk_'):
                os.remove(chunk_path)
        except OSError as e:
            logger.warning(f"Failed to cleanup chunk file {chunk_path}: {e}")


def get_audio_info(file_path: str) -> dict:
    """Get comprehensive audio file information"""
    try:
        duration = get_audio_duration(file_path)
        file_size = os.path.getsize(file_path)
        
        # Try to get format info with ffmpeg
        format_info = {}
        try:
            result = subprocess.run([
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_format', '-show_streams', file_path
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                info = json.loads(result.stdout)
                format_info = info.get('format', {})
                
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            pass
        
        return {
            'duration_seconds': duration,
            'file_size_bytes': file_size,
            'file_size_mb': round(file_size / (1024 * 1024), 2),
            'format': format_info.get('format_name', 'unknown'),
            'bit_rate': format_info.get('bit_rate'),
            'sample_rate': None,  # Would need to parse from streams
        }
        
    except Exception as e:
        logger.error(f"Error getting audio info: {e}")
        return {
            'duration_seconds': 0.0,
            'file_size_bytes': 0,
            'file_size_mb': 0.0,
            'format': 'unknown',
            'bit_rate': None,
            'sample_rate': None,
        }
