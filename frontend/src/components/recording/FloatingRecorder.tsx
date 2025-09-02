import React, { useEffect } from 'react'
import { invoke } from '../../lib/tauri'

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
	const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined

	// Handle Tauri floating recorder
	useEffect(() => {
		if (!isTauri) return

		if (isRecording) {
			// Show Tauri floating recorder and update status
			invoke('show_floating_recorder').catch(console.error)
			invoke('start_recording').catch(console.error)
		} else {
			// Hide floating recorder when not recording
			invoke('hide_floating_recorder').catch(console.error)
			invoke('stop_recording').catch(console.error)
		}
	}, [isRecording, isTauri])

	// Handle Electron floating recorder (existing logic)
	useEffect(() => {
		if (!isElectron || !isRecording) return
		;(window as any).electronAPI.updateFloatingRecorderState({
			isRecording: true,
			meetingId,
			recordingTime
		})
	}, [recordingTime, isRecording, meetingId])

	// Listen for stop command from floating window (Electron)
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
