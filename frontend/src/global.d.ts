declare global {
	interface Window {
		electronAPI: {
			sendRecordingState: (recording: boolean) => void
			onTrayAction: (callback: (action: string) => void) => void
			removeTrayActionListener: () => void
			// New functions for standalone recording window
			onRecordingDataUpdate: (callback: (data: any) => void) => void
			stopRecording: () => void
			sendRecordingDataUpdate: (data: any) => void
			// New functions for recording data requests
			onRequestRecordingData: (callback: () => void) => void
			sendRecordingDataResponse: (data: any) => void
			// Control mini recorder window visibility
			setMiniRecorderVisible: (visible: boolean) => void
		}
		desktopCapture: {
			getSources: (types: string[]) => Promise<Array<{ id: string; name: string }>>
		}
		USER_ID: string
		BASIC_AUTH: string
		API_BASE_URL: string
	}
}

export {}
