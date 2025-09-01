"""
🚨 PHASE 4.4: Speaker-Enhanced Summary Service

Generates rich, speaker-aware meeting summaries with "Speaker 1 said..." format,
speaker insights, action items, and conversation flow analysis.
"""

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..models import Meeting, Speaker, SpeakerSegment
from ..database import get_db
from ..core.prompts import get_speaker_enhanced_json_prompt, get_speaker_enhanced_summary_prompt
from ..clients.ollama_client import OllamaClient
from .json_schema_service import schema_service, OutputFormat

logger = logging.getLogger(__name__)

class SpeakerSummaryService:
    """
    Advanced summary generation service with speaker intelligence.
    
    Features:
    - Speaker-aware summary generation ("Speaker 1 said...", "Speaker 2 responded...")
    - Speaker insights and participation analysis
    - Action items with speaker ownership
    - Conversation flow tracking
    - Decision attribution to speakers
    """
    
    def __init__(self, ollama_client: OllamaClient):
        self.ollama_client = ollama_client
    
    def generate_speaker_enhanced_summary(
        self, 
        meeting_id: str, 
        language: str = "tr",
        use_json_schema: bool = True
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive speaker-enhanced summary for a meeting.
        
        Args:
            meeting_id: Meeting ID
            language: Summary language ("tr", "en", or "auto")
            use_json_schema: Whether to use JSON schema for structured output (recommended)
            
        Returns:
            Dictionary with enhanced summary and speaker insights
        """
        
        if use_json_schema:
            return self._generate_json_schema_summary(meeting_id, language)
        else:
            return self._generate_legacy_summary(meeting_id, language)
    
    def _generate_json_schema_summary(
        self, 
        meeting_id: str, 
        language: str = "tr"
    ) -> Dict[str, Any]:
        """
        🚨 NEW: Generate speaker-enhanced summary using JSON schema for reliable output.
        
        Prevents hallucination and ensures structured, parseable results.
        """
        
        db = next(get_db())
        
        try:
            # Get meeting data
            meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
            if not meeting:
                raise ValueError(f"Meeting {meeting_id} not found")
            
            # Get speakers and their segments
            speakers = db.query(Speaker).filter(Speaker.meeting_id == meeting_id).all()
            
            if not speakers:
                logger.warning(f"No speakers found for meeting {meeting_id}, using standard summary")
                return self._generate_fallback_summary(meeting, language)
            
            # Get speaker segments with transcription
            speaker_segments = db.query(SpeakerSegment).filter(
                SpeakerSegment.meeting_id == meeting_id,
                SpeakerSegment.text.isnot(None),
                SpeakerSegment.text != ""
            ).order_by(SpeakerSegment.start_time).all()
            
            if not speaker_segments:
                logger.warning(f"No speaker segments with text found for meeting {meeting_id}")
                return self._generate_fallback_summary(meeting, language)
            
            # Build speaker-enhanced transcript
            speaker_transcript = self._build_speaker_transcript(speakers, speaker_segments)
            
            # Get JSON schema-enforced prompt
            schema_prompt = get_speaker_enhanced_json_prompt(language)
            
            # Add speaker data to prompt
            full_prompt = schema_prompt + f"\n\n{speaker_transcript}"
            
            logger.info(f"🎤 Generating JSON schema-enforced summary for meeting {meeting_id} with {len(speakers)} speakers")
            
            # Generate with JSON schema enforcement (retry logic for reliability)
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    # Generate summary using Ollama with JSON format enforced
                    json_response = self.ollama_client.generate(
                        full_prompt,
                        options={
                            "temperature": 0.05,  # Very low for JSON consistency
                            "top_p": 0.8,
                            "top_k": 10,
                            "num_predict": 1200,  # More tokens for comprehensive JSON
                            "format": "json",  # 🚨 Force JSON output
                        }
                    )
                    
                    # Validate and parse JSON output
                    validated_summary = schema_service.validate_json_output(
                        json_response, 
                        OutputFormat.SPEAKER_ENHANCED_SUMMARY
                    )
                    
                    # Enhance with additional insights
                    validated_summary["meta_insights"] = self._extract_speaker_insights(speakers, speaker_segments)
                    validated_summary["conversation_analysis"] = self._analyze_conversation_flow(speaker_segments)
                    
                    logger.info(f"✅ JSON schema summary generated successfully for meeting {meeting_id}")
                    
                    return {
                        "summary": json_response,  # Raw JSON string
                        "structured_summary": validated_summary,  # Parsed and validated
                        "speaker_count": len(speakers),
                        "total_segments": len(speaker_segments),
                        "language": language,
                        "summary_type": "speaker_enhanced_json",
                        "schema_validated": True
                    }
                    
                except ValueError as json_error:
                    logger.warning(f"JSON validation failed on attempt {attempt + 1}: {json_error}")
                    if attempt == max_retries - 1:
                        # Final attempt failed, fall back to legacy method
                        logger.error(f"All JSON attempts failed, falling back to legacy method")
                        return self._generate_legacy_summary(meeting_id, language)
                        
        except Exception as e:
            logger.error(f"❌ Failed to generate JSON schema summary for meeting {meeting_id}: {e}")
            # Fallback to legacy method
            return self._generate_legacy_summary(meeting_id, language)
    
    def _generate_legacy_summary(
        self, 
        meeting_id: str, 
        language: str = "tr"
    ) -> Dict[str, Any]:
        """Legacy speaker-enhanced summary generation (free-text format)"""
        
        db = next(get_db())
        
        try:
            # Get meeting data
            meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
            if not meeting:
                raise ValueError(f"Meeting {meeting_id} not found")
            
            # Get speakers and their segments
            speakers = db.query(Speaker).filter(Speaker.meeting_id == meeting_id).all()
            
            if not speakers:
                logger.warning(f"No speakers found for meeting {meeting_id}, using standard summary")
                return self._generate_fallback_summary(meeting, language)
            
            # Get speaker segments with transcription
            speaker_segments = db.query(SpeakerSegment).filter(
                SpeakerSegment.meeting_id == meeting_id,
                SpeakerSegment.text.isnot(None),
                SpeakerSegment.text != ""
            ).order_by(SpeakerSegment.start_time).all()
            
            if not speaker_segments:
                logger.warning(f"No speaker segments with text found for meeting {meeting_id}")
                return self._generate_fallback_summary(meeting, language)
            
            # Build speaker-enhanced transcript
            speaker_transcript = self._build_speaker_transcript(speakers, speaker_segments)
            
            # Generate speaker statistics
            speaker_stats = self._generate_speaker_statistics(speakers, speaker_segments)
            
            # Get the enhanced prompt (legacy)
            prompt_template = get_speaker_enhanced_summary_prompt(language)
            
            # Format the prompt with speaker data
            prompt = prompt_template.format(
                transcript_with_speakers=speaker_transcript,
                speaker_stats=speaker_stats
            )
            
            logger.info(f"🎤 Generating legacy speaker-enhanced summary for meeting {meeting_id} with {len(speakers)} speakers")
            
            # Generate summary using Ollama
            enhanced_summary = self.ollama_client.generate(
                prompt,
                options={
                    "temperature": 0.3,  # Slightly higher for more creative speaker insights
                    "top_p": 0.9,
                    "top_k": 15,
                    "num_predict": 800,  # Longer output for detailed speaker analysis
                }
            )
            
            # Parse and structure the summary
            summary_data = self._parse_enhanced_summary(enhanced_summary)
            
            # Add speaker insights
            summary_data["speaker_insights"] = self._extract_speaker_insights(speakers, speaker_segments)
            summary_data["conversation_flow"] = self._analyze_conversation_flow(speaker_segments)
            
            logger.info(f"✅ Legacy speaker-enhanced summary generated successfully for meeting {meeting_id}")
            
            return {
                "summary": enhanced_summary,
                "structured_summary": summary_data,
                "speaker_count": len(speakers),
                "total_segments": len(speaker_segments),
                "language": language,
                "summary_type": "speaker_enhanced_legacy"
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to generate legacy speaker-enhanced summary for meeting {meeting_id}: {e}")
            # Fallback to regular summary
            return self._generate_fallback_summary(meeting, language)
    
    def _build_speaker_transcript(
        self, 
        speakers: List[Speaker], 
        segments: List[SpeakerSegment]
    ) -> str:
        """Build a formatted transcript with speaker labels"""
        
        # Create speaker lookup
        speaker_lookup = {speaker.id: speaker.display_name for speaker in speakers}
        
        # Build transcript with timestamps and speaker labels
        transcript_lines = []
        
        for segment in segments:
            speaker_name = speaker_lookup.get(segment.speaker_id, "Unknown Speaker")
            
            # Format: [MM:SS] Speaker 1: "Text content"
            start_time = segment.start_time
            minutes = int(start_time // 60)
            seconds = int(start_time % 60)
            time_stamp = f"[{minutes:02d}:{seconds:02d}]"
            
            transcript_lines.append(f"{time_stamp} {speaker_name}: \"{segment.text.strip()}\"")
        
        return "\n".join(transcript_lines)
    
    def _generate_speaker_statistics(
        self, 
        speakers: List[Speaker], 
        segments: List[SpeakerSegment]
    ) -> str:
        """Generate formatted speaker statistics for the prompt"""
        
        stats_lines = []
        
        for speaker in sorted(speakers, key=lambda s: s.total_duration, reverse=True):
            # Calculate words per minute
            total_words = sum(
                segment.word_count or len(segment.text.split()) 
                for segment in segments 
                if segment.speaker_id == speaker.id and segment.text
            )
            wpm = total_words / (speaker.total_duration / 60) if speaker.total_duration > 0 else 0
            
            stats_lines.append(
                f"- {speaker.display_name}: "
                f"{speaker.talking_time_percentage:.1f}% talking time, "
                f"{speaker.total_segments} segments, "
                f"{speaker.total_duration:.1f}s total, "
                f"{wpm:.0f} words/min"
            )
        
        return "\n".join(stats_lines)
    
    def _parse_enhanced_summary(self, summary_text: str) -> Dict[str, Any]:
        """Parse the enhanced summary into structured components"""
        
        # Basic parsing - in a production system, you might want more sophisticated parsing
        sections = {}
        current_section = None
        current_content = []
        
        for line in summary_text.split('\n'):
            line = line.strip()
            if line.startswith('##'):
                # Save previous section
                if current_section:
                    sections[current_section] = '\n'.join(current_content)
                
                # Start new section
                current_section = line.replace('##', '').strip().lower().replace(' ', '_')
                current_content = []
            elif line and current_section:
                current_content.append(line)
        
        # Save last section
        if current_section:
            sections[current_section] = '\n'.join(current_content)
        
        return sections
    
    def _extract_speaker_insights(
        self, 
        speakers: List[Speaker], 
        segments: List[SpeakerSegment]
    ) -> List[Dict[str, Any]]:
        """Extract detailed insights for each speaker"""
        
        insights = []
        
        for speaker in speakers:
            speaker_segments = [s for s in segments if s.speaker_id == speaker.id]
            
            if not speaker_segments:
                continue
            
            # Calculate metrics
            total_words = sum(len(s.text.split()) for s in speaker_segments if s.text)
            avg_segment_length = total_words / len(speaker_segments) if speaker_segments else 0
            
            # Analyze speaking patterns
            speaking_pattern = "consistent" if len(speaker_segments) > 5 else "sporadic"
            if speaker.total_duration > 60:  # More than 1 minute
                engagement_level = "high"
            elif speaker.total_duration > 20:  # More than 20 seconds
                engagement_level = "medium"
            else:
                engagement_level = "low"
            
            insights.append({
                "speaker_id": speaker.id,
                "display_name": speaker.display_name,
                "custom_name": speaker.custom_name,
                "talking_time_percentage": speaker.talking_time_percentage,
                "total_segments": speaker.total_segments,
                "total_words": total_words,
                "avg_segment_length": avg_segment_length,
                "speaking_pattern": speaking_pattern,
                "engagement_level": engagement_level,
                "color": speaker.speaker_color
            })
        
        return sorted(insights, key=lambda x: x["talking_time_percentage"], reverse=True)
    
    def _analyze_conversation_flow(self, segments: List[SpeakerSegment]) -> Dict[str, Any]:
        """Analyze the flow of conversation between speakers"""
        
        if len(segments) < 2:
            return {"speaker_transitions": 0, "dominant_speaker": None}
        
        # Count speaker transitions
        transitions = 0
        speaker_turn_counts = {}
        
        prev_speaker = None
        for segment in segments:
            if segment.speaker_id != prev_speaker:
                transitions += 1
                speaker_turn_counts[segment.speaker_id] = speaker_turn_counts.get(segment.speaker_id, 0) + 1
            prev_speaker = segment.speaker_id
        
        # Find dominant speaker (most turns)
        dominant_speaker = max(speaker_turn_counts.items(), key=lambda x: x[1])[0] if speaker_turn_counts else None
        
        return {
            "speaker_transitions": transitions,
            "average_turn_length": len(segments) / transitions if transitions > 0 else 0,
            "dominant_speaker_id": dominant_speaker,
            "speaker_turn_counts": speaker_turn_counts
        }
    
    def _generate_fallback_summary(self, meeting: Meeting, language: str) -> Dict[str, Any]:
        """Generate a fallback summary when speaker data is not available"""
        
        logger.info(f"Generating fallback summary for meeting {meeting.id}")
        
        # Get transcription
        from ..models import Transcription
        db = next(get_db())
        transcription = db.query(Transcription).filter(Transcription.meeting_id == meeting.id).first()
        
        if not transcription:
            return {
                "summary": "No transcription available for this meeting.",
                "structured_summary": {},
                "speaker_count": 0,
                "total_segments": 0,
                "language": language,
                "summary_type": "fallback"
            }
        
        # Use standard summary prompt
        from ..core.prompts import get_single_summary_prompt
        prompt_template = get_single_summary_prompt(language)
        prompt = prompt_template.format(transcript=transcription.text)
        
        fallback_summary = self.ollama_client.generate(
            prompt,
            options={
                "temperature": 0.2,
                "top_p": 0.8,
                "top_k": 10,
                "num_predict": 300,
            }
        )
        
        return {
            "summary": fallback_summary,
            "structured_summary": {"overview": fallback_summary},
            "speaker_count": 0,
            "total_segments": 0,
            "language": language,
            "summary_type": "fallback"
        }


def create_speaker_summary_service(ollama_client: OllamaClient) -> SpeakerSummaryService:
    """Factory function to create a speaker summary service"""
    return SpeakerSummaryService(ollama_client)
