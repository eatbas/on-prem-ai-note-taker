import config from '../../utils/envLoader'

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
		if (fromGlobal) return fromGlobal
	} catch {}
	return localStorage.getItem('user_id') || undefined
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
		'Content-Type': 'application/json',
		...getAuthHeader(),
		...options.headers
	}

	const response = await fetch(`${apiBase}${endpoint}`, {
		...options,
		headers
	})

	return handleApiResponse<T>(response)
}
