/**
 * Meetings Feature Exports
 * All meeting-related components, hooks, and utilities
 */

// Pages
export { default as Dashboard } from '../../pages/Dashboard'
export { default as MeetingView } from '../../pages/MeetingView'

// Components
export { default as MeetingHeader } from './components/MeetingHeader'
export { default as MeetingSummary } from './components/MeetingSummary'
export { default as MeetingTranscript } from './components/MeetingTranscript'
export { default as MeetingAudio } from './components/MeetingAudio'
export { default as MeetingList } from './components/MeetingList'
export { default as MeetingCard } from './components/MeetingCard'
export { default as DashboardTabs } from './components/DashboardTabs'
export { default as SearchAndFilters } from './components/SearchAndFilters'

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
