import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRippleEffect } from '../../utils'

interface FloatingRecorderProps {
	isRecording: boolean
	recordingTime: number
	onStopRecording: () => void
}

export default function FloatingRecorder({ 
	isRecording, 
	recordingTime, 
	onStopRecording 
}: FloatingRecorderProps) {
	const [isVisible, setIsVisible] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [position, setPosition] = useState({ x: 20, y: 100 })
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

	// Show/hide based on recording state
	useEffect(() => {
		console.log('🎙️ FloatingRecorder: isRecording changed to:', isRecording)
		setIsVisible(isRecording)
	}, [isRecording])

	// Debug timer updates
	useEffect(() => {
		console.log('⏱️ FloatingRecorder: Timer updated to:', recordingTime)
	}, [recordingTime])

	// Handle mouse down for dragging
	const handleMouseDown = (e: React.MouseEvent) => {
		console.log('🎙️ FloatingRecorder: Mouse down - starting drag')
		// Allow dragging from anywhere on the recorder widget
		setIsDragging(true)
		const rect = e.currentTarget.getBoundingClientRect()
		setDragOffset({
			x: e.clientX - rect.left,
			y: e.clientY - rect.top
		})
		
		// Prevent text selection during drag
		e.preventDefault()
	}

	// Handle mouse move for dragging
	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (isDragging) {
				let newX = e.clientX - dragOffset.x
				let newY = e.clientY - dragOffset.y
				
				// Get screen dimensions
				const screenWidth = window.innerWidth
				const screenHeight = window.innerHeight
				const recorderWidth = 320 // Approximate width of the recorder
				const recorderHeight = 80 // Approximate height of the recorder
				
				// Keep recorder within screen bounds
				newX = Math.max(0, Math.min(newX, screenWidth - recorderWidth))
				newY = Math.max(0, Math.min(newY, screenHeight - recorderHeight))
				
				console.log('🎙️ FloatingRecorder: Dragging to position:', { x: newX, y: newY })
				setPosition({
					x: newX,
					y: newY
				})
			}
		}

		const handleMouseUp = () => {
			console.log('🎙️ FloatingRecorder: Mouse up - stopping drag')
			setIsDragging(false)
		}

		if (isDragging) {
			document.addEventListener('mousemove', handleMouseMove)
			document.addEventListener('mouseup', handleMouseUp)
		}

		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}
	}, [isDragging, dragOffset])

	// Format recording time
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
	}

	// Handle stop button click
	const handleStopClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		createRippleEffect(e)
		onStopRecording()
	}

	console.log('🎙️ FloatingRecorder: render check - isVisible:', isVisible, 'isRecording:', isRecording)
	if (!isVisible) return null

	// Create the floating recorder content
	const floatingRecorderContent = (
		<div
			style={{
				position: 'fixed',
				zIndex: 9999,
				userSelect: 'none',
				left: position.x,
				top: position.y,
				cursor: isDragging ? 'grabbing' : 'grab',
				transform: isDragging ? 'scale(1.02)' : 'scale(1)',
				transition: 'transform 0.1s ease',
				pointerEvents: 'auto'
			}}
		>
			<div 
				style={{
					backgroundColor: '#1f2937',
					border: '3px solid #ef4444',
					borderRadius: '8px',
					padding: '12px',
					boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
					display: 'flex',
					alignItems: 'center',
					gap: '12px',
					minWidth: '320px'
				}}
				onMouseDown={handleMouseDown}
			>
				{/* Drag Handle */}
				<div style={{
					display: 'flex',
					flexDirection: 'column',
					gap: '4px',
					opacity: 0.7
				}}>
					<div style={{
						width: '12px',
						height: '2px',
						backgroundColor: '#9ca3af',
						borderRadius: '4px'
					}}></div>
					<div style={{
						width: '12px',
						height: '2px',
						backgroundColor: '#9ca3af',
						borderRadius: '4px'
					}}></div>
					<div style={{
						width: '12px',
						height: '2px',
						backgroundColor: '#9ca3af',
						borderRadius: '4px'
					}}></div>
				</div>

				{/* Stop Button */}
				<button
					onClick={handleStopClick}
					style={{
						width: '36px',
						height: '36px',
						backgroundColor: '#ef4444',
						border: 'none',
						borderRadius: '50%',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						transition: 'all 0.2s ease',
						cursor: 'pointer'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = '#dc2626'
						e.currentTarget.style.transform = 'scale(1.1)'
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = '#ef4444'
						e.currentTarget.style.transform = 'scale(1)'
					}}
				>
					<div style={{
						width: '12px',
						height: '12px',
						backgroundColor: 'white',
						borderRadius: '2px'
					}}></div>
				</button>

				{/* Timer */}
				<div style={{
					color: 'white',
					fontFamily: 'monospace',
					fontSize: '20px',
					fontWeight: 'bold',
					minWidth: '55px'
				}}>
					{formatTime(recordingTime)}
				</div>

				{/* Audio Level Bars */}
				<div style={{ flex: 1 }}>
					<div style={{
						display: 'flex',
						gap: '4px',
						alignItems: 'flex-end',
						height: '24px'
					}}>
						{Array.from({ length: 14 }).map((_, i) => (
							<div
								key={i}
								style={{
									width: '4px',
									backgroundColor: '#60a5fa',
									borderRadius: '2px',
									transition: 'all 0.1s ease',
									height: `${Math.max(3, 8 + Math.sin(Date.now() * 0.01 + i) * 8)}px`
								}}
							/>
						))}
					</div>
					<div style={{
						width: '100%',
						height: '4px',
						backgroundColor: '#4b5563',
						borderRadius: '2px',
						overflow: 'hidden',
						marginTop: '8px'
					}}>
						<div 
							style={{
								height: '100%',
								backgroundColor: '#22c55e',
								transition: 'width 1s ease',
								width: `${Math.min(100, (recordingTime / 3600) * 100)}%`
							}}
						/>
					</div>
				</div>

				{/* Microphone Icon */}
				<div style={{
					color: 'white',
					fontSize: '18px'
				}}>🎤</div>
			</div>
		</div>
	)

	// Render to document body using portal for true desktop floating
	return createPortal(floatingRecorderContent, document.body)
}
