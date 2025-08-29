/**
 * Utility functions for detecting computer usernames
 * This provides consistent username detection across the application
 */

/**
 * Detects the computer username using multiple methods
 * @returns The detected username or a fallback identifier
 */
export function detectComputerUsername(): string {
	// Try to get the computer username dynamically
	let computerUsername = 'unknown'
	
	try {
		// Method 1: Try to get from Electron preload (highest priority)
		if (typeof window !== 'undefined') {
			try {
				// @ts-ignore - Electron specific
				const electronUserId = (window as any).USER_ID
				if (electronUserId && electronUserId !== '') {
					computerUsername = electronUserId
					console.log('🔍 Detected username from Electron:', computerUsername)
					return computerUsername
				}
			} catch (e) {
				// Ignore electron API errors
			}
		}
		
		// Method 2: Try to get username from environment variables (works in Electron)
		if (computerUsername === 'unknown' && typeof process !== 'undefined' && process.env) {
			computerUsername = process.env.USERNAME || process.env.USER || 'unknown'
		}
		
		// Method 3: Try to get from navigator.userAgent (web fallback)
		if (computerUsername === 'unknown' && typeof navigator !== 'undefined') {
			const userAgent = navigator.userAgent
			// Extract username from user agent if it contains domain info
			const domainMatch = userAgent.match(/DGPAYSIT\+([^@\s]+)/)
			if (domainMatch) {
				computerUsername = domainMatch[1]
			}
		}
		
		// Method 4: Try to get from localStorage if previously stored
		if (computerUsername === 'unknown') {
			const storedUsername = localStorage.getItem('computer_username')
			if (storedUsername) {
				computerUsername = storedUsername
			}
		}
		
		// Method 5: Try to get from user ID if available
		if (computerUsername === 'unknown') {
			const userId = localStorage.getItem('user_id')
			if (userId && userId.startsWith('user_')) {
				computerUsername = userId.substring(5) // Remove 'user_' prefix
			}
		}
		
		// Final fallback: generate a consistent identifier based on browser fingerprint
		if (computerUsername === 'unknown') {
			// Try to create a more consistent identifier for the same machine/browser
			const browserInfo = navigator.userAgent + navigator.language + screen.width + screen.height
			const hash = browserInfo.split('').reduce((acc, char) => {
				return ((acc << 5) - acc) + char.charCodeAt(0)
			}, 0)
			computerUsername = `browser_${Math.abs(hash).toString(36)}`
			console.log('🔍 Generated consistent browser-based username:', computerUsername)
		}
		
		// Store the detected username for future use
		localStorage.setItem('computer_username', computerUsername)
		
		console.log('🔍 Detected computer username:', computerUsername)
		
	} catch (error) {
		console.warn('Failed to detect computer username, using fallback:', error)
		computerUsername = `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
	}
	
	return computerUsername
}

/**
 * Gets the current computer username, using cached value if available
 * @returns The current computer username
 */
export function getComputerUsername(): string {
	// Check if we have a cached username
	const cachedUsername = localStorage.getItem('computer_username')
	if (cachedUsername) {
		return cachedUsername
	}
	
	// Detect and cache the username
	return detectComputerUsername()
}

/**
 * Forces a refresh of the computer username detection
 * @returns The newly detected username
 */
export function refreshComputerUsername(): string {
	// Clear cached username
	localStorage.removeItem('computer_username')
	
	// Detect fresh username
	return detectComputerUsername()
}
