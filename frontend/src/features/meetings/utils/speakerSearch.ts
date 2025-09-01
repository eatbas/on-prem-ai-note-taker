import type { SpeakerEnhancedSummary } from '../../../lib/types'

interface SearchResult {
  score: number
  matches: string[]
  context: string
}

/**
 * 🚨 NEW: Speaker-aware search utility for enhanced summaries
 * Searches through all speaker-related content with weighted scoring
 */
export class SpeakerSearchEngine {
  
  /**
   * Main search function that checks speaker data and returns relevance score
   */
  static searchMeeting(meeting: any, searchTerm: string): SearchResult {
    const result: SearchResult = {
      score: 0,
      matches: [],
      context: ''
    }

    if (!searchTerm || !meeting) {
      return result
    }

    const term = searchTerm.toLowerCase()

    // Standard search in title, summary, transcript
    const standardMatches = this.searchStandardContent(meeting, term)
    result.score += standardMatches.score
    result.matches.push(...standardMatches.matches)

    // Enhanced search in speaker data if available
    const speakerMatches = this.searchSpeakerContent(meeting.summary, term)
    result.score += speakerMatches.score
    result.matches.push(...speakerMatches.matches)

    // Build context string
    result.context = this.buildSearchContext(result.matches, meeting)

    return result
  }

  /**
   * Search standard meeting content (title, summary, transcript)
   */
  private static searchStandardContent(meeting: any, term: string): SearchResult {
    const result: SearchResult = { score: 0, matches: [], context: '' }

    // Title search (highest weight)
    if (meeting.title && meeting.title.toLowerCase().includes(term)) {
      result.score += 10
      result.matches.push(`Title: "${meeting.title}"`)
    }

    // Summary search (medium weight)
    if (meeting.summary && meeting.summary.toLowerCase().includes(term)) {
      result.score += 5
      result.matches.push(`Summary content`)
    }

    // Transcript search (lower weight)
    if (meeting.transcript && meeting.transcript.toLowerCase().includes(term)) {
      result.score += 3
      result.matches.push(`Transcript content`)
    }

    return result
  }

  /**
   * Search speaker-enhanced content (speakers, discussions, decisions, actions)
   */
  private static searchSpeakerContent(summary: string, term: string): SearchResult {
    const result: SearchResult = { score: 0, matches: [], context: '' }

    if (!summary) return result

    try {
      const parsed = JSON.parse(summary) as SpeakerEnhancedSummary
      
      if (!parsed.speakers || !Array.isArray(parsed.speakers)) {
        return result
      }

      // Search speaker names and contributions
      for (const speaker of parsed.speakers) {
        // Speaker name search
        if (speaker.display_name.toLowerCase().includes(term) || 
            speaker.custom_name?.toLowerCase().includes(term)) {
          result.score += 8
          result.matches.push(`Speaker: ${speaker.display_name}`)
        }

        // Speaker contributions search
        for (const contribution of speaker.key_contributions) {
          if (contribution.toLowerCase().includes(term)) {
            result.score += 6
            result.matches.push(`${speaker.display_name} contribution`)
          }
        }

        // Communication style search
        if (speaker.communication_style.toLowerCase().includes(term)) {
          result.score += 4
          result.matches.push(`Communication style: ${speaker.communication_style}`)
        }
      }

      // Search discussion points
      if (parsed.key_discussion_points) {
        for (const point of parsed.key_discussion_points) {
          if (point.topic.toLowerCase().includes(term)) {
            result.score += 7
            result.matches.push(`Discussion topic: ${point.topic}`)
          }

          // Search conversation flow
          for (const flow of point.conversation_flow) {
            if (flow.contribution.toLowerCase().includes(term)) {
              result.score += 5
              result.matches.push(`${flow.speaker} in discussion`)
            }
          }
        }
      }

      // Search decisions
      if (parsed.decisions_made) {
        for (const decision of parsed.decisions_made) {
          if (decision.decision.toLowerCase().includes(term)) {
            result.score += 8
            result.matches.push(`Decision: ${decision.decision.substring(0, 50)}...`)
          }

          if (decision.proposed_by.toLowerCase().includes(term)) {
            result.score += 6
            result.matches.push(`Decision proposer: ${decision.proposed_by}`)
          }
        }
      }

      // Search action items
      if (parsed.action_items) {
        for (const action of parsed.action_items) {
          if (action.task.toLowerCase().includes(term)) {
            result.score += 7
            result.matches.push(`Action: ${action.task.substring(0, 50)}...`)
          }

          if (action.assigned_to.toLowerCase().includes(term)) {
            result.score += 6
            result.matches.push(`Action owner: ${action.assigned_to}`)
          }
        }
      }

      // Search meeting overview
      if (parsed.meeting_overview && parsed.meeting_overview.toLowerCase().includes(term)) {
        result.score += 5
        result.matches.push(`Meeting overview`)
      }

    } catch (error) {
      // Not a valid JSON summary, skip speaker search
    }

    return result
  }

  /**
   * Build a readable context string from search matches
   */
  private static buildSearchContext(matches: string[], meeting: any): string {
    if (matches.length === 0) return ''

    const uniqueMatches = [...new Set(matches)]
    
    if (uniqueMatches.length === 1) {
      return `Found in: ${uniqueMatches[0]}`
    }

    return `Found in: ${uniqueMatches.slice(0, 3).join(', ')}${uniqueMatches.length > 3 ? ` and ${uniqueMatches.length - 3} more` : ''}`
  }

  /**
   * Filter and sort meetings by search relevance
   */
  static filterAndSortMeetings(meetings: any[], searchTerm: string): any[] {
    if (!searchTerm.trim()) {
      return meetings
    }

    const searchResults = meetings.map(meeting => ({
      meeting,
      searchResult: this.searchMeeting(meeting, searchTerm)
    }))

    // Filter out meetings with no matches
    const relevantMeetings = searchResults.filter(result => result.searchResult.score > 0)

    // Sort by relevance score (descending)
    relevantMeetings.sort((a, b) => b.searchResult.score - a.searchResult.score)

    // Attach search context to meetings for display
    return relevantMeetings.map(result => ({
      ...result.meeting,
      _searchContext: result.searchResult.context,
      _searchScore: result.searchResult.score,
      _searchMatches: result.searchResult.matches
    }))
  }

  /**
   * Get search suggestions based on available speaker data
   */
  static getSearchSuggestions(meetings: any[]): string[] {
    const suggestions = new Set<string>()

    // Standard suggestions
    suggestions.add('decision')
    suggestions.add('action')
    suggestions.add('speaker')
    suggestions.add('discussion')

    // Extract from speaker data
    for (const meeting of meetings) {
      if (!meeting.summary) continue

      try {
        const parsed = JSON.parse(meeting.summary) as SpeakerEnhancedSummary
        
        if (parsed.speakers) {
          // Add communication styles
          for (const speaker of parsed.speakers) {
            suggestions.add(speaker.communication_style)
          }
        }

        // Add common decision keywords
        if (parsed.decisions_made) {
          for (const decision of parsed.decisions_made) {
            const words = decision.decision.toLowerCase().split(' ')
            for (const word of words) {
              if (word.length > 4 && !['said', 'that', 'with', 'from', 'they', 'will', 'have'].includes(word)) {
                suggestions.add(word)
              }
            }
          }
        }

      } catch (error) {
        // Skip invalid JSON
      }
    }

    return Array.from(suggestions).slice(0, 20) // Limit to 20 suggestions
  }
}

/**
 * Enhanced search placeholder text with speaker examples
 */
export const getEnhancedSearchPlaceholder = (hasSpeakerMeetings: boolean): string => {
  if (hasSpeakerMeetings) {
    return "Search titles, speakers, decisions, actions, discussions..."
  }
  return "Search titles, transcripts, summaries..."
}

/**
 * Check if any meetings have speaker data
 */
export const hasAnySpeakerData = (meetings: any[]): boolean => {
  return meetings.some(meeting => {
    if (!meeting.summary) return false
    try {
      const parsed = JSON.parse(meeting.summary)
      return !!(parsed && Array.isArray(parsed.speakers) && parsed.speakers.length > 0)
    } catch {
      return false
    }
  })
}
