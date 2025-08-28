/**
 * 🚀 STAGE 3 OPTIMIZATION: Dynamic service loader for on-demand imports
 * 
 * This module provides lazy loading for heavy services that are only used
 * in specific scenarios, reducing the initial bundle size.
 */

// Cache loaded services to avoid re-importing
const serviceCache = new Map<string, any>()

/**
 * Dynamically load the background processor service
 * Only loaded when actual background processing is needed
 */
export async function loadBackgroundProcessor() {
  const cacheKey = 'backgroundProcessor'
  
  if (serviceCache.has(cacheKey)) {
    return serviceCache.get(cacheKey)
  }
  
  console.log('📦 Dynamically loading background processor...')
  const module = await import('../services/backgroundProcessor')
  serviceCache.set(cacheKey, module)
  
  return module
}

/**
 * Dynamically load audio compression services
 * Only loaded when audio recording is actually started
 */
export async function loadAudioServices() {
  const cacheKey = 'audioServices'
  
  if (serviceCache.has(cacheKey)) {
    return serviceCache.get(cacheKey)
  }
  
  console.log('🎵 Dynamically loading audio services...')
  const [audioCompression, streamingUploader, audioConfig] = await Promise.all([
    import('../lib/audioCompression'),
    import('../services/streamingUploader'),
    import('../lib/audioConfig')
  ])
  
  const services = {
    audioCompression,
    streamingUploader,
    audioConfig
  }
  
  serviceCache.set(cacheKey, services)
  return services
}

/**
 * Dynamically load diagnostic services
 * Only loaded when admin diagnostics are accessed
 */
export async function loadDiagnosticServices() {
  const cacheKey = 'diagnosticServices'
  
  if (serviceCache.has(cacheKey)) {
    return serviceCache.get(cacheKey)
  }
  
  console.log('🔧 Dynamically loading diagnostic services...')
  const module = await import('../services/api/diagnostics')
  serviceCache.set(cacheKey, module)
  
  return module
}

/**
 * Dynamically load chart and visualization components
 * Only loaded when charts are actually displayed
 */
export async function loadChartComponents() {
  const cacheKey = 'chartComponents'
  
  if (serviceCache.has(cacheKey)) {
    return serviceCache.get(cacheKey)
  }
  
  console.log('📊 Dynamically loading chart components...')
  // Note: Add actual chart imports here when charts are implemented
  const mockCharts = { 
    // Placeholder for future chart components
    loadChart: () => Promise.resolve(null)
  }
  
  serviceCache.set(cacheKey, mockCharts)
  return mockCharts
}

/**
 * Dynamically load database services
 * Only loaded when local database operations are needed
 */
export async function loadDatabaseServices() {
  const cacheKey = 'databaseServices'
  
  if (serviceCache.has(cacheKey)) {
    return serviceCache.get(cacheKey)
  }
  
  console.log('💾 Dynamically loading database services...')
  const module = await import('../services/db')
  serviceCache.set(cacheKey, module)
  
  return module
}

/**
 * Preload critical services that are likely to be used soon
 * This can be called during idle time to improve perceived performance
 */
export async function preloadCriticalServices() {
  console.log('⚡ Preloading critical services during idle time...')
  
  // Use requestIdleCallback if available, otherwise setTimeout
  const schedulePreload = (callback: () => void) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback)
    } else {
      setTimeout(callback, 0)
    }
  }
  
  schedulePreload(() => loadDatabaseServices())
  schedulePreload(() => loadBackgroundProcessor())
}

/**
 * Clear service cache (useful for development or memory management)
 */
export function clearServiceCache() {
  console.log('🧹 Clearing service cache...')
  serviceCache.clear()
}

/**
 * Get cache status for monitoring
 */
export function getServiceCacheStatus() {
  return {
    cacheSize: serviceCache.size,
    cachedServices: Array.from(serviceCache.keys()),
    memoryUsage: serviceCache.size * 100 // Rough estimate in KB
  }
}
