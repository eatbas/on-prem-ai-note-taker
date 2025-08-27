/**
 * API Services - Modular Export
 * 
 * This file maintains backward compatibility while providing
 * access to the new modular API structure.
 */

// Export everything from the modular API
export * from './api/index'

// This ensures existing imports like:
// import { transcribe, getMeetings } from '../services/api'
// continue to work without changes
