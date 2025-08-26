import { useEffect, useState } from 'react'

interface ToastProps {
	message: string
	type: 'success' | 'error' | 'info'
	onClose: () => void
	duration?: number
}

export default function Toast({ message, type, onClose, duration = 2000 }: ToastProps) {
	const [isVisible, setIsVisible] = useState(true)

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(false)
			setTimeout(onClose, 300) // Wait for fade out animation
		}, duration)

		return () => clearTimeout(timer)
	}, [duration, onClose])

	const getToastStyles = () => {
		const baseStyles = {
			position: 'fixed' as const,
			bottom: '20px',
			left: '20px',
			padding: '16px 20px',
			borderRadius: '8px',
			color: 'white',
			fontWeight: '500',
			zIndex: 10000,
			maxWidth: '400px',
			boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
			transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
			opacity: isVisible ? 1 : 0,
			transition: 'all 0.3s ease',
			display: 'flex',
			alignItems: 'center',
			gap: '8px'
		}

		switch (type) {
			case 'success':
				return {
					...baseStyles,
					backgroundColor: '#10b981',
					border: '1px solid #059669'
				}
			case 'error':
				return {
					...baseStyles,
					backgroundColor: '#ef4444',
					border: '1px solid #dc2626'
				}
			case 'info':
				return {
					...baseStyles,
					backgroundColor: '#3b82f6',
					border: '1px solid #2563eb'
				}
			default:
				return baseStyles
		}
	}

	const getIcon = () => {
		switch (type) {
			case 'success':
				return '✅'
			case 'error':
				return '❌'
			case 'info':
				return 'ℹ️'
			default:
				return 'ℹ️'
		}
	}

	return (
		<div style={getToastStyles()}>
			<span style={{ fontSize: '18px' }}>{getIcon()}</span>
			<span>{message}</span>
			<button
				onClick={() => {
					setIsVisible(false)
					setTimeout(onClose, 300)
				}}
				style={{
					background: 'none',
					border: 'none',
					color: 'white',
					fontSize: '18px',
					cursor: 'pointer',
					padding: '0',
					marginLeft: 'auto',
					opacity: 0.8,
					transition: 'opacity 0.2s ease'
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.opacity = '1'
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.opacity = '0.8'
				}}
			>
				✕
			</button>
		</div>
	)
}

// Toast manager hook
export function useToast() {
	const [toasts, setToasts] = useState<Array<{
		id: string
		message: string
		type: 'success' | 'error' | 'info'
	}>>([])

	const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
		const id = Math.random().toString(36).substr(2, 9)
		setToasts(prev => [...prev, { id, message, type }])
	}

	const removeToast = (id: string) => {
		setToasts(prev => prev.filter(toast => toast.id !== id))
	}

	const ToastContainer = () => (
		<>
			{toasts.map(toast => (
				<Toast
					key={toast.id}
					message={toast.message}
					type={toast.type}
					onClose={() => removeToast(toast.id)}
				/>
			))}
		</>
	)

	return { showToast, ToastContainer }
}
