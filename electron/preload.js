const { contextBridge } = require('electron')

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
