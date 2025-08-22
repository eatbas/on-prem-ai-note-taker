const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('USER_ID', process.env.USERNAME || process.env.USER || '')

contextBridge.exposeInMainWorld('BASIC_AUTH', {
	username: process.env.BASIC_AUTH_USERNAME || 'myca',
	password: process.env.BASIC_AUTH_PASSWORD || 'wj2YyxrJ4cqcXgCA'
})

contextBridge.exposeInMainWorld('API_BASE_URL', 'http://95.111.244.159:8000/api')

// Expose desktop capture API for system audio recording
contextBridge.exposeInMainWorld('desktopCapture', {
	getSources: async (types) => {
		const { desktopCapturer } = require('electron')
		return await desktopCapturer.getSources({ types, fetchWindowIcons: false })
	}
})

// Expose IPC communication for tray and recording state
contextBridge.exposeInMainWorld('electronAPI', {
	// Send recording state to main process
	sendRecordingState: (recording) => {
		ipcRenderer.send('recording-state-changed', recording)
	},
	
	// Listen for tray actions from main process
	onTrayAction: (callback) => {
		ipcRenderer.on('tray-action', (event, action) => callback(action))
	},
	
	// Remove tray action listener
	removeTrayActionListener: () => {
		ipcRenderer.removeAllListeners('tray-action')
	},
	
	// New functions for standalone recording window
	onRecordingDataUpdate: (callback) => {
		ipcRenderer.on('recording-data-update', (event, data) => callback(data))
	},
	
	stopRecording: () => {
		ipcRenderer.send('stop-recording')
	},
	
	// For main app to send recording data to standalone window
	sendRecordingDataUpdate: (data) => {
		ipcRenderer.send('recording-data-update', data)
	},
	
	// Listen for recording data requests from main process
	onRequestRecordingData: (callback) => {
		ipcRenderer.on('request-recording-data', (event) => callback())
	},
	
	// Send recording data response to main process
	sendRecordingDataResponse: (data) => {
		ipcRenderer.send('recording-data-response', data)
	}
})
