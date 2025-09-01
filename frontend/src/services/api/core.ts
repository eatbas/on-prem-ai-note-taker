import config from '../../utils/envLoader'
import { detectComputerUsername } from '../../utils/usernameDetector'

export const apiBase = (() => {
	try {
		// @ts-ignore
		const fromPreload = (window as any).API_BASE_URL as string | undefined
		if (fromPreload) return fromPreload
	} catch {}
	return config.apiBaseUrl
})()

export function getUserId(): string | undefined {
	try {
		// Electron-preload may set window.USER_ID
		// @ts-ignore
		const fromGlobal = (window as any).USER_ID as string | undefined
		if (fromGlobal) {
			// Store it to ensure consistency for future calls
			try {
				localStorage.setItem('user_id', fromGlobal)
				console.log('🆔 Using Electron preload user ID:', fromGlobal)
			} catch {}
			return fromGlobal
		}
	} catch {}
	
	// Check localStorage for existing user ID
	let userId = localStorage.getItem('user_id')
	
	// If no user ID exists, create one
	if (!userId) {
		userId = initializeUserId()
	}
	
	return userId || undefined
}

function initializeUserId(): string {
	// Use the detected computer username for consistent user identification
	// This ensures meetings are properly associated with the user's computer
	const computerUsername = detectComputerUsername()
	const userId = `user_${computerUsername}`
	
	try {
		localStorage.setItem('user_id', userId)
		console.log('🆔 Generated user ID from detected username:', userId)
		return userId
	} catch (error) {
		console.error('Failed to store user ID:', error)
		return userId // Return it anyway, even if we can't store it
	}
}

export function getAuthHeader(): Record<string, string> {
	try {
		// @ts-ignore
		const basic = (window as any).BASIC_AUTH as { username?: string; password?: string } | undefined
		if (basic?.username && basic?.password) {
			const token = btoa(`${basic.username}:${basic.password}`)
			console.log('🔑 Using Electron preload auth credentials')
			return { Authorization: `Basic ${token}` }
		}
	} catch {}
	
	// Use centralized config
	if (config.basicAuthUsername && config.basicAuthPassword) {
		const token = btoa(`${config.basicAuthUsername}:${config.basicAuthPassword}`)
		console.log('🔑 Using config auth credentials')
		return { Authorization: `Basic ${token}` }
	}
	
	console.warn('⚠️ No authentication credentials found')
	return {}
}

// Helper function to get complete API headers (auth + user ID)
export function getApiHeaders(): Record<string, string> {
	const userId = getUserId()
	return {
		'Content-Type': 'application/json',
		...getAuthHeader(),
		...(userId && { 'X-User-Id': userId })
	}
}

// Common error handling for API responses
export async function handleApiResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const errorText = await response.text()
		let errorMessage = `HTTP ${response.status}: ${response.statusText}`
		
		try {
			const errorData = JSON.parse(errorText)
			if (errorData.detail) {
				errorMessage = errorData.detail
			} else if (errorData.message) {
				errorMessage = errorData.message
			}
		} catch {
			// If parsing fails, use the raw text if it's not empty
			if (errorText.trim()) {
				errorMessage = errorText
			}
		}
		
		throw new Error(errorMessage)
	}
	
	const text = await response.text()
	
	if (!text.trim()) {
		return {} as T
	}
	
	try {
		return JSON.parse(text) as T
	} catch {
		// If it's not JSON, return the text as-is
		return text as unknown as T
	}
}

// Common fetch wrapper with error handling
export async function apiRequest<T>(
	endpoint: string, 
	options: RequestInit = {}
): Promise<T> {
	const headers = {
		...getApiHeaders(),
		...options.headers
	}

	const fullUrl = `${apiBase}${endpoint}`

	const response = await fetch(fullUrl, {
		...options,
		headers
	})

	return handleApiResponse<T>(response)
}
