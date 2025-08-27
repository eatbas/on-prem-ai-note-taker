import { apiRequest, apiBase, getAuthHeader, handleApiResponse, getUserId } from './core'

export async function getMeetings() {
	return apiRequest<any>('/meetings')
}

export async function getVpsMeetings() {
	return apiRequest<any>('/vps/meetings')
}

export async function getMeeting(meetingId: string) {
	return apiRequest<any>(`/meetings/${meetingId}`)
}

export async function updateMeeting(meetingId: string, title: string) {
	return apiRequest<any>(`/meetings/${meetingId}`, {
		method: 'PUT',
		body: JSON.stringify({ title })
	})
}

export async function deleteMeeting(meetingId: string): Promise<{ message: string }> {
	return apiRequest<{ message: string }>(`/meetings/${meetingId}`, {
		method: 'DELETE'
	})
}

export async function startMeeting(
	title: string,
	language: string = 'auto',
	tags: string[] = []
): Promise<{ meetingId: string; message: string }> {
	const userId = getUserId()
	if (!userId) {
		throw new Error('User ID not found. Please check your setup.')
	}

	return apiRequest<{ meetingId: string; message: string }>('/meetings', {
		method: 'POST',
		body: JSON.stringify({
			title,
			language,
			tags,
			user_id: userId
		})
	})
}

export async function uploadMeetingAudio(
	meetingId: string,
	audioFile: File,
	audioType: 'microphone' | 'system' | 'mixed' = 'mixed'
): Promise<{ message: string; upload_id: string }> {
	const form = new FormData()
	form.append('audio', audioFile)
	form.append('audio_type', audioType)

	const response = await fetch(`${apiBase}/meetings/${meetingId}/audio`, {
		method: 'POST',
		headers: {
			...getAuthHeader()
		},
		body: form
	})

	return handleApiResponse<{ message: string; upload_id: string }>(response)
}

export async function autoProcessMeeting(
	meetingId: string,
	files: { microphone?: File; system?: File; mixed?: File },
	language: string = 'auto'
): Promise<{ job_id: string; message: string }> {
	const form = new FormData()
	form.append('language', language)

	// Add files based on what's available
	if (files.microphone) {
		form.append('microphone_audio', files.microphone)
	}
	if (files.system) {
		form.append('system_audio', files.system)
	}
	if (files.mixed) {
		form.append('mixed_audio', files.mixed)
	}

	const response = await fetch(`${apiBase}/meetings/${meetingId}/process`, {
		method: 'POST',
		headers: {
			...getAuthHeader()
		},
		body: form
	})

	return handleApiResponse<{ job_id: string; message: string }>(response)
}

export async function autoProcessDualMeeting(
	meetingId: string,
	files: { microphone?: File; speaker?: File },
	language: string = 'auto'
): Promise<{ job_id: string; message: string }> {
	console.log('🎯 Dual Meeting Processing Request:', {
		meetingId,
		language,
		microphoneFile: files.microphone ? `${files.microphone.name} (${(files.microphone.size / 1024).toFixed(2)} KB)` : 'None',
		speakerFile: files.speaker ? `${files.speaker.name} (${(files.speaker.size / 1024).toFixed(2)} KB)` : 'None'
	})

	const form = new FormData()
	form.append('language', language)

	if (files.microphone) {
		form.append('microphone_audio', files.microphone)
		console.log('✅ Added microphone audio to form data')
	}

	if (files.speaker) {
		form.append('speaker_audio', files.speaker)
		console.log('✅ Added speaker audio to form data')
	}

	if (!files.microphone && !files.speaker) {
		throw new Error('At least one audio file (microphone or speaker) is required')
	}

	console.log('📤 Sending dual processing request...')
	
	const response = await fetch(`${apiBase}/meetings/${meetingId}/process-dual`, {
		method: 'POST',
		headers: {
			...getAuthHeader()
		},
		body: form
	})

	const result = await handleApiResponse<{ job_id: string; message: string }>(response)
	console.log('✅ Dual processing response:', result)
	
	return result
}

export async function getMeetingSpeakers(meetingId: string) {
	return apiRequest<any>(`/meetings/${meetingId}/speakers`)
}

export async function updateSpeakerName(meetingId: string, speakerId: string, newName: string) {
	return apiRequest<any>(`/meetings/${meetingId}/speakers/${speakerId}`, {
		method: 'PUT',
		body: JSON.stringify({ name: newName })
	})
}
