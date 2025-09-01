"""
🚨 PHASE 4.2: Speaker Diarization Service

Advanced speaker identification using pyannote.audio for detailed meeting insights.
Implements Speaker 1-6 identification with confidence scoring and speaker management.
"""

import os
import logging
import uuid
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    from pyannote.audio import Pipeline
    from pyannote.core import Annotation, Segment
    PYANNOTE_AVAILABLE = True
    logger.info("✅ pyannote.audio available for speaker diarization")
except ImportError:
    PYANNOTE_AVAILABLE = False
    logger.warning("⚠️ pyannote.audio not available - speaker diarization disabled")
    Pipeline = None
    Annotation = None
    Segment = None

from ..models import Speaker, SpeakerSegment
from ..database import get_db

class SpeakerDiarizationService:
    """
    Advanced speaker diarization service for meeting analysis.
    
    Features:
    - Speaker identification (Speaker 1, Speaker 2, etc.)
    - Confidence scoring for speaker assignments
    - Speaker statistics and insights
    - Integration with Whisper transcription
    - Color-coded speaker visualization
    """
    
    def __init__(self):
        self.pipeline = None
        self.speaker_colors = [
            "#FF6B6B",  # Red
            "#4ECDC4",  # Teal  
            "#45B7D1",  # Blue
            "#FFA726",  # Orange
            "#AB47BC",  # Purple
            "#66BB6A",  # Green
        ]
        self.min_speaker_duration = 1.0  # Minimum 1 second to be considered a speaker
        self.max_speakers = 6  # Support up to 6 speakers
        
        if PYANNOTE_AVAILABLE:
            self._initialize_pipeline()
    
    def _initialize_pipeline(self):
        """Initialize the pyannote.audio pipeline"""
        try:
            # Try to load the speaker diarization pipeline
            # Note: This requires a Hugging Face token for some models
            self.pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=os.getenv("HUGGINGFACE_TOKEN")  # Optional token
            )
            logger.info("✅ pyannote.audio pipeline initialized successfully")
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to initialize pyannote pipeline: {e}")
            # Try fallback pipeline
            try:
                self.pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization")
                logger.info("✅ Fallback pyannote.audio pipeline initialized")
            except Exception as fallback_error:
                logger.error(f"❌ All pyannote pipeline initializations failed: {fallback_error}")
                self.pipeline = None
    
    def is_available(self) -> bool:
        """Check if speaker diarization is available"""
        return PYANNOTE_AVAILABLE and self.pipeline is not None
    
    def diarize_audio(self, audio_file_path: str) -> Optional[Annotation]:
        """
        Perform speaker diarization on audio file.
        
        Returns:
            Annotation object with speaker segments or None if failed
        """
        if not self.is_available():
            logger.warning("Speaker diarization not available")
            return None
        
        try:
            logger.info(f"🎤 Starting speaker diarization for: {audio_file_path}")
            
            # Run diarization pipeline
            diarization = self.pipeline(audio_file_path)
            
            # Log results
            num_speakers = len(diarization.labels())
            total_duration = sum(segment.duration for segment in diarization.itersegments())
            
            logger.info(f"✅ Speaker diarization completed: {num_speakers} speakers, {total_duration:.1f}s total")
            
            return diarization
            
        except Exception as e:
            logger.error(f"❌ Speaker diarization failed: {e}")
            return None
    
    def process_diarization_results(
        self, 
        diarization: Annotation, 
        meeting_id: str,
        total_duration: float
    ) -> List[Dict[str, Any]]:
        """
        Process diarization results into speaker data structures.
        
        Returns:
            List of speaker dictionaries with segments and metadata
        """
        if not diarization:
            return []
        
        try:
            # Group segments by speaker
            speakers_data = {}
            
            for segment, track, speaker_label in diarization.itertracks(yield_label=True):
                # Convert to our speaker format
                speaker_id = f"speaker_{len(speakers_data) + 1}" if speaker_label not in speakers_data else None
                
                if speaker_label not in speakers_data:
                    speaker_id = f"speaker_{len(speakers_data) + 1}"
                    display_name = f"Speaker {len(speakers_data) + 1}"
                    color = self.speaker_colors[len(speakers_data) % len(self.speaker_colors)]
                    
                    speakers_data[speaker_label] = {
                        "speaker_id": speaker_id,
                        "original_speaker_id": speaker_label,
                        "display_name": display_name,
                        "speaker_color": color,
                        "segments": [],
                        "total_duration": 0.0,
                        "total_segments": 0
                    }
                
                # Add segment
                segment_duration = segment.duration
                speakers_data[speaker_label]["segments"].append({
                    "start_time": segment.start,
                    "end_time": segment.end,
                    "duration": segment_duration,
                    "speaker_confidence": getattr(track, 'confidence', 0.8)  # Default confidence
                })
                
                speakers_data[speaker_label]["total_duration"] += segment_duration
                speakers_data[speaker_label]["total_segments"] += 1
            
            # Calculate speaker statistics
            processed_speakers = []
            for speaker_data in speakers_data.values():
                # Filter out very short speakers (likely false positives)
                if speaker_data["total_duration"] < self.min_speaker_duration:
                    continue
                
                # Calculate statistics
                speaker_data["talking_time_percentage"] = (speaker_data["total_duration"] / total_duration) * 100
                speaker_data["average_segment_duration"] = (
                    speaker_data["total_duration"] / speaker_data["total_segments"] 
                    if speaker_data["total_segments"] > 0 else 0
                )
                
                processed_speakers.append(speaker_data)
            
            # Sort speakers by talking time (most active first)
            processed_speakers.sort(key=lambda x: x["total_duration"], reverse=True)
            
            # Limit to max speakers and reassign names
            final_speakers = []
            for i, speaker_data in enumerate(processed_speakers[:self.max_speakers]):
                speaker_data["display_name"] = f"Speaker {i + 1}"
                speaker_data["speaker_id"] = f"speaker_{i + 1}"
                speaker_data["speaker_color"] = self.speaker_colors[i % len(self.speaker_colors)]
                final_speakers.append(speaker_data)
            
            logger.info(f"✅ Processed {len(final_speakers)} speakers for meeting {meeting_id}")
            
            return final_speakers
            
        except Exception as e:
            logger.error(f"❌ Failed to process diarization results: {e}")
            return []
    
    def save_speakers_to_database(
        self, 
        meeting_id: str, 
        speakers_data: List[Dict[str, Any]]
    ) -> List[Speaker]:
        """Save speaker data to database"""
        
        db = next(get_db())
        saved_speakers = []
        
        try:
            for speaker_data in speakers_data:
                # Create speaker record
                speaker_id = str(uuid.uuid4())
                speaker = Speaker(
                    id=speaker_id,
                    meeting_id=meeting_id,
                    original_speaker_id=speaker_data["original_speaker_id"],
                    display_name=speaker_data["display_name"],
                    speaker_color=speaker_data["speaker_color"],
                    total_segments=speaker_data["total_segments"],
                    total_duration=speaker_data["total_duration"],
                    talking_time_percentage=speaker_data["talking_time_percentage"],
                    average_segment_duration=speaker_data["average_segment_duration"]
                )
                db.add(speaker)
                
                # Create speaker segments
                for segment_data in speaker_data["segments"]:
                    segment = SpeakerSegment(
                        id=str(uuid.uuid4()),
                        meeting_id=meeting_id,
                        speaker_id=speaker_id,
                        start_time=segment_data["start_time"],
                        end_time=segment_data["end_time"],
                        text="",  # Will be filled by transcription alignment
                        speaker_confidence=segment_data["speaker_confidence"]
                    )
                    db.add(segment)
                
                saved_speakers.append(speaker)
            
            db.commit()
            logger.info(f"✅ Saved {len(saved_speakers)} speakers to database for meeting {meeting_id}")
            
            return saved_speakers
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Failed to save speakers to database: {e}")
            return []
    
    def align_transcription_with_speakers(
        self, 
        meeting_id: str, 
        transcription_segments: List[Dict[str, Any]]
    ):
        """
        Align Whisper transcription segments with speaker diarization results.
        
        Args:
            meeting_id: Meeting ID
            transcription_segments: List of transcription segments with timing
        """
        
        db = next(get_db())
        
        try:
            # Get speaker segments from database
            speaker_segments = db.query(SpeakerSegment).filter(
                SpeakerSegment.meeting_id == meeting_id
            ).all()
            
            if not speaker_segments:
                logger.warning(f"No speaker segments found for meeting {meeting_id}")
                return
            
            # Align transcription with speaker segments
            for trans_segment in transcription_segments:
                trans_start = trans_segment["start"]
                trans_end = trans_segment["end"]
                trans_text = trans_segment["text"]
                
                # Find overlapping speaker segments
                overlapping_segments = []
                for speaker_segment in speaker_segments:
                    # Check for overlap
                    overlap_start = max(trans_start, speaker_segment.start_time)
                    overlap_end = min(trans_end, speaker_segment.end_time)
                    
                    if overlap_start < overlap_end:
                        overlap_duration = overlap_end - overlap_start
                        overlapping_segments.append((speaker_segment, overlap_duration))
                
                # Assign text to speaker segment with most overlap
                if overlapping_segments:
                    # Sort by overlap duration (most overlap first)
                    overlapping_segments.sort(key=lambda x: x[1], reverse=True)
                    best_segment, _ = overlapping_segments[0]
                    
                    # Update speaker segment with transcription
                    if not best_segment.text:  # Don't overwrite existing text
                        best_segment.text = trans_text
                        best_segment.confidence = trans_segment.get("confidence", 0.9)
                        best_segment.word_count = len(trans_text.split())
            
            db.commit()
            logger.info(f"✅ Aligned transcription with speakers for meeting {meeting_id}")
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Failed to align transcription with speakers: {e}")
    
    def get_speaker_insights(self, meeting_id: str) -> Dict[str, Any]:
        """Generate speaker insights for a meeting"""
        
        db = next(get_db())
        
        try:
            speakers = db.query(Speaker).filter(Speaker.meeting_id == meeting_id).all()
            
            if not speakers:
                return {"speakers": [], "insights": {}}
            
            # Generate insights
            insights = {
                "total_speakers": len(speakers),
                "most_active_speaker": max(speakers, key=lambda s: s.total_duration).display_name,
                "longest_segment": max(
                    speakers, 
                    key=lambda s: s.average_segment_duration or 0
                ).display_name,
                "speaker_distribution": [
                    {
                        "speaker": speaker.display_name,
                        "talking_time_percentage": speaker.talking_time_percentage,
                        "segments": speaker.total_segments
                    }
                    for speaker in sorted(speakers, key=lambda s: s.total_duration, reverse=True)
                ]
            }
            
            return {
                "speakers": [
                    {
                        "id": speaker.id,
                        "display_name": speaker.display_name,
                        "custom_name": speaker.custom_name,
                        "color": speaker.speaker_color,
                        "total_duration": speaker.total_duration,
                        "talking_time_percentage": speaker.talking_time_percentage,
                        "total_segments": speaker.total_segments
                    }
                    for speaker in speakers
                ],
                "insights": insights
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get speaker insights: {e}")
            return {"speakers": [], "insights": {}}


# Global speaker diarization service
speaker_diarization_service = SpeakerDiarizationService()

def get_speaker_diarization_service() -> SpeakerDiarizationService:
    """Get the global speaker diarization service"""
    return speaker_diarization_service
