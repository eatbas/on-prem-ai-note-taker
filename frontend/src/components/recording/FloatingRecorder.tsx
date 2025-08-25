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

	// Notify main when recording starts/stops
	useEffect(() => {
		if (!isElectron) return
		if (isRecording) {
			;(window as any).electronAPI.sendRecordingStarted({ meetingId, recordingTime })
		} else {
			;(window as any).electronAPI.sendRecordingStopped({ meetingId, recordingTime })
		}
	}, [isRecording])

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
