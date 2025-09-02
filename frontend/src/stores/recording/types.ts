/**
 * Recording Manager Types and Interfaces
 */

export interface GlobalRecordingState {
	isRecording: boolean
	meetingId: string | null
	recordingTime: number
	chunkIndex: number
	recordingInterval: number | null
	startTime: number | null
	// Simplified single-stream audio recording state
	micStream: MediaStream | null
	micRecorder: MediaRecorder | null
	micChunkIndex: number
	forceDataInterval: number | null
	error: string | null
	language: 'tr' | 'en' | 'auto'
}

export interface RecordingOptions {
	micDeviceId?: string
	language: 'tr' | 'en' | 'auto'
	showFloatingWidget?: boolean
	scope?: 'personal' | number  // 'personal' or workspace ID
}

export interface StartRecordingResult {
	success: boolean
	meetingId?: string
	error?: string
}

export interface InterruptedRecordingInfo {
	meetingId: string
	recordingTime: number
}

export type StateListener = (state: GlobalRecordingState) => void
