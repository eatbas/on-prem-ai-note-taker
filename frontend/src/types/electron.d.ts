declare global {
	interface Window {
		electronAPI: {
			sendRecordingState: (recording: boolean) => void
			onTrayAction: (callback: (action: string) => void) => void
			removeTrayActionListener: () => void
		}
		desktopCapture: {
			getSources: (types: string[]) => Promise<any[]>
		}
		USER_ID: string
		BASIC_AUTH: {
			username: string
			password: string
		}
		API_BASE_URL: string
	}
}

export {}
