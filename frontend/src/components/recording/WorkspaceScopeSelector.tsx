import React, { useState, useEffect } from 'react'
import { getUserId } from '../../services/api/core'

interface WorkspaceScopeOption {
  value: 'personal' | 'workspace'
  label: string
  description: string
  icon: string
  disabled?: boolean
}

interface WorkspaceScopeSelectorProps {
  selectedScope: 'personal' | 'workspace'
  onScopeChange: (scope: 'personal' | 'workspace') => void
  className?: string
}

export default function WorkspaceScopeSelector({
  selectedScope,
  onScopeChange,
  className = ''
}: WorkspaceScopeSelectorProps) {
  const [userWorkspace, setUserWorkspace] = useState<{ id: number; name: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Get current user's workspace info
  useEffect(() => {
    const fetchUserWorkspace = async () => {
      try {
        setLoading(true)
        const userId = getUserId()
        if (!userId) {
          setLoading(false)
          return
        }

        // For now, we'll assume no workspace until the admin API provides user info
        // In a full implementation, you'd call an API to get current user's workspace
        // For this implementation, we'll check localStorage or use a simple approach
        const mockWorkspace = localStorage.getItem('user_workspace')
        if (mockWorkspace) {
          setUserWorkspace(JSON.parse(mockWorkspace))
        }
      } catch (error) {
        console.error('Failed to fetch user workspace:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserWorkspace()
  }, [])

  if (loading) {
    return (
      <div className={className}>
        <div style={{
          padding: '12px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '14px'
        }}>
          Loading workspace information...
        </div>
      </div>
    )
  }

  const scopeOptions: WorkspaceScopeOption[] = [
    {
      value: 'personal',
      label: 'Personal Meeting',
      description: 'This meeting will be private and only visible to you',
      icon: '👤',
      disabled: false
    },
    {
      value: 'workspace',
      label: userWorkspace ? `Workspace: ${userWorkspace.name}` : 'Workspace Meeting',
      description: userWorkspace 
        ? `This meeting will be shared with your workspace "${userWorkspace.name}"`
        : 'You need to be assigned to a workspace by an admin',
      icon: '🏢',
      disabled: !userWorkspace
    }
  ]

  return (
    <div className={className}>
      <label style={{
        display: 'block',
        marginBottom: '12px',
        fontSize: '16px',
        fontWeight: '600',
        color: '#374151'
      }}>
        📋 Meeting Scope
      </label>
      
      {!userWorkspace && (
        <div style={{
          marginBottom: '12px',
          padding: '12px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fbbf24',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#92400e'
        }}>
          <div style={{ fontWeight: '500', marginBottom: '4px' }}>
            💡 No workspace assigned
          </div>
          <div>
            You can only create personal meetings. Contact an admin to be assigned to a workspace.
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '8px'
      }}>
        {scopeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => !option.disabled && onScopeChange(option.value)}
            disabled={option.disabled}
            style={{
              padding: '16px',
              backgroundColor: selectedScope === option.value 
                ? '#3b82f6' 
                : option.disabled 
                  ? '#f9fafb' 
                  : '#f8fafc',
              color: selectedScope === option.value 
                ? 'white' 
                : option.disabled 
                  ? '#9ca3af' 
                  : '#374151',
              border: selectedScope === option.value 
                ? '2px solid #3b82f6' 
                : option.disabled 
                  ? '1px solid #e5e7eb' 
                  : '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: option.disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              opacity: option.disabled ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!option.disabled && selectedScope !== option.value) {
                e.currentTarget.style.backgroundColor = '#e5e7eb'
                e.currentTarget.style.borderColor = '#9ca3af'
              }
            }}
            onMouseLeave={(e) => {
              if (!option.disabled && selectedScope !== option.value) {
                e.currentTarget.style.backgroundColor = '#f8fafc'
                e.currentTarget.style.borderColor = '#d1d5db'
              }
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '18px' }}>{option.icon}</span>
              <span style={{ fontWeight: '600' }}>{option.label}</span>
              {selectedScope === option.value && (
                <span style={{ marginLeft: 'auto', fontSize: '16px' }}>✓</span>
              )}
            </div>
            <div style={{ 
              fontSize: '12px', 
              opacity: 0.9,
              fontWeight: '400',
              lineHeight: '1.4',
              marginLeft: '30px'
            }}>
              {option.description}
            </div>
          </button>
        ))}
      </div>

      {userWorkspace && selectedScope === 'workspace' && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#374151'
        }}>
          <div style={{ fontWeight: '500', marginBottom: '4px' }}>
            🏢 Workspace Meeting
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            All members of "{userWorkspace.name}" workspace will be able to view this meeting.
          </div>
        </div>
      )}
    </div>
  )
}
