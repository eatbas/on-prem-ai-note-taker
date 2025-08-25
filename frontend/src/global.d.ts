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

			// App closing stop recording functionality
			onAppClosingStopRecording: (callback: () => void) => void
			removeAppClosingStopRecordingListener: () => void
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
