const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('USER_ID', process.env.USERNAME || process.env.USER || '')


