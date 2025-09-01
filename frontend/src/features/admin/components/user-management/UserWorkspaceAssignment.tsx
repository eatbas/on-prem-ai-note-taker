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
  onAssignMultiple?: (userId: string, assignments: WorkspaceAssignment[]) => Promise<void>
  onSave?: (assignments: WorkspaceAssignment[]) => Promise<void>
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
  onAssignMultiple,
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

  const handleWorkspaceToggle = (workspaceId: number, isSelected: boolean) => {
    const newSelections = new Map(selectedWorkspaces)
    
    if (isSelected) {
      newSelections.set(workspaceId, {
        workspace_id: workspaceId,
        role: 'member',
        is_responsible: false
      })
    } else {
      newSelections.delete(workspaceId)
    }
    
    setSelectedWorkspaces(newSelections)
  }

  const handleRoleChange = (workspaceId: number, role: string) => {
    const newSelections = new Map(selectedWorkspaces)
    const current = newSelections.get(workspaceId)
    
    if (current) {
      newSelections.set(workspaceId, {
        ...current,
        role
      })
      setSelectedWorkspaces(newSelections)
    }
  }

  const handleResponsibleToggle = (workspaceId: number, isResponsible: boolean) => {
    const newSelections = new Map(selectedWorkspaces)
    const current = newSelections.get(workspaceId)
    
    if (current) {
      newSelections.set(workspaceId, {
        ...current,
        is_responsible: isResponsible
      })
      setSelectedWorkspaces(newSelections)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const assignments = Array.from(selectedWorkspaces.values())
      
      if (onAssignMultiple) {
        await onAssignMultiple(userId, assignments)
      } else if (onSave) {
        await onSave(assignments)
      }
      
      onClose()
    } catch (error) {
      console.error('Failed to save workspace assignments:', error)
      alert('Failed to save workspace assignments. Please try again.')
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
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
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
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 4px 0'
            }}>
              🏢 Workspace Assignment
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0
            }}>
              Manage workspace assignments for <strong>{userName}</strong>
            </p>
          </div>
          
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid #d1d5db',
              backgroundColor: '#f9fafb',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              color: '#6b7280'
            }}
          >
            ✕
          </button>
        </div>

        {/* Workspace List */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '16px'
          }}>
            Available Workspaces
          </h3>
          
          {availableWorkspaces.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏢</div>
              <p style={{ color: '#6b7280', margin: 0 }}>
                No active workspaces available
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {availableWorkspaces.map(workspace => {
                const isSelected = selectedWorkspaces.has(workspace.id)
                const assignment = selectedWorkspaces.get(workspace.id)
                
                return (
                  <div key={workspace.id} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '12px',
                    backgroundColor: isSelected ? '#f0f9ff' : 'white'
                  }}>
                    {/* Workspace Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: isSelected ? '16px' : 0
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleWorkspaceToggle(workspace.id, e.target.checked)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer'
                          }}
                        />
                        <div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1f2937'
                          }}>
                            {workspace.name}
                          </div>
                          {workspace.description && (
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280'
                            }}>
                              {workspace.description}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isSelected && (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          Selected
                        </span>
                      )}
                    </div>

                    {/* Assignment Options (shown when selected) */}
                    {isSelected && assignment && (
                      <div style={{
                        paddingTop: '16px',
                        borderTop: '1px solid #e5e7eb',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px'
                      }}>
                        {/* Role Selection */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: '600',
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
                              padding: '6px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>

                        {/* Responsibility Toggle */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#374151',
                            marginBottom: '4px'
                          }}>
                            Responsibility
                          </label>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <input
                              type="checkbox"
                              checked={assignment.is_responsible}
                              onChange={(e) => handleResponsibleToggle(workspace.id, e.target.checked)}
                              style={{
                                width: '14px',
                                height: '14px',
                                cursor: 'pointer'
                              }}
                            />
                            <span style={{
                              fontSize: '12px',
                              color: '#374151'
                            }}>
                              Responsible for workspace
                            </span>
                          </div>
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
            padding: '16px',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            marginBottom: '24px',
            border: '1px solid #bae6fd'
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#1e40af',
              margin: '0 0 8px 0'
            }}>
              📋 Assignment Summary
            </h4>
            <div style={{ fontSize: '12px', color: '#1e40af' }}>
              <strong>{userName}</strong> will be assigned to <strong>{selectedWorkspaces.size}</strong> workspace{selectedWorkspaces.size !== 1 ? 's' : ''}
              {Array.from(selectedWorkspaces.values()).some(a => a.is_responsible) && (
                <span> and will be responsible for {Array.from(selectedWorkspaces.values()).filter(a => a.is_responsible).length} of them</span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
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
              backgroundColor: saving ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {saving ? (
              <>
                <div style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Saving...
              </>
            ) : (
              <>
                💾 Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
