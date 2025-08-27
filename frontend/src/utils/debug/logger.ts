/**
 * Audio Debug Logger
 * Centralized logging for audio debugging
 */

export class DebugLogger {
    private static logs: string[] = []

    static log(message: string, data?: any) {
        const timestamp = new Date().toISOString()
        const logEntry = `[${timestamp}] ${message}`
        console.log(`🔧 AudioDebug: ${logEntry}`, data || '')
        this.logs.push(logEntry + (data ? ' ' + JSON.stringify(data) : ''))
    }

    static error(message: string, error?: any) {
        const timestamp = new Date().toISOString()
        const logEntry = `[${timestamp}] ERROR: ${message}`
        console.error(`🔧 AudioDebug: ${logEntry}`, error || '')
        this.logs.push(logEntry + (error ? ' ' + JSON.stringify(error) : ''))
    }

    static warn(message: string, data?: any) {
        const timestamp = new Date().toISOString()
        const logEntry = `[${timestamp}] WARNING: ${message}`
        console.warn(`🔧 AudioDebug: ${logEntry}`, data || '')
        this.logs.push(logEntry + (data ? ' ' + JSON.stringify(data) : ''))
    }

    static info(message: string, data?: any) {
        const timestamp = new Date().toISOString()
        const logEntry = `[${timestamp}] INFO: ${message}`
        console.info(`🔧 AudioDebug: ${logEntry}`, data || '')
        this.logs.push(logEntry + (data ? ' ' + JSON.stringify(data) : ''))
    }

    static getLogs(): string[] {
        return [...this.logs]
    }

    static clearLogs() {
        this.logs = []
    }

    static exportLogs(): string {
        return this.logs.join('\n')
    }

    static downloadLogs(filename = 'audio-debug-logs.txt') {
        const logs = this.exportLogs()
        const blob = new Blob([logs], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        
        URL.revokeObjectURL(url)
    }
}
