import { useState, useEffect } from 'react'
import { chat } from './api'

export default function AskLlama({ online, vpsUp }: { online: boolean; vpsUp: boolean | null }) {
	const [prompt, setPrompt] = useState('')
	const [chatHistory, setChatHistory] = useState<Array<{
		id: number
		question: string
		answer: string
		model: string
		timestamp: Date
	}>>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [model] = useState<string>('AI Assistant') // Generic name instead of hardcoded model
	const [requestId, setRequestId] = useState(0)

	// Remove the availableModels state and useEffect since we only have one model

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!prompt.trim() || !online || !vpsUp || loading) return

		// Increment request ID and clear previous state
		const currentRequestId = requestId + 1
		setRequestId(currentRequestId)
		setError(null)
		setLoading(true)

		// Store the current prompt to ensure we're setting response for the right request
		const currentPrompt = prompt.trim()
		const currentModel = model || undefined

		try {
			console.log(`[Request ${currentRequestId}] Sending chat request:`, { prompt: currentPrompt, model: currentModel })
			const result = await chat(currentPrompt, currentModel)
			console.log(`[Request ${currentRequestId}] Chat response received:`, result)
			
			// Only update chat history if this is still the current request
			if (currentRequestId === requestId + 1) {
				const newChatEntry = {
					id: currentRequestId,
					question: currentPrompt,
					answer: result.response,
					model: currentModel || 'AI Assistant',
					timestamp: new Date()
				}
				setChatHistory(prev => [...prev, newChatEntry])
				setPrompt('') // Clear the input after successful submission
			}
		} catch (err) {
			console.error(`[Request ${currentRequestId}] Chat request failed:`, err)
			// Only update error if this is still the current request
			if (currentRequestId === requestId + 1) {
				setError(err instanceof Error ? err.message : 'Failed to get response from AI Assistant')
			}
		} finally {
			// Only update loading if this is still the current request
			if (currentRequestId === requestId + 1) {
				setLoading(false)
			}
		}
	}

	const handleCancel = () => {
		setLoading(false)
		setError('Request cancelled by user')
	}

	const isDisabled = !online || !vpsUp || loading || !prompt.trim()

	const resetChat = () => {
		setChatHistory([])
		setError(null)
		setPrompt('')
		setRequestId(0)
	}

	return (
		<div style={{ padding: '24px 0' }}>
			<div style={{ 
				textAlign: 'center', 
				marginBottom: '32px',
				padding: '24px',
				backgroundColor: '#f8fafc',
				borderRadius: '12px',
				border: '2px solid #e2e8f0'
			}}>
				<h2 style={{
					margin: '0 0 16px 0',
					fontSize: '1.8rem',
					fontWeight: '600',
					color: '#1e293b'
				}}>
					🤖 Ask AI Assistant
				</h2>
				<p style={{
					margin: '0',
					fontSize: '1.1rem',
					color: '#64748b',
					lineHeight: '1.6'
				}}>
					Ask your AI assistant anything! This AI can help with questions, analysis, writing, and more.
				</p>
				
				{/* Model indicator */}
				<div style={{
					marginTop: '12px',
					padding: '8px 16px',
					backgroundColor: '#e0f2fe',
					border: '1px solid #0ea5e9',
					borderRadius: '8px',
					display: 'inline-block'
				}}>
					<span style={{
						fontSize: '14px',
						fontWeight: '600',
						color: '#0c4a6e'
					}}>
						🤖 AI Assistant Ready
					</span>
				</div>
				
				{/* Status indicators */}
				<div style={{
					display: 'flex',
					justifyContent: 'center',
					gap: '16px',
					marginTop: '16px'
				}}>
					<span style={{ 
						fontSize: '14px', 
						fontWeight: '500',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '8px 16px',
						backgroundColor: online ? '#dcfce7' : '#fee2e2',
						color: online ? '#166534' : '#dc2626',
						borderRadius: '8px',
						border: `1px solid ${online ? '#bbf7d0' : '#fecaca'}`
					}}>
						{online ? '🟢' : '🔴'} {online ? 'Online' : 'Offline'}
					</span>
					<span style={{ 
						fontSize: '14px',
						fontWeight: '500',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '8px 16px',
						backgroundColor: vpsUp ? '#dcfce7' : vpsUp === null ? '#fef3c7' : '#fee2e2',
						color: vpsUp ? '#166534' : vpsUp === null ? '#92400e' : '#dc2626',
						borderRadius: '8px',
						border: `1px solid ${vpsUp ? '#bbf7d0' : vpsUp === null ? '#fde68a' : '#fecaca'}`
					}}>
						{vpsUp === null ? '⏳' : vpsUp ? '🟢' : '🔴'} VPS {vpsUp === null ? 'Checking...' : vpsUp ? 'Connected' : 'Disconnected'}
					</span>
					<button
						onClick={() => window.location.reload()}
						style={{
							padding: '8px 16px',
							backgroundColor: '#3b82f6',
							color: 'white',
							border: 'none',
							borderRadius: '8px',
							fontSize: '14px',
							fontWeight: '600',
							cursor: 'pointer',
							transition: 'all 0.2s ease',
							display: 'flex',
							alignItems: 'center',
							gap: '8px'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = '#2563eb'
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = '#3b82f6'
						}}
					>
						🔄 Refresh Status
					</button>
				</div>
			</div>

			{/* Chat form */}
			<form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
				{/* Loading indicator */}
				{loading && (
					<div style={{
						padding: '12px 16px',
						backgroundColor: '#fef3c7',
						border: '1px solid #f59e0b',
						borderRadius: '8px',
						marginBottom: '16px',
						textAlign: 'center',
						color: '#92400e',
						fontWeight: '500'
					}}>
						⏳ Form is disabled while processing request #{requestId + 1}. Please wait or cancel the request.
					</div>
				)}

				{/* Status message */}
				{loading && (
					<div style={{
						padding: '12px 16px',
						backgroundColor: '#dbeafe',
						border: '1px solid #3b82f6',
						borderRadius: '8px',
						marginBottom: '16px',
						textAlign: 'center',
						color: '#1e40af',
						fontWeight: '500'
					}}>
						🔄 Processing request #{requestId + 1}... Please wait or cancel if needed.
					</div>
				)}

				<div style={{
					display: 'flex',
					gap: '12px',
					alignItems: 'flex-start'
				}}>
					<textarea
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder="Ask your AI assistant anything... (e.g., 'Explain quantum computing', 'Write a poem about AI', 'Help me plan a project')"
						disabled={!online || !vpsUp || loading}
						style={{
							flex: 1,
							minHeight: '120px',
							padding: '16px',
							border: '2px solid #d1d5db',
							borderRadius: '8px',
							fontSize: '16px',
							fontFamily: 'inherit',
							resize: 'vertical',
							backgroundColor: (!online || !vpsUp || loading) ? '#f3f4f6' : 'white',
							color: (!online || !vpsUp || loading) ? '#9ca3af' : '#374151'
						}}
					/>
					<button
						type="submit"
						disabled={isDisabled}
						style={{
							padding: '16px 24px',
							backgroundColor: isDisabled ? '#9ca3af' : '#3b82f6',
							color: 'white',
							border: 'none',
							borderRadius: '8px',
							fontSize: '16px',
							fontWeight: '600',
							cursor: isDisabled ? 'not-allowed' : 'pointer',
							transition: 'all 0.2s ease',
							whiteSpace: 'nowrap',
							minWidth: '120px'
						}}
						onMouseEnter={(e) => {
							if (!isDisabled) {
								e.currentTarget.style.backgroundColor = '#2563eb'
							}
						}}
						onMouseLeave={(e) => {
							if (!isDisabled) {
								e.currentTarget.style.backgroundColor = '#3b82f6'
							}
						}}
					>
						{loading ? '🤔 Thinking...' : '💬 Ask AI Assistant'}
					</button>
					{chatHistory.length > 0 && (
						<button
							type="button"
							onClick={resetChat}
							style={{
								padding: '16px 24px',
								backgroundColor: '#6b7280',
								color: 'white',
								border: 'none',
								borderRadius: '8px',
								fontSize: '16px',
								fontWeight: '600',
								cursor: 'pointer',
								transition: 'all 0.2s ease',
								whiteSpace: 'nowrap',
								minWidth: '120px'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = '#4b5563'
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = '#6b7280'
							}}
						>
							🗑️ Clear Chat
						</button>
					)}
					{chatHistory.length > 0 && (
						<button
							type="button"
							onClick={resetChat}
							style={{
								padding: '16px 24px',
								backgroundColor: '#10b981',
								color: 'white',
								border: 'none',
								borderRadius: '8px',
								fontSize: '16px',
								fontWeight: '600',
								cursor: 'pointer',
								transition: 'all 0.2s ease',
								whiteSpace: 'nowrap',
								minWidth: '120px'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = '#059669'
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = '#10b981'
							}}
						>
							💬 New Chat
						</button>
					)}
					{loading && (
						<button
							type="button"
							onClick={handleCancel}
							style={{
								padding: '16px 24px',
								backgroundColor: '#ef4444',
								color: 'white',
								border: 'none',
								borderRadius: '8px',
								fontSize: '16px',
								fontWeight: '600',
								cursor: 'pointer',
								transition: 'all 0.2s ease',
								whiteSpace: 'nowrap',
								minWidth: '120px'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = '#dc2626'
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = '#ef4444'
							}}
						>
							⚠️ Cancel Request
						</button>
					)}
				</div>
			</form>

			{/* Error display */}
			{error && (
				<div style={{ 
					padding: '16px', 
					backgroundColor: '#fee2e2', 
					border: '1px solid #fecaca',
					borderRadius: '8px',
					marginBottom: '24px',
					color: '#dc2626'
				}}>
					⚠️ <strong>Error:</strong> {error}
				</div>
			)}

			{/* Chat history display */}
			{chatHistory.length > 0 && (
				<div style={{ marginTop: '24px' }}>
					<h3 style={{
						margin: '0 0 16px 0',
						fontSize: '1.3rem',
						fontWeight: '600',
						color: '#0c4a6e',
						display: 'flex',
						alignItems: 'center',
						gap: '8px'
					}}>
						💬 Chat History ({chatHistory.length} conversations)
					</h3>
					
					{chatHistory.map((chat, index) => (
						<div key={chat.id} style={{
							marginBottom: '24px',
							border: '2px solid #e2e8f0',
							borderRadius: '12px',
							overflow: 'hidden'
						}}>
							{/* Question section */}
							<div style={{
								padding: '16px 20px',
								backgroundColor: '#f8fafc',
								borderBottom: '1px solid #e2e8f0'
							}}>
								<div style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									marginBottom: '8px'
								}}>
									<span style={{
										fontSize: '14px',
										fontWeight: '600',
										color: '#64748b'
									}}>
										👤 Your Question #{chat.id}
									</span>
									<span style={{
										fontSize: '12px',
										color: '#94a3b8',
										fontStyle: 'italic'
									}}>
										{chat.timestamp.toLocaleTimeString()}
									</span>
								</div>
								<div style={{
									fontSize: '16px',
									lineHeight: '1.6',
									color: '#374151',
									whiteSpace: 'pre-wrap'
								}}>
									{chat.question}
								</div>
							</div>
							
							{/* Answer section */}
							<div style={{
								padding: '20px',
								backgroundColor: '#f0f9ff',
								borderLeft: '4px solid #0ea5e9'
							}}>
								<div style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									marginBottom: '12px'
								}}>
									<span style={{
										fontSize: '14px',
										fontWeight: '600',
										color: '#0c4a6e'
									}}>
										🤖 Llama's Response
									</span>
									<div style={{
										display: 'flex',
										alignItems: 'center',
										gap: '8px'
									}}>
										<span style={{
											fontSize: '12px',
											color: '#0c4a6e',
											backgroundColor: 'white',
											padding: '4px 8px',
											borderRadius: '6px',
											border: '1px solid #0ea5e9',
											fontWeight: '500'
										}}>
											Model: {chat.model}
										</span>
										<span style={{
											fontSize: '12px',
											color: '#0c4a6e',
											backgroundColor: 'white',
											padding: '4px 8px',
											borderRadius: '6px',
											border: '1px solid #0ea5e9',
											fontWeight: '500'
										}}>
											Request #{chat.id}
										</span>
									</div>
								</div>
								<div style={{
									fontSize: '16px',
									lineHeight: '1.7',
									color: '#0c4a6e',
									whiteSpace: 'pre-wrap'
								}}>
									{chat.answer}
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Help text when offline or VPS down */}
			{(!online || !vpsUp) && (
				<div style={{
					padding: '20px',
					backgroundColor: '#fef3c7',
					border: '1px solid #fde68a',
					borderRadius: '8px',
					textAlign: 'center',
					color: '#92400e'
				}}>
					<p style={{ margin: '0 0 12px 0', fontWeight: '500' }}>
						{!online ? '🔴 You are currently offline' : '🔴 VPS connection is down'}
					</p>
					<p style={{ margin: '0', fontSize: '14px' }}>
						{!online 
							? 'Please check your internet connection to use Llama.'
							: 'Please check your VPS connection or contact your administrator.'
						}
					</p>
				</div>
			)}

			{/* Example prompts */}
			{online && vpsUp && !loading && (
				<div style={{
					padding: '20px',
					backgroundColor: '#f8fafc',
					border: '1px solid #e2e8f0',
					borderRadius: '8px',
					marginTop: '24px'
				}}>
					<h4 style={{
						margin: '0 0 16px 0',
						fontSize: '1.1rem',
						fontWeight: '600',
						color: '#374151'
					}}>
						💡 Example prompts to try:
					</h4>
					<div style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
						gap: '12px'
					}}>
						{[
							'Explain quantum computing in simple terms',
							'Write a short poem about artificial intelligence',
							'Help me plan a weekend trip to the mountains',
							'What are the benefits of meditation?',
							'Explain how machine learning works',
							'Give me ideas for a healthy dinner recipe'
						].map((example, index) => (
							<button
								key={index}
								onClick={() => setPrompt(example)}
								style={{
									padding: '12px 16px',
									backgroundColor: 'white',
									border: '1px solid #d1d5db',
									borderRadius: '6px',
									fontSize: '14px',
									color: '#374151',
									cursor: 'pointer',
									transition: 'all 0.2s ease',
									textAlign: 'left',
									lineHeight: '1.4'
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.backgroundColor = '#f3f4f6'
									e.currentTarget.style.borderColor = '#9ca3af'
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.backgroundColor = 'white'
									e.currentTarget.style.borderColor = '#d1d5db'
								}}
							>
								{example}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
