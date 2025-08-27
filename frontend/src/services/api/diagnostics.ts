import { apiRequest, apiBase, getAuthHeader, getApiHeaders, getUserId, handleApiResponse } from './core'

export interface VpsDiagnosticResult {
	check: string
	status: 'pass' | 'fail' | 'warning'
	message: string
	details?: any
	timestamp: string
}

export async function getVpsHealth() {
	try {
		const response = await fetch(`${apiBase}/health`, {
			method: 'GET',
			headers: {
				...getApiHeaders()
			},
			timeout: 5000
		} as any)

		return await handleApiResponse<any>(response)
	} catch (error) {
		console.error('VPS health check failed:', error)
		throw error
	}
}

export async function runVpsDiagnostics(): Promise<VpsDiagnosticResult[]> {
	console.log('🔍 Running comprehensive VPS diagnostics...')
	
	const diagnostics: VpsDiagnosticResult[] = []
	const timestamp = new Date().toISOString()

	// Test 1: Basic connectivity
	try {
		const response = await fetch(`${apiBase}/health`, {
			method: 'GET',
			headers: {
				...getApiHeaders()
			},
			timeout: 10000
		} as any)

		if (response.ok) {
			const healthData = await response.json()
			diagnostics.push({
				check: 'Basic Connectivity',
				status: 'pass',
				message: 'Successfully connected to VPS API',
				details: healthData,
				timestamp
			})
		} else {
			diagnostics.push({
				check: 'Basic Connectivity',
				status: 'fail',
				message: `HTTP ${response.status}: ${response.statusText}`,
				timestamp
			})
		}
	} catch (error) {
		diagnostics.push({
			check: 'Basic Connectivity',
			status: 'fail',
			message: `Connection failed: ${error}`,
			timestamp
		})
	}

	// Test 2: Authentication
	try {
		const response = await fetch(`${apiBase}/meetings`, {
			method: 'GET',
			headers: {
				...getApiHeaders()
			},
			timeout: 10000
		} as any)

		if (response.ok) {
			diagnostics.push({
				check: 'Authentication',
				status: 'pass',
				message: 'Authentication successful',
				timestamp
			})
		} else if (response.status === 401) {
			diagnostics.push({
				check: 'Authentication',
				status: 'fail',
				message: 'Authentication failed - check credentials',
				timestamp
			})
		} else {
			diagnostics.push({
				check: 'Authentication',
				status: 'warning',
				message: `Unexpected response: ${response.status}`,
				timestamp
			})
		}
	} catch (error) {
		diagnostics.push({
			check: 'Authentication',
			status: 'fail',
			message: `Authentication test failed: ${error}`,
			timestamp
		})
	}

	// Test 3: Transcription service
	try {
		// Create a small test audio blob
		const testBlob = new Blob(['test audio data'], { type: 'audio/wav' })
		const testFile = new File([testBlob], 'test.wav', { type: 'audio/wav' })
		
		const form = new FormData()
		form.append('file', testFile)
		form.append('language', 'auto')

		const userId = getUserId()
		const response = await fetch(`${apiBase}/transcribe`, {
			method: 'POST',
			headers: {
				...getAuthHeader(),
				...(userId && { 'X-User-Id': userId })
			},
			body: form,
			timeout: 30000
		} as any)

		if (response.ok) {
			diagnostics.push({
				check: 'Transcription Service',
				status: 'pass',
				message: 'Transcription endpoint is responsive',
				timestamp
			})
		} else {
			diagnostics.push({
				check: 'Transcription Service',
				status: response.status === 422 ? 'warning' : 'fail',
				message: response.status === 422 
					? 'Service is running but rejected test file (expected)'
					: `Service error: ${response.status}`,
				timestamp
			})
		}
	} catch (error) {
		diagnostics.push({
			check: 'Transcription Service',
			status: 'fail',
			message: `Transcription test failed: ${error}`,
			timestamp
		})
	}

	// Test 4: Chat service
	try {
		const response = await fetch(`${apiBase}/chat`, {
			method: 'POST',
			headers: {
				...getApiHeaders()
			},
			body: JSON.stringify({
				prompt: 'test',
				model: 'llama3.2:3b'
			}),
			timeout: 30000
		} as any)

		if (response.ok) {
			diagnostics.push({
				check: 'Chat Service',
				status: 'pass',
				message: 'Chat/LLM service is responsive',
				timestamp
			})
		} else {
			diagnostics.push({
				check: 'Chat Service',
				status: 'warning',
				message: `Chat service responded with: ${response.status}`,
				timestamp
			})
		}
	} catch (error) {
		diagnostics.push({
			check: 'Chat Service',
			status: 'fail',
			message: `Chat test failed: ${error}`,
			timestamp
		})
	}

	// Test 5: Queue service
	try {
		const response = await fetch(`${apiBase}/queue/stats`, {
			method: 'GET',
			headers: {
				...getApiHeaders()
			},
			timeout: 10000
		} as any)

		if (response.ok) {
			const queueData = await response.json()
			diagnostics.push({
				check: 'Queue Service',
				status: 'pass',
				message: 'Queue service is operational',
				details: queueData,
				timestamp
			})
		} else {
			diagnostics.push({
				check: 'Queue Service',
				status: 'warning',
				message: `Queue service responded with: ${response.status}`,
				timestamp
			})
		}
	} catch (error) {
		diagnostics.push({
			check: 'Queue Service',
			status: 'fail',
			message: `Queue test failed: ${error}`,
			timestamp
		})
	}

	console.log('✅ VPS diagnostics completed:', diagnostics)
	return diagnostics
}

export async function quickVpsTest(): Promise<{ success: boolean; message: string; details?: any }> {
	try {
		const response = await fetch(`${apiBase}/health`, {
			method: 'GET',
			headers: {
				...getApiHeaders()
			},
			timeout: 5000
		} as any)

		if (response.ok) {
			const data = await response.json()
			return {
				success: true,
				message: '✅ VPS is online and responding',
				details: data
			}
		} else {
			return {
				success: false,
				message: `❌ VPS responded with error: ${response.status} ${response.statusText}`
			}
		}
	} catch (error) {
		return {
			success: false,
			message: `❌ VPS connection failed: ${error}`
		}
	}
}
