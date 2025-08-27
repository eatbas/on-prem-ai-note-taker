import React, { useState, useEffect } from 'react'

interface SystemAudioDebuggerProps {
	onClose: () => void
}

export default function SystemAudioDebugger({ onClose }: SystemAudioDebuggerProps) {
	const [debugInfo, setDebugInfo] = useState<any>({})
	const [isTesting, setIsTesting] = useState(false)
	const [testResults, setTestResults] = useState<string[]>([])

	useEffect(() => {
		collectDebugInfo()
	}, [])

	const collectDebugInfo = async () => {
		const info: any = {
			timestamp: new Date().toISOString(),
			userAgent: navigator.userAgent,
			platform: navigator.platform,
			mediaDevices: !!navigator.mediaDevices,
			desktopCapture: !!(window as any).desktopCapture,
		}

		// Check for specific APIs
		if (navigator.mediaDevices) {
			info.getUserMedia = !!navigator.mediaDevices.getUserMedia
			info.getDisplayMedia = !!(navigator.mediaDevices as any).getDisplayMedia
		}

		// Check for Electron-specific features
		if ((window as any).desktopCapture) {
			info.getSources = typeof (window as any).desktopCapture.getSources === 'function'
			info.captureSystemAudio = typeof (window as any).desktopCapture.captureSystemAudio === 'function'
			info.captureDesktopAudio = typeof (window as any).desktopCapture.captureDesktopAudio === 'function'
		}

		setDebugInfo(info)
	}

	const runSystemAudioTest = async () => {
		setIsTesting(true)
		setTestResults([])
		
		const results: string[] = []
		
		try {
			results.push('🧪 Starting system audio capture test...')
			
			// Test 1: Check if desktopCapture API is available
			if (!(window as any).desktopCapture) {
				results.push('❌ desktopCapture API not available')
				setTestResults(results)
				return
			}
			
			results.push('✅ desktopCapture API available')
			
			// Test 2: Try to get sources
			try {
				const sources = await (window as any).desktopCapture.getSources(['screen', 'window'])
				results.push(`✅ Found ${sources.length} desktop sources`)
				sources.forEach((source: any, index: number) => {
					results.push(`   ${index + 1}. ${source.name}`)
				})
			} catch (error: any) {
				results.push(`❌ Failed to get sources: ${error?.message || error}`)
			}
			
			// Test 3: Try modern capture method
			try {
				results.push('🔧 Testing modern getDisplayMedia capture...')
				const stream = await (window as any).desktopCapture.captureSystemAudio()
				if (stream && stream.getAudioTracks().length > 0) {
					results.push(`✅ Modern capture successful! Audio tracks: ${stream.getAudioTracks().length}`)
					// Stop the test stream
					stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
				} else {
					results.push('❌ Modern capture returned no audio tracks')
				}
			} catch (error: any) {
				results.push(`❌ Modern capture failed: ${error?.message || error}`)
			}
			
			// Test 4: Try fallback method
			try {
				results.push('🔧 Testing desktopCapturer fallback...')
				const stream = await (window as any).desktopCapture.captureDesktopAudio()
				if (stream && stream.getAudioTracks().length > 0) {
					results.push(`✅ Fallback capture successful! Audio tracks: ${stream.getAudioTracks().length}`)
					// Stop the test stream
					stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
				} else {
					results.push('❌ Fallback capture returned no audio tracks')
				}
			} catch (error: any) {
				results.push(`❌ Fallback capture failed: ${error?.message || error}`)
			}
			
		} catch (error: any) {
			results.push(`❌ Test failed: ${error?.message || error}`)
		}
		
		results.push('🎯 System audio test complete!')
		setTestResults(results)
		setIsTesting(false)
	}

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-xl font-bold">🔧 System Audio Debugger</h2>
					<button
						onClick={onClose}
						className="text-gray-500 hover:text-gray-700 text-2xl"
					>
						×
					</button>
				</div>
				
				<div className="space-y-4">
					{/* Debug Info */}
					<div className="bg-gray-100 p-4 rounded">
						<h3 className="font-semibold mb-2">📊 System Information</h3>
						<pre className="text-sm overflow-x-auto">
							{JSON.stringify(debugInfo, null, 2)}
						</pre>
					</div>
					
					{/* Test Button */}
					<div className="flex justify-center">
						<button
							onClick={runSystemAudioTest}
							disabled={isTesting}
							className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded"
						>
							{isTesting ? '🧪 Testing...' : '🧪 Run System Audio Test'}
						</button>
					</div>
					
					{/* Test Results */}
					{testResults.length > 0 && (
						<div className="bg-gray-100 p-4 rounded">
							<h3 className="font-semibold mb-2">📋 Test Results</h3>
							<div className="space-y-1">
								{testResults.map((result, index) => (
									<div key={index} className="text-sm font-mono">
										{result}
									</div>
								))}
							</div>
						</div>
					)}
					
					{/* Troubleshooting Tips */}
					<div className="bg-yellow-100 p-4 rounded">
						<h3 className="font-semibold mb-2">💡 Troubleshooting Tips</h3>
						<ul className="text-sm space-y-1">
							<li>• Ensure "System Audio" or "Stereo Mix" is enabled in Windows audio settings</li>
							<li>• Check that your browser/Electron has microphone permissions</li>
							<li>• Try restarting the application if permissions were recently changed</li>
							<li>• On Windows, enable "Stereo Mix" in Sound Control Panel → Recording tab</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	)
}
