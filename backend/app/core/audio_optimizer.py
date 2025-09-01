"""
🚨 PHASE 3.5: Audio Processing Optimization

Advanced audio processing utilities for memory-efficient meeting transcription.
Includes chunking, compression, format optimization, and streaming support.
"""

import os
import logging
import tempfile
import subprocess
from typing import List, Tuple, Optional, Iterator, Dict, Any
from pathlib import Path
import librosa
import soundfile as sf
import numpy as np

from .config import settings

logger = logging.getLogger(__name__)

class AudioOptimizer:
    """
    Advanced audio processing for memory-efficient Whisper processing.
    
    Features:
    - Audio chunking for large files
    - Dynamic compression based on quality vs size
    - Format optimization (convert to optimal format for Whisper)
    - Noise reduction and audio enhancement
    - Memory-aware processing limits
    """
    
    def __init__(self):
        self.optimal_sample_rate = 16000  # Whisper's preferred sample rate
        self.max_chunk_duration = 30 * 60  # 30 minutes per chunk (safe for 16GB RAM)
        self.compression_target_mb = 50     # Target size for compressed audio
        
    def analyze_audio_file(self, file_path: str) -> Dict[str, Any]:
        """Analyze audio file characteristics for optimization decisions"""
        try:
            # Use librosa for detailed analysis
            y, sr = librosa.load(file_path, sr=None)
            duration = len(y) / sr
            
            # File size info
            file_size = os.path.getsize(file_path)
            file_size_mb = file_size / (1024 * 1024)
            
            # Audio quality metrics
            rms_energy = np.sqrt(np.mean(y**2))
            zero_crossing_rate = np.mean(librosa.feature.zero_crossing_rate(y))
            spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
            
            analysis = {
                "duration_seconds": duration,
                "sample_rate": sr,
                "channels": 1,  # librosa loads as mono by default
                "file_size_bytes": file_size,
                "file_size_mb": file_size_mb,
                "audio_quality": {
                    "rms_energy": float(rms_energy),
                    "zero_crossing_rate": float(zero_crossing_rate),
                    "spectral_centroid": float(spectral_centroid)
                },
                "optimization_needed": file_size_mb > 100 or duration > 1800,  # >100MB or >30min
                "chunks_needed": duration > self.max_chunk_duration
            }
            
            logger.info(f"📊 Audio analysis: {duration:.1f}s, {file_size_mb:.1f}MB, SR: {sr}Hz")
            
            return analysis
            
        except Exception as e:
            logger.error(f"❌ Audio analysis failed: {e}")
            return {
                "duration_seconds": 0,
                "sample_rate": 16000,
                "channels": 1,
                "file_size_bytes": os.path.getsize(file_path),
                "file_size_mb": os.path.getsize(file_path) / (1024 * 1024),
                "optimization_needed": True,
                "chunks_needed": False,
                "error": str(e)
            }
    
    def optimize_audio_for_whisper(self, input_path: str, output_path: str = None) -> str:
        """
        Optimize audio file for Whisper processing.
        
        Optimizations:
        - Convert to mono 16kHz (Whisper's preferred format)
        - Apply noise reduction if needed
        - Compress if file is too large
        - Normalize audio levels
        """
        if output_path is None:
            output_path = input_path.replace('.', '_optimized.')
        
        try:
            # Load and analyze audio
            analysis = self.analyze_audio_file(input_path)
            
            logger.info(f"🔧 Optimizing audio: {analysis['duration_seconds']:.1f}s, {analysis['file_size_mb']:.1f}MB")
            
            # Load audio with librosa (automatically converts to mono)
            y, sr = librosa.load(input_path, sr=self.optimal_sample_rate)
            
            # Audio enhancements
            y_optimized = self._enhance_audio(y, sr)
            
            # Save optimized audio
            sf.write(output_path, y_optimized, self.optimal_sample_rate, format='WAV')
            
            # Verify optimization results
            optimized_size = os.path.getsize(output_path) / (1024 * 1024)
            optimization_ratio = analysis['file_size_mb'] / optimized_size if optimized_size > 0 else 1
            
            logger.info(f"✅ Audio optimized: {optimized_size:.1f}MB (reduction: {optimization_ratio:.1f}x)")
            
            return output_path
            
        except Exception as e:
            logger.error(f"❌ Audio optimization failed: {e}")
            # Return original file if optimization fails
            return input_path
    
    def _enhance_audio(self, y: np.ndarray, sr: int) -> np.ndarray:
        """Apply audio enhancements for better transcription quality"""
        try:
            # Normalize audio levels
            y_normalized = librosa.util.normalize(y)
            
            # Apply pre-emphasis filter (helps with speech recognition)
            y_emphasized = np.append(y_normalized[0], y_normalized[1:] - 0.97 * y_normalized[:-1])
            
            # Simple noise reduction using spectral gating
            # Only apply if audio seems noisy (high zero-crossing rate)
            zero_crossing_rate = np.mean(librosa.feature.zero_crossing_rate(y_emphasized))
            
            if zero_crossing_rate > 0.1:  # Likely noisy audio
                # Apply mild noise reduction
                y_enhanced = self._apply_noise_reduction(y_emphasized, sr)
            else:
                y_enhanced = y_emphasized
            
            # Final normalization
            y_final = librosa.util.normalize(y_enhanced)
            
            return y_final
            
        except Exception as e:
            logger.warning(f"⚠️ Audio enhancement failed, using original: {e}")
            return y
    
    def _apply_noise_reduction(self, y: np.ndarray, sr: int) -> np.ndarray:
        """Apply basic noise reduction using spectral subtraction"""
        try:
            # Convert to frequency domain
            stft = librosa.stft(y)
            magnitude = np.abs(stft)
            phase = np.angle(stft)
            
            # Estimate noise from first 0.5 seconds (assumed to be silence/noise)
            noise_frames = int(0.5 * sr / 512)  # 512 is default hop_length
            noise_spectrum = np.mean(magnitude[:, :noise_frames], axis=1, keepdims=True)
            
            # Apply spectral subtraction
            alpha = 2.0  # Over-subtraction factor
            beta = 0.01  # Spectral floor
            
            reduced_magnitude = magnitude - alpha * noise_spectrum
            reduced_magnitude = np.maximum(reduced_magnitude, beta * magnitude)
            
            # Convert back to time domain
            enhanced_stft = reduced_magnitude * np.exp(1j * phase)
            y_enhanced = librosa.istft(enhanced_stft)
            
            return y_enhanced
            
        except Exception as e:
            logger.warning(f"⚠️ Noise reduction failed: {e}")
            return y
    
    def chunk_audio_file(self, input_path: str, chunk_duration: int = None) -> List[str]:
        """
        Split large audio file into smaller chunks for memory-efficient processing.
        
        Returns list of chunk file paths.
        """
        if chunk_duration is None:
            chunk_duration = self.max_chunk_duration
        
        try:
            analysis = self.analyze_audio_file(input_path)
            
            if not analysis.get('chunks_needed', False):
                logger.info(f"📁 Audio file doesn't need chunking: {analysis['duration_seconds']:.1f}s")
                return [input_path]
            
            logger.info(f"✂️ Chunking audio file: {analysis['duration_seconds']:.1f}s into {chunk_duration}s chunks")
            
            # Load audio
            y, sr = librosa.load(input_path, sr=None)
            total_duration = len(y) / sr
            
            # Calculate chunk parameters
            chunk_samples = int(chunk_duration * sr)
            num_chunks = int(np.ceil(len(y) / chunk_samples))
            
            chunk_paths = []
            base_name = Path(input_path).stem
            
            for i in range(num_chunks):
                start_sample = i * chunk_samples
                end_sample = min((i + 1) * chunk_samples, len(y))
                
                chunk_audio = y[start_sample:end_sample]
                
                # Create chunk file
                chunk_filename = f"{base_name}_chunk_{i+1:03d}.wav"
                chunk_path = os.path.join(tempfile.gettempdir(), chunk_filename)
                
                sf.write(chunk_path, chunk_audio, sr, format='WAV')
                chunk_paths.append(chunk_path)
                
                chunk_duration_actual = len(chunk_audio) / sr
                logger.debug(f"📄 Created chunk {i+1}/{num_chunks}: {chunk_duration_actual:.1f}s")
            
            logger.info(f"✅ Created {num_chunks} audio chunks")
            return chunk_paths
            
        except Exception as e:
            logger.error(f"❌ Audio chunking failed: {e}")
            return [input_path]  # Return original file if chunking fails
    
    def compress_audio_file(self, input_path: str, output_path: str = None, target_mb: int = None) -> str:
        """
        Compress audio file to reduce size while maintaining transcription quality.
        
        Uses adaptive bitrate based on target size and audio characteristics.
        """
        if output_path is None:
            output_path = input_path.replace('.', '_compressed.')
        
        if target_mb is None:
            target_mb = self.compression_target_mb
        
        try:
            analysis = self.analyze_audio_file(input_path)
            current_mb = analysis['file_size_mb']
            
            if current_mb <= target_mb:
                logger.info(f"📁 Audio file already small enough: {current_mb:.1f}MB <= {target_mb}MB")
                return input_path
            
            logger.info(f"🗜️ Compressing audio: {current_mb:.1f}MB -> target {target_mb}MB")
            
            # Calculate target bitrate
            duration_seconds = analysis['duration_seconds']
            target_bitrate = int((target_mb * 8 * 1024 * 1024) / duration_seconds)  # bits per second
            target_bitrate = max(32000, min(128000, target_bitrate))  # Clamp between 32k-128k
            
            # Use FFmpeg for efficient compression
            if self._has_ffmpeg():
                return self._compress_with_ffmpeg(input_path, output_path, target_bitrate)
            else:
                # Fallback to librosa/soundfile compression
                return self._compress_with_librosa(input_path, output_path, target_mb)
            
        except Exception as e:
            logger.error(f"❌ Audio compression failed: {e}")
            return input_path
    
    def _has_ffmpeg(self) -> bool:
        """Check if FFmpeg is available"""
        try:
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
    
    def _compress_with_ffmpeg(self, input_path: str, output_path: str, bitrate: int) -> str:
        """Compress audio using FFmpeg"""
        try:
            cmd = [
                'ffmpeg', '-i', input_path,
                '-ar', str(self.optimal_sample_rate),  # Sample rate
                '-ac', '1',                            # Mono
                '-b:a', f'{bitrate}',                  # Bitrate
                '-compression_level', '8',             # High compression
                '-y',                                  # Overwrite output
                output_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                compressed_mb = os.path.getsize(output_path) / (1024 * 1024)
                logger.info(f"✅ FFmpeg compression successful: {compressed_mb:.1f}MB")
                return output_path
            else:
                logger.error(f"❌ FFmpeg compression failed: {result.stderr}")
                return input_path
                
        except Exception as e:
            logger.error(f"❌ FFmpeg compression error: {e}")
            return input_path
    
    def _compress_with_librosa(self, input_path: str, output_path: str, target_mb: int) -> str:
        """Compress audio using librosa (fallback method)"""
        try:
            # Load audio
            y, sr = librosa.load(input_path, sr=self.optimal_sample_rate)
            
            # Apply aggressive normalization and compression
            y_compressed = librosa.util.normalize(y) * 0.8  # Reduce amplitude slightly
            
            # Save with lower bit depth for compression
            sf.write(output_path, y_compressed, self.optimal_sample_rate, 
                    format='FLAC', subtype='PCM_16')  # FLAC with 16-bit
            
            compressed_mb = os.path.getsize(output_path) / (1024 * 1024)
            logger.info(f"✅ Librosa compression successful: {compressed_mb:.1f}MB")
            
            return output_path
            
        except Exception as e:
            logger.error(f"❌ Librosa compression failed: {e}")
            return input_path
    
    def stream_audio_chunks(self, file_path: str, chunk_duration: int = 30) -> Iterator[Tuple[np.ndarray, int]]:
        """
        Stream audio file in chunks for memory-efficient processing.
        
        Yields (audio_chunk, sample_rate) tuples.
        """
        try:
            # Use librosa's stream processing
            y, sr = librosa.load(file_path, sr=self.optimal_sample_rate)
            chunk_samples = int(chunk_duration * sr)
            
            for i in range(0, len(y), chunk_samples):
                chunk = y[i:i + chunk_samples]
                yield chunk, sr
                
        except Exception as e:
            logger.error(f"❌ Audio streaming failed: {e}")
            # Yield empty chunk to signal error
            yield np.array([]), self.optimal_sample_rate
    
    def cleanup_temp_files(self, file_paths: List[str]):
        """Clean up temporary audio files"""
        for file_path in file_paths:
            try:
                if os.path.exists(file_path) and 'temp' in file_path.lower():
                    os.remove(file_path)
                    logger.debug(f"🗑️ Cleaned up temp audio file: {file_path}")
            except OSError as e:
                logger.warning(f"Failed to cleanup audio file {file_path}: {e}")


# Global audio optimizer instance
audio_optimizer = AudioOptimizer()

def get_audio_optimizer() -> AudioOptimizer:
    """Get the global audio optimizer instance"""
    return audio_optimizer
