import { apiRequest } from './core'

export interface Tag {
	name: string
	count: number
}

export async function getTags(): Promise<Tag[]> {
	return apiRequest<Tag[]>('/tags')
}

export async function updateMeetingTags(meetingId: string, tags: string[]): Promise<any> {
	return apiRequest<any>(`/meetings/${meetingId}/tags`, {
		method: 'PUT',
		body: JSON.stringify({ tags })
	})
}
