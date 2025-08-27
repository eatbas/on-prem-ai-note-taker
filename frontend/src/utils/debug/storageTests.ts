/**
 * Storage Debug Tests
 * Tests for IndexedDB and local storage functionality
 */

import { DebugResult } from './types'
import { DebugLogger } from './logger'

export class StorageTests {
    static async testIndexedDBSupport(): Promise<DebugResult> {
        try {
            DebugLogger.log('Testing IndexedDB support...')
            
            if (!window.indexedDB) {
                throw new Error('IndexedDB not supported in this browser')
            }
            
            // Test basic IndexedDB operations
            const dbName = 'audioDebugTest'
            const version = 1
            
            const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open(dbName, version)
                
                request.onerror = () => reject(request.error)
                request.onsuccess = () => resolve(request.result)
                
                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result
                    if (!db.objectStoreNames.contains('testStore')) {
                        db.createObjectStore('testStore', { keyPath: 'id' })
                    }
                }
            })
            
            const db = await dbPromise
            
            // Test write operation
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(['testStore'], 'readwrite')
                const store = transaction.objectStore('testStore')
                const request = store.add({ id: 'test', data: 'test data', timestamp: Date.now() })
                
                request.onsuccess = () => resolve()
                request.onerror = () => reject(request.error)
            })
            
            // Test read operation
            const readData = await new Promise<any>((resolve, reject) => {
                const transaction = db.transaction(['testStore'], 'readonly')
                const store = transaction.objectStore('testStore')
                const request = store.get('test')
                
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
            
            // Test blob storage (important for audio chunks)
            const testBlob = new Blob(['test audio data'], { type: 'audio/webm' })
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(['testStore'], 'readwrite')
                const store = transaction.objectStore('testStore')
                const request = store.add({ id: 'blob-test', blob: testBlob, timestamp: Date.now() })
                
                request.onsuccess = () => resolve()
                request.onerror = () => reject(request.error)
            })
            
            // Clean up
            db.close()
            indexedDB.deleteDatabase(dbName)
            
            DebugLogger.log('✅ IndexedDB test completed successfully')
            
            return {
                success: true,
                details: {
                    indexedDBSupported: true,
                    testDataStored: readData?.data === 'test data',
                    blobStorageSupported: true,
                    version: version
                }
            }
        } catch (error) {
            DebugLogger.error('❌ IndexedDB test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testDexieIntegration(): Promise<DebugResult> {
        try {
            DebugLogger.log('Testing Dexie.js integration...')
            
            // Dynamic import to avoid build issues if Dexie isn't available
            const { db } = await import('../../services/db')
            
            // Test basic operations with the actual app database
            const testMeeting = {
                id: 'debug-test-meeting',
                title: 'Debug Test Meeting',
                createdAt: Date.now(),
                language: 'auto',
                tags: ['debug', 'test'],
                status: 'local'
            }
            
            // Add test meeting
            await db.meetings.add(testMeeting)
            
            // Retrieve test meeting
            const retrievedMeeting = await db.meetings.get('debug-test-meeting')
            
            // Test chunk storage
            const testChunk = {
                id: 'debug-test-chunk',
                meetingId: 'debug-test-meeting',
                index: 0,
                blob: new Blob(['test audio'], { type: 'audio/webm' }),
                timestamp: Date.now(),
                audioType: 'microphone' as const
            }
            
            await db.chunks.add(testChunk)
            const retrievedChunk = await db.chunks.get('debug-test-chunk')
            
            // Clean up
            await db.chunks.delete('debug-test-chunk')
            await db.meetings.delete('debug-test-meeting')
            
            DebugLogger.log('✅ Dexie integration test completed successfully')
            
            return {
                success: true,
                details: {
                    dexieAvailable: true,
                    meetingStorage: retrievedMeeting?.title === testMeeting.title,
                    chunkStorage: retrievedChunk?.audioType === 'microphone',
                    blobSize: retrievedChunk?.blob.size || 0
                }
            }
        } catch (error) {
            DebugLogger.error('❌ Dexie integration test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testStorageQuota(): Promise<DebugResult> {
        try {
            DebugLogger.log('Testing storage quota...')
            
            if (!navigator.storage || !navigator.storage.estimate) {
                throw new Error('Storage API not supported')
            }
            
            const estimate = await navigator.storage.estimate()
            const quota = estimate.quota || 0
            const usage = estimate.usage || 0
            const available = quota - usage
            
            // Convert to human-readable sizes
            const formatBytes = (bytes: number) => {
                const units = ['B', 'KB', 'MB', 'GB']
                let size = bytes
                let unitIndex = 0
                
                while (size >= 1024 && unitIndex < units.length - 1) {
                    size /= 1024
                    unitIndex++
                }
                
                return `${size.toFixed(2)} ${units[unitIndex]}`
            }
            
            const percentUsed = quota > 0 ? (usage / quota) * 100 : 0
            
            DebugLogger.log(`✅ Storage quota: ${formatBytes(available)} available of ${formatBytes(quota)} total`)
            
            return {
                success: true,
                details: {
                    quota: quota,
                    usage: usage,
                    available: available,
                    quotaFormatted: formatBytes(quota),
                    usageFormatted: formatBytes(usage),
                    availableFormatted: formatBytes(available),
                    percentUsed: percentUsed.toFixed(2)
                }
            }
        } catch (error) {
            DebugLogger.error('❌ Storage quota test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    static async testLargeFileStorage(sizeMB = 10): Promise<DebugResult> {
        try {
            DebugLogger.log(`Testing large file storage: ${sizeMB}MB...`)
            
            // Create a large blob to simulate audio file
            const chunkSize = 1024 * 1024 // 1MB chunks
            const chunks: Uint8Array[] = []
            
            for (let i = 0; i < sizeMB; i++) {
                chunks.push(new Uint8Array(chunkSize))
            }
            
            const largeBlob = new Blob(chunks, { type: 'audio/webm' })
            const actualSize = largeBlob.size
            
            // Test with IndexedDB
            const dbName = 'largeFileTest'
            const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open(dbName, 1)
                
                request.onerror = () => reject(request.error)
                request.onsuccess = () => resolve(request.result)
                
                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result
                    if (!db.objectStoreNames.contains('largeFiles')) {
                        db.createObjectStore('largeFiles', { keyPath: 'id' })
                    }
                }
            })
            
            const db = await dbPromise
            const startTime = Date.now()
            
            // Store large file
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(['largeFiles'], 'readwrite')
                const store = transaction.objectStore('largeFiles')
                const request = store.add({ 
                    id: 'large-file-test', 
                    blob: largeBlob, 
                    timestamp: Date.now() 
                })
                
                request.onsuccess = () => resolve()
                request.onerror = () => reject(request.error)
            })
            
            const storeTime = Date.now() - startTime
            
            // Retrieve large file
            const retrieveStartTime = Date.now()
            const retrievedData = await new Promise<any>((resolve, reject) => {
                const transaction = db.transaction(['largeFiles'], 'readonly')
                const store = transaction.objectStore('largeFiles')
                const request = store.get('large-file-test')
                
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
            
            const retrieveTime = Date.now() - retrieveStartTime
            
            // Clean up
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(['largeFiles'], 'readwrite')
                const store = transaction.objectStore('largeFiles')
                const request = store.delete('large-file-test')
                
                request.onsuccess = () => resolve()
                request.onerror = () => reject(request.error)
            })
            
            db.close()
            indexedDB.deleteDatabase(dbName)
            
            DebugLogger.log(`✅ Large file storage test completed: ${actualSize} bytes in ${storeTime}ms`)
            
            return {
                success: true,
                details: {
                    requestedSizeMB: sizeMB,
                    actualSizeBytes: actualSize,
                    storeTimeMs: storeTime,
                    retrieveTimeMs: retrieveTime,
                    retrievedSizeBytes: retrievedData?.blob?.size || 0,
                    storageSuccessful: retrievedData?.blob?.size === actualSize
                }
            }
        } catch (error) {
            DebugLogger.error('❌ Large file storage test failed', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }
}
