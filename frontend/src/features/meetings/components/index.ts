// 🗂️ ORGANIZED COMPONENT EXPORTS

// Dashboard components (primary)
export * from './dashboard'

// Meeting view components
export * from './meeting-view'

// Shared utility components
export * from './shared'

// Search and filters
export * from './search'

// Speaker components
export * from './speakers'

// Status displays
export * from './status'

// Legacy components removed - use modern alternatives from organized folders

// Individual exports for backward compatibility
export { MeetingHeader, MeetingAudio, MeetingSummary, MeetingTranscript } from './meeting-view'
export { MeetingSpeakers } from './speakers'
export { MeetingList, DashboardTabs, MeetingCardEnhanced } from './dashboard'
export { SearchAndFilters } from './search'
export { SpeakerPreview } from './speakers'
// export { default as EnhancedStatusDisplay } from './status/EnhancedStatusDisplay'