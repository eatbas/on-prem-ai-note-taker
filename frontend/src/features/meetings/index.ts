/**
 * Meetings Feature Exports
 * All meeting-related components, hooks, and utilities
 */

// Pages
export { default as Dashboard } from './pages/Dashboard'
export { default as MeetingView } from './pages/MeetingView'

// Components
export { MeetingHeader, MeetingSummary, MeetingTranscript, MeetingAudio } from './components/meeting-view'
export { MeetingList, DashboardTabs, MeetingCardEnhanced } from './components/dashboard'
export { SearchAndFilters } from './components/search'

// Hooks
export { useDashboard } from './hooks/useDashboard'

// Re-export types specific to meetings
export type {
  Meeting,
  MeetingMetadata,
  TranscriptionResult,
  TranscriptionSegment,
  SummaryResult
} from '../../lib/types'
