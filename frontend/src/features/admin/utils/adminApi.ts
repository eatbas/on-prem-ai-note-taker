/**
 * Admin API Utilities
 * Centralized API functions for admin operations
 */

const API_BASE = (() => {
    try {
        // @ts-ignore
        const fromPreload = (window as any).API_BASE_URL as string | undefined
        if (fromPreload) return fromPreload
    } catch {}
    return (import.meta as any).env.VITE_API_BASE_URL || '/api'
})()

const getAuthCredentials = () => {
    const username = (import.meta as any).env.VITE_BASIC_AUTH_USERNAME
    const password = (import.meta as any).env.VITE_BASIC_AUTH_PASSWORD
    
    if (!username || !password) {
        throw new Error('Admin credentials not configured')
    }
    
    return { username, password }
}

export async function makeAdminRequest(path: string, options?: RequestInit) {
    try {
        const credentials = getAuthCredentials()
        const token = btoa(`${credentials.username}:${credentials.password}`)
        
        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                'Authorization': `Basic ${token}`,
                'Content-Type': 'application/json',
                ...options?.headers
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const text = await response.text()
        return text ? JSON.parse(text) : {}
    } catch (error) {
        console.error('Admin API request failed:', error)
        throw error
    }
}

export async function loadStats() {
    return makeAdminRequest('/admin/stats')
}

export async function loadUsers() {
    return makeAdminRequest('/admin/users')
}

export async function loadMeetings(params: {
    limit: number
    offset: number
    search?: string
    user_id?: string
}) {
    const searchParams = new URLSearchParams({
        limit: params.limit.toString(),
        offset: params.offset.toString(),
    })
    
    if (params.search) {
        searchParams.set('search', params.search)
    }
    
    if (params.user_id) {
        searchParams.set('user_id', params.user_id)
    }
    
    return makeAdminRequest(`/admin/meetings?${searchParams}`)
}

export async function deleteUser(userId: string) {
    return makeAdminRequest(`/admin/users/${userId}`, {
        method: 'DELETE'
    })
}

export async function deleteMeeting(meetingId: string) {
    return makeAdminRequest(`/admin/meetings/${meetingId}`, {
        method: 'DELETE'
    })
}
