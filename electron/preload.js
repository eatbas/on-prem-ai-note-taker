const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('USER_ID', process.env.USERNAME || process.env.USER || '')

contextBridge.exposeInMainWorld('BASIC_AUTH', {
	username: process.env.BASIC_AUTH_USERNAME || 'electron',
	password: process.env.BASIC_AUTH_PASSWORD || 'electron-local'
})

contextBridge.exposeInMainWorld('API_BASE_URL', process.env.API_BASE_URL || `http://127.0.0.1:${process.env.APP_PORT || '8001'}/api`)


