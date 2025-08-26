import React, { useEffect } from 'react'

interface FloatingRecorderProps {
	isRecording: boolean
	recordingTime: number
	onStopRecording: () => void
	meetingId?: string | null
}

export default function FloatingRecorder({ 
	isRecording, 
	recordingTime, 
	onStopRecording,
	meetingId 
}: FloatingRecorderProps) {
	const isElectron = typeof window !== 'undefined' && (window as any).electronAPI

    // Floating widget does NOT initiate start/stop; renderer (Recorder) does.

	// Send timer updates every second to main so floating window stays in sync
	useEffect(() => {
		if (!isElectron || !isRecording) return
		;(window as any).electronAPI.updateFloatingRecorderState({
			isRecording: true,
			meetingId,
			recordingTime
		})
	}, [recordingTime, isRecording, meetingId])

	// Listen for stop command from floating window
	useEffect(() => {
		if (!isElectron) return
		const handler = () => onStopRecording()
		;(window as any).electronAPI.onStopRecordingFromFloating?.(handler)
		return () => {
			;(window as any).electronAPI.removeStopRecordingFromFloatingListener?.()
		}
	}, [onStopRecording])

	return null
}
