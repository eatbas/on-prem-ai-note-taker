import { useState, useEffect } from 'react'
import { chat } from './api'

export default function AskLlama({ online, vpsUp }: { online: boolean; vpsUp: boolean | null }) {
	const [prompt, setPrompt] = useState('')
	const [response, setResponse] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [model, setModel] = useState<string>('')
	const [availableModels, setAvailableModels] = useState<string[]>([])

	// Initialize with common models (these could be fetched from the VPS later)
	useEffect(() => {
		setAvailableModels([
			'llama2',
			'llama2:7b',
			'llama2:13b',
			'llama2:70b',
			'codellama',
			'codellama:7b',
			'codellama:13b',
			'codellama:34b',
			'llama2-uncensored',
			'llama2:7b-uncensored',
			'llama2:13b-uncensored'
		])
	}, [])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!prompt.trim() || !online || !vpsUp) return

		setLoading(true)
		setError(null)
		setResponse('')

		try {
			const result = await chat(prompt.trim(), model || undefined)
			setResponse(result.response)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to get response from Llama')
		} finally {
			setLoading(false)
		}
	}

	const isDisabled = !online || !vpsUp || loading || !prompt.trim()

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
					🤖 Ask Llama
				</h2>
				<p style={{
					margin: '0',
					fontSize: '1.1rem',
					color: '#64748b',
					lineHeight: '1.6'
				}}>
					Ask Llama anything! This AI assistant can help with questions, analysis, writing, and more.
				</p>
				
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
				{/* Model selector */}
				<div style={{
					marginBottom: '16px',
					display: 'flex',
					alignItems: 'center',
					gap: '12px'
				}}>
					<label style={{
						fontSize: '14px',
						fontWeight: '500',
						color: '#374151',
						minWidth: '80px'
					}}>
						Model:
					</label>
					<select
						value={model}
						onChange={(e) => setModel(e.target.value)}
						disabled={!online || !vpsUp}
						style={{
							padding: '8px 12px',
							border: '1px solid #d1d5db',
							borderRadius: '6px',
							fontSize: '14px',
							backgroundColor: (!online || !vpsUp) ? '#f3f4f6' : 'white',
							color: (!online || !vpsUp) ? '#9ca3af' : '#374151',
							minWidth: '200px'
						}}
					>
						<option value="">Default (Auto-select)</option>
						{availableModels.map((modelName) => (
							<option key={modelName} value={modelName}>
								{modelName}
							</option>
						))}
					</select>
					<span style={{
						fontSize: '12px',
						color: '#6b7280',
						fontStyle: 'italic'
					}}>
						Leave empty to use the default model
					</span>
				</div>

				<div style={{
					display: 'flex',
					gap: '12px',
					alignItems: 'flex-start'
				}}>
					<textarea
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder="Ask Llama anything... (e.g., 'Explain quantum computing', 'Write a poem about AI', 'Help me plan a project')"
						disabled={!online || !vpsUp}
						style={{
							flex: 1,
							minHeight: '120px',
							padding: '16px',
							border: '2px solid #d1d5db',
							borderRadius: '8px',
							fontSize: '16px',
							fontFamily: 'inherit',
							resize: 'vertical',
							backgroundColor: (!online || !vpsUp) ? '#f3f4f6' : 'white',
							color: (!online || !vpsUp) ? '#9ca3af' : '#374151'
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
						{loading ? '🤔 Thinking...' : '💬 Ask Llama'}
					</button>
					{response && (
						<button
							type="button"
							onClick={() => {
								setResponse('')
								setError(null)
							}}
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

			{/* Response display */}
			{response && (
				<div style={{
					padding: '24px',
					backgroundColor: '#f0f9ff',
					border: '2px solid #0ea5e9',
					borderRadius: '12px',
					marginTop: '24px'
				}}>
					<div style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: '16px'
					}}>
						<h3 style={{
							margin: 0,
							fontSize: '1.3rem',
							fontWeight: '600',
							color: '#0c4a6e',
							display: 'flex',
							alignItems: 'center',
							gap: '8px'
						}}>
							🤖 Llama's Response
						</h3>
						{model && (
							<span style={{
								fontSize: '12px',
								color: '#0c4a6e',
								backgroundColor: 'white',
								padding: '4px 8px',
								borderRadius: '6px',
								border: '1px solid #0ea5e9',
								fontWeight: '500'
							}}>
								Model: {model}
							</span>
						)}
					</div>
					<div style={{
						fontSize: '16px',
						lineHeight: '1.7',
						color: '#0c4a6e',
						whiteSpace: 'pre-wrap'
					}}>
						{response}
					</div>
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
			{online && vpsUp && !response && (
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
