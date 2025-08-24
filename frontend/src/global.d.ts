/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.gif' {
  const content: string
  export default content
}

declare module '*.webp' {
  const content: string
  export default content
}

declare module '*.ico' {
  const content: string
  export default content
}

declare module '*.bmp' {
  const content: string
  export default content
}

// CSS Animation types
interface CSSStyleDeclaration {
  transform: string
  transition: string
  animation: string
  animationDelay: string
  animationDuration: string
  animationIterationCount: string
  animationName: string
  animationTimingFunction: string
  animationDirection: string
  animationFillMode: string
  animationPlayState: string
}

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
