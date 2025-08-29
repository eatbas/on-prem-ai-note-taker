import React from 'react'

interface SearchAndFiltersProps {
  text: string
  setText: (text: string) => void
  tag: string
  setTag: (tag: string) => void
  availableTags: [string, number][]
  workspaceFilter: 'all' | 'personal' | 'workspace'
  setWorkspaceFilter: (filter: 'all' | 'personal' | 'workspace') => void
  userHasWorkspace: boolean
  onClearFilters: () => void
}

export default function SearchAndFilters({
  text,
  setText,
  tag,
  setTag,
  availableTags,
  workspaceFilter,
  setWorkspaceFilter,
  userHasWorkspace,
  onClearFilters
}: SearchAndFiltersProps) {
  const hasFilters = text || tag || workspaceFilter !== 'all'

  return (
    <div style={{ 
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          margin: 0,
          color: '#1f2937'
        }}>
          🔍 Search & Filter
        </h3>
        
        {hasFilters && (
          <button
            onClick={onClearFilters}
            style={{
              padding: '6px 12px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              color: '#6b7280',
              fontWeight: '500'
            }}
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px'
      }}>
        {/* Text Search */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: '12px', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '6px'
          }}>
            Search in content
          </label>
          <input
            type="text"
            placeholder="Search titles, transcripts, summaries..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6'
              e.target.style.outline = 'none'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#d1d5db'
            }}
          />
          {text && (
            <div style={{ 
              fontSize: '11px', 
              color: '#6b7280', 
              marginTop: '4px' 
            }}>
              Searching: "{text}"
            </div>
          )}
        </div>

        {/* Tag Filter */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: '12px', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '6px'
          }}>
            Filter by tag
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Filter by tag..."
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6'
                e.target.style.outline = 'none'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db'
              }}
            />
            
            {/* Tag suggestions */}
            {availableTags.length > 0 && (
              <div style={{ 
                marginTop: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px'
              }}>
                {availableTags.slice(0, 5).map(([tagName, count]) => (
                  <button
                    key={tagName}
                    onClick={() => setTag(tagName)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: tag === tagName ? '#3b82f6' : '#f3f4f6',
                      color: tag === tagName ? 'white' : '#6b7280',
                      border: '1px solid #d1d5db',
                      borderRadius: '12px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (tag !== tagName) {
                        e.currentTarget.style.backgroundColor = '#e5e7eb'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (tag !== tagName) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6'
                      }
                    }}
                  >
                    {tagName} ({count})
                  </button>
                ))}
                {availableTags.length > 5 && (
                  <span style={{ 
                    fontSize: '11px', 
                    color: '#9ca3af',
                    alignSelf: 'center'
                  }}>
                    +{availableTags.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
          
          {tag && (
            <div style={{ 
              fontSize: '11px', 
              color: '#6b7280', 
              marginTop: '4px' 
            }}>
              Filtering by: "{tag}"
            </div>
          )}
        </div>

        {/* Workspace Filter */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: '12px', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '6px'
          }}>
            Meeting scope
          </label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '6px'
          }}>
            <button
              onClick={() => setWorkspaceFilter('all')}
              style={{
                padding: '8px 12px',
                backgroundColor: workspaceFilter === 'all' ? '#3b82f6' : '#f8fafc',
                color: workspaceFilter === 'all' ? 'white' : '#374151',
                border: workspaceFilter === 'all' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                if (workspaceFilter !== 'all') {
                  e.currentTarget.style.backgroundColor = '#e5e7eb'
                  e.currentTarget.style.borderColor = '#9ca3af'
                }
              }}
              onMouseLeave={(e) => {
                if (workspaceFilter !== 'all') {
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }
              }}
            >
              🌐 All
            </button>
            <button
              onClick={() => setWorkspaceFilter('personal')}
              style={{
                padding: '8px 12px',
                backgroundColor: workspaceFilter === 'personal' ? '#3b82f6' : '#f8fafc',
                color: workspaceFilter === 'personal' ? 'white' : '#374151',
                border: workspaceFilter === 'personal' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                if (workspaceFilter !== 'personal') {
                  e.currentTarget.style.backgroundColor = '#e5e7eb'
                  e.currentTarget.style.borderColor = '#9ca3af'
                }
              }}
              onMouseLeave={(e) => {
                if (workspaceFilter !== 'personal') {
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }
              }}
            >
              👤 Personal
            </button>
            <button
              onClick={() => setWorkspaceFilter('workspace')}
              disabled={!userHasWorkspace}
              style={{
                padding: '8px 12px',
                backgroundColor: workspaceFilter === 'workspace' ? '#3b82f6' : !userHasWorkspace ? '#f3f4f6' : '#f8fafc',
                color: workspaceFilter === 'workspace' ? 'white' : !userHasWorkspace ? '#9ca3af' : '#374151',
                border: workspaceFilter === 'workspace' ? '2px solid #3b82f6' : !userHasWorkspace ? '1px solid #e5e7eb' : '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: !userHasWorkspace ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                opacity: !userHasWorkspace ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (workspaceFilter !== 'workspace' && userHasWorkspace) {
                  e.currentTarget.style.backgroundColor = '#e5e7eb'
                  e.currentTarget.style.borderColor = '#9ca3af'
                }
              }}
              onMouseLeave={(e) => {
                if (workspaceFilter !== 'workspace' && userHasWorkspace) {
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }
              }}
            >
              🏢 Workspace
            </button>
          </div>
          
          {!userHasWorkspace && (
            <div style={{ 
              fontSize: '11px', 
              color: '#6b7280', 
              marginTop: '4px' 
            }}>
              You need to be assigned to a workspace to filter workspace meetings
            </div>
          )}
          
          {workspaceFilter !== 'all' && (
            <div style={{ 
              fontSize: '11px', 
              color: '#6b7280', 
              marginTop: '4px' 
            }}>
              Showing: {workspaceFilter === 'personal' ? 'Personal meetings only' : 'Workspace meetings only'}
            </div>
          )}
        </div>
      </div>

      {/* Active filters summary */}
      {hasFilters && (
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '6px'
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#1e40af',
            fontWeight: '600',
            marginBottom: '4px'
          }}>
            Active Filters:
          </div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px',
            alignItems: 'center'
          }}>
            {text && (
              <span style={{ 
                fontSize: '11px',
                color: '#1e40af',
                backgroundColor: '#dbeafe',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                Text: "{text}"
              </span>
            )}
            {tag && (
              <span style={{ 
                fontSize: '11px',
                color: '#1e40af',
                backgroundColor: '#dbeafe',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                Tag: "{tag}"
              </span>
            )}
            {workspaceFilter !== 'all' && (
              <span style={{ 
                fontSize: '11px',
                color: '#1e40af',
                backgroundColor: '#dbeafe',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                Scope: {workspaceFilter === 'personal' ? 'Personal' : 'Workspace'} meetings
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
