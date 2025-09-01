import React, { type FC } from 'react'
import { useUserWorkspace } from '../../hooks/useUserWorkspace'

interface WorkspaceScopeOption {
  value: 'personal' | number  // 'personal' or workspace ID
  label: string
  description: string
  icon: string
  disabled?: boolean
}

interface WorkspaceScopeSelectorProps {
  selectedScope: 'personal' | number  // 'personal' or workspace ID
  onScopeChange: (scope: 'personal' | number) => void
  className?: string
}

const WorkspaceScopeSelector: FC<WorkspaceScopeSelectorProps> = ({
  selectedScope,
  onScopeChange,
  className = ''
}) => {
  const { workspaces, loading, hasMultipleWorkspaces } = useUserWorkspace()

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
    ...workspaces.map(workspace => ({
      value: workspace.id,
      label: `Workspace: ${workspace.name}`,
      description: `This meeting will be shared with your workspace "${workspace.name}"`,
      icon: workspace.is_responsible ? '👑' : '🏢',
      disabled: false
    }))
  ]

  return (
    <div className={className}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <label style={{ fontWeight: '500', color: '#374151' }}>
          📋 Meeting Scope:
        </label>
      </div>

      <select
        value={selectedScope}
        onChange={(e) => {
          const value = e.target.value
          onScopeChange(value === 'personal' ? 'personal' : parseInt(value))
        }}
        disabled={workspaces.length === 0}
        style={{
          width: '100%',
          padding: '12px',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          fontSize: '14px',
          backgroundColor: workspaces.length === 0 ? '#f9fafb' : '#ffffff',
          color: '#374151',
          cursor: workspaces.length === 0 ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'border-color 0.2s ease',
          opacity: workspaces.length === 0 ? 0.6 : 1
        }}
        onFocus={(e) => {
          if (workspaces.length > 0) {
            e.target.style.borderColor = '#3b82f6'
            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
          }
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#d1d5db'
          e.target.style.boxShadow = 'none'
        }}
      >
        {scopeOptions.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.icon} {option.label}
          </option>
        ))}
      </select>

      {/* Scope Status Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: workspaces.length === 0 ? '#fffbeb' : '#ecfdf5',
        border: `1px solid ${workspaces.length === 0 ? '#f59e0b' : '#10b981'}`,
        borderRadius: '6px',
        fontSize: '12px',
        marginTop: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: workspaces.length === 0 ? '#92400e' : '#047857'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: workspaces.length === 0 ? '#f59e0b' : '#10b981'
          }} />
          {workspaces.length === 0 
            ? 'No workspace assigned - personal meetings only'
            : selectedScope === 'personal' 
              ? 'Personal meeting - private to you'
              : (() => {
                  const selectedWorkspace = workspaces.find(w => w.id === selectedScope)
                  return selectedWorkspace 
                    ? `Workspace meeting - shared with "${selectedWorkspace.name}"`
                    : 'Workspace meeting selected'
                })()
          }
        </div>
        {workspaces.length > 0 && (
          <div style={{
            fontSize: '10px',
            color: '#047857',
            fontWeight: '500'
          }}>
            {selectedScope === 'personal' ? 'Private' : 'Shared'}
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkspaceScopeSelector
