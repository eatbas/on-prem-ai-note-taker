// Speaker Diarization Service for VPS AI Summarization
import { invoke } from '@tauri-apps/api/core';

export interface SpeakerSegment {
  speaker_id: string;      // "Speaker1", "Speaker2", etc.
  start_time: number;      // Start time in seconds
  end_time: number;        // End time in seconds
  text: string;            // What this speaker said
  confidence: number;      // Confidence score for this segment
}

export interface FormattedTranscriptionResult {
  formatted_output: string;       // Ready-to-send to VPS AI
  detected_language: string;      // "en", "tr", or "auto"
  total_speakers: number;         // Number of speakers detected
  duration_minutes: number;       // Total duration in minutes
  confidence: number;             // Overall confidence score
}

export class SpeakerDiarizationService {
  /**
   * Get formatted transcript ready for VPS AI summarization
   * Perfect for sending to your AI model for meeting summaries
   */
  static async getFormattedTranscriptForAI(
    audioData: Float32Array,
    sampleRate: number,
    language?: 'en' | 'tr' | 'auto'
  ): Promise<FormattedTranscriptionResult> {
    try {
      const result = await invoke<FormattedTranscriptionResult>('get_formatted_transcript_for_ai', {
        audio_data: Array.from(audioData),
        sample_rate: sampleRate,
        language: language || 'auto'
      });

      console.log(`🎙️ Speaker diarization complete: ${result.total_speakers} speakers, ${result.duration_minutes.toFixed(1)} minutes`);
      return result;
    } catch (error) {
      console.error('❌ Speaker diarization failed:', error);
      throw new Error(`Speaker diarization failed: ${error}`);
    }
  }

  /**
   * Get detailed speaker segments for custom processing
   */
  static async getSpeakerSegments(
    audioData: Float32Array,
    sampleRate: number,
    language?: 'en' | 'tr' | 'auto'
  ): Promise<SpeakerSegment[]> {
    try {
      const segments = await invoke<SpeakerSegment[]>('get_speaker_segments', {
        audio_data: Array.from(audioData),
        sample_rate: sampleRate,
        language: language || 'auto'
      });

      console.log(`👥 Found ${segments.length} speaker segments`);
      return segments;
    } catch (error) {
      console.error('❌ Failed to get speaker segments:', error);
      throw new Error(`Failed to get speaker segments: ${error}`);
    }
  }

  /**
   * Send formatted transcript to VPS for AI summarization
   * This is exactly what you requested for your workflow
   */
  static async sendToVPSForSummarization(
    formattedOutput: string,
    vpsEndpoint: string = process.env.VITE_API_BASE_URL + '/meetings/summarize'
  ): Promise<string> {
    try {
      const response = await fetch(vpsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: formattedOutput,
          request_type: 'speaker_diarized_summary'
        })
      });

      if (!response.ok) {
        throw new Error(`VPS request failed: ${response.statusText}`);
      }

      const summary = await response.text();
      console.log('✅ AI summarization complete');
      return summary;
    } catch (error) {
      console.error('❌ VPS summarization failed:', error);
      throw new Error(`VPS summarization failed: ${error}`);
    }
  }

  /**
   * Complete workflow: Record → Diarize → Send to VPS → Get Summary
   * This is your end-to-end solution
   */
  static async completeWorkflow(
    audioData: Float32Array,
    sampleRate: number,
    language?: 'en' | 'tr' | 'auto'
  ): Promise<{
    formattedTranscript: string;
    speakerSegments: SpeakerSegment[];
    aiSummary: string;
  }> {
    console.log('🚀 Starting complete speaker diarization workflow...');

    // Step 1: Get formatted transcript
    const transcriptResult = await this.getFormattedTranscriptForAI(audioData, sampleRate, language);
    
    // Step 2: Get detailed segments  
    const segments = await this.getSpeakerSegments(audioData, sampleRate, language);
    
    // Step 3: Send to VPS for AI summarization
    const aiSummary = await this.sendToVPSForSummarization(transcriptResult.formatted_output);

    console.log('✅ Complete workflow finished successfully');
    
    return {
      formattedTranscript: transcriptResult.formatted_output,
      speakerSegments: segments,
      aiSummary
    };
  }
}

// Example usage for your exact use case:
/*
// Record audio and get speaker-diarized summary
const audioData = new Float32Array(recordedAudio);
const result = await SpeakerDiarizationService.completeWorkflow(audioData, 44100, 'auto');

// The formatted output looks like:
// Language: en
// 
// === SPEAKER TRANSCRIPT FOR AI SUMMARIZATION ===
// Total Speakers: 2
// Duration: 5.2 minutes
//
// Speaker1: Hello, let's discuss the project timeline. [Confidence: 87.3%]
//
// Speaker2: Great, I think we should focus on the backend first. [Confidence: 91.2%]
//
// Speaker1: That makes sense. What about the database schema? [Confidence: 89.7%]
//
// === END TRANSCRIPT ===
// Please summarize this conversation, identifying key topics discussed by each speaker.
*/
