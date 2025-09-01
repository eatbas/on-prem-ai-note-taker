import React, { useState, useEffect } from 'react'

interface Workspace {
  id: number
  name: string
  description?: string
  role?: string
  is_responsible?: boolean
}

interface UserWorkspaceAssignmentProps {
  userId: string
  userName: string
  availableWorkspaces: Workspace[]
  currentWorkspaces: Workspace[]
  isOpen: boolean
  onClose: () => void
  onSave: (assignments: WorkspaceAssignment[]) => Promise<void>
}

interface WorkspaceAssignment {
  workspace_id: number
  role: string
  is_responsible: boolean
}

export default function UserWorkspaceAssignment({
  userId,
  userName,
  availableWorkspaces,
  currentWorkspaces,
  isOpen,
  onClose,
  onSave
}: UserWorkspaceAssignmentProps) {
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Map<number, WorkspaceAssignment>>(new Map())
  const [saving, setSaving] = useState(false)

  // Initialize selected workspaces with current assignments
  useEffect(() => {
    if (isOpen) {
      const initialSelections = new Map<number, WorkspaceAssignment>()
      
      currentWorkspaces.forEach(workspace => {
        initialSelections.set(workspace.id, {
          workspace_id: workspace.id,
          role: workspace.role || 'member',
          is_responsible: workspace.is_responsible || false
        })
      })
      
      setSelectedWorkspaces(initialSelections)
    }
  }, [isOpen, currentWorkspaces])

  const handleWorkspaceToggle = (workspace: Workspace) => {
    const newSelections = new Map(selectedWorkspaces)
    
    if (newSelections.has(workspace.id)) {
      // Remove workspace
      newSelections.delete(workspace.id)
    } else {
      // Add workspace with default values
      newSelections.set(workspace.id, {
        workspace_id: workspace.id,
        role: 'member',
        is_responsible: false
      })
    }
    
    setSelectedWorkspaces(newSelections)
  }

  const handleRoleChange = (workspaceId: number, role: string) => {
    const newSelections = new Map(selectedWorkspaces)
    const assignment = newSelections.get(workspaceId)
    
    if (assignment) {
      newSelections.set(workspaceId, { ...assignment, role })
      setSelectedWorkspaces(newSelections)
    }
  }

  const handleResponsibilityChange = (workspaceId: number, isResponsible: boolean) => {
    const newSelections = new Map(selectedWorkspaces)
    const assignment = newSelections.get(workspaceId)
    
    if (assignment) {
      newSelections.set(workspaceId, { ...assignment, is_responsible: isResponsible })
      setSelectedWorkspaces(newSelections)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const assignments = Array.from(selectedWorkspaces.values())
      await onSave(assignments)
      onClose()
    } catch (error) {
      console.error('Failed to save workspace assignments:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: 0,
            color: '#1f2937'
          }}>
            🏢 Manage Workspaces for {userName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: 0
            }}
          >
            ×
          </button>
        </div>

        {/* User Info */}
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>User ID: {userId}</div>
          <div style={{ fontSize: '16px', fontWeight: '500', color: '#1f2937' }}>Username: {userName}</div>
        </div>

        {/* Workspace Selection */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '16px',
            color: '#374151'
          }}>
            Available Workspaces
          </h3>

          {availableWorkspaces.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏢</div>
              <p>No workspaces available</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '12px',
              maxHeight: '300px',
              overflow: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}>
              {availableWorkspaces.map(workspace => {
                const isSelected = selectedWorkspaces.has(workspace.id)
                const assignment = selectedWorkspaces.get(workspace.id)

                return (
                  <div
                    key={workspace.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '16px',
                      backgroundColor: isSelected ? '#f0f9ff' : 'white',
                      borderColor: isSelected ? '#3b82f6' : '#e5e7eb'
                    }}
                  >
                    {/* Workspace Checkbox */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: isSelected ? '12px' : 0
                    }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleWorkspaceToggle(workspace)}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: '500',
                          fontSize: '14px',
                          color: '#1f2937'
                        }}>
                          {workspace.name}
                        </div>
                        {workspace.description && (
                          <div style={{
                            fontSize: '12px',
                            color: '#6b7280',
                            marginTop: '2px'
                          }}>
                            {workspace.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Role and Responsibility Options (only when selected) */}
                    {isSelected && assignment && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #e5e7eb'
                      }}>
                        {/* Role Selection */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '4px'
                          }}>
                            Role
                          </label>
                          <select
                            value={assignment.role}
                            onChange={(e) => handleRoleChange(workspace.id, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '12px',
                              backgroundColor: 'white'
                            }}
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="director">Director</option>
                          </select>
                        </div>

                        {/* Responsibility Checkbox */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '8px'
                          }}>
                            Responsibility
                          </label>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}>
                            <input
                              type="checkbox"
                              checked={assignment.is_responsible}
                              onChange={(e) => handleResponsibilityChange(workspace.id, e.target.checked)}
                              style={{
                                width: '14px',
                                height: '14px'
                              }}
                            />
                            <span>👑 Responsible</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Summary */}
        {selectedWorkspaces.size > 0 && (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#166534',
              marginBottom: '4px'
            }}>
              Selected: {selectedWorkspaces.size} workspace{selectedWorkspaces.size !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '12px', color: '#166534' }}>
              {Array.from(selectedWorkspaces.values())
                .filter(a => a.is_responsible)
                .length > 0 && (
                `👑 Responsible for: ${Array.from(selectedWorkspaces.entries())
                  .filter(([_, assignment]) => assignment.is_responsible)
                  .map(([workspaceId, _]) => availableWorkspaces.find(w => w.id === workspaceId)?.name)
                  .join(', ')}`
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: saving ? '#9ca3af' : '#3b82f6',
              color: 'white',
              fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {saving ? (
              <>
                <span>⏳</span>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Save Assignments</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
