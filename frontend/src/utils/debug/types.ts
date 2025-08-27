/**
 * Audio Debug Types
 * Shared types for audio debugging functionality
 */

export interface DebugResult {
    success: boolean
    details?: any
    error?: string
}

export interface ComprehensiveResults {
    microphone: DebugResult
    mediaRecorder: DebugResult
    indexedDB: DebugResult
    electronAPIs?: DebugResult
    desktopAudio?: DebugResult
    electronAudioSources?: DebugResult
    gamingHeadset?: DebugResult
    logs: string[]
}

export interface AudioDeviceInfo {
    deviceId: string
    label: string
    kind: 'audioinput' | 'audiooutput'
    groupId: string
}

export interface RecordingTestResult {
    duration: number
    sampleRate: number
    channelCount: number
    mimeType: string
    fileSize: number
    audioLevels: number[]
}

export interface ElectronAudioSource {
    id: string
    name: string
    thumbnail: any
    display_id?: string
    appIcon?: any
}
