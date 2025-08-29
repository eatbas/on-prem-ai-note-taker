import React, { useState } from 'react'
import type { 
  Workspace, 
  WorkspaceCreate, 
  WorkspaceUpdate,
  WorkspaceStats
} from '../../../types/workspace'

interface AdminWorkspacesProps {
  workspaces: Workspace[]
  loading: boolean
  error: string | null
  onCreateWorkspace: (workspace: WorkspaceCreate) => Promise<void>
  onUpdateWorkspace: (id: number, update: WorkspaceUpdate) => Promise<void>
  onDeactivateWorkspace: (id: number) => Promise<void>
  onGetWorkspaceStats?: (id: number) => Promise<WorkspaceStats>
}

export default function AdminWorkspaces({
  workspaces,
  loading,
  error,
  onCreateWorkspace,
  onUpdateWorkspace,
  onDeactivateWorkspace,
  onGetWorkspaceStats
}: AdminWorkspacesProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [processingWorkspaces, setProcessingWorkspaces] = useState<Set<number>>(new Set())
  const [newWorkspace, setNewWorkspace] = useState<WorkspaceCreate>({ name: '', description: '' })
  const [editWorkspace, setEditWorkspace] = useState<WorkspaceUpdate>({})

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name.trim()) return

    setProcessingWorkspaces(prev => new Set(prev).add(-1)) // Use -1 for create operation
    try {
      await onCreateWorkspace(newWorkspace)
      setNewWorkspace({ name: '', description: '' })
      setShowCreateModal(false)
    } finally {
      setProcessingWorkspaces(prev => {
        const newSet = new Set(prev)
        newSet.delete(-1)
        return newSet
      })
    }
  }

  const handleUpdateWorkspace = async () => {
    if (!editingWorkspace) return

    setProcessingWorkspaces(prev => new Set(prev).add(editingWorkspace.id))
    try {
      await onUpdateWorkspace(editingWorkspace.id, editWorkspace)
      setEditingWorkspace(null)
      setEditWorkspace({})
    } finally {
      setProcessingWorkspaces(prev => {
        const newSet = new Set(prev)
        newSet.delete(editingWorkspace.id)
        return newSet
      })
    }
  }

  const handleDeactivateWorkspace = async (workspaceId: number) => {
    setProcessingWorkspaces(prev => new Set(prev).add(workspaceId))
    try {
      await onDeactivateWorkspace(workspaceId)
    } finally {
      setProcessingWorkspaces(prev => {
        const newSet = new Set(prev)
        newSet.delete(workspaceId)
        return newSet
      })
    }
  }

  const startEdit = (workspace: Workspace) => {
    setEditingWorkspace(workspace)
    setEditWorkspace({
      name: workspace.name,
      description: workspace.description,
      is_active: workspace.is_active
    })
  }

  const activeWorkspaces = workspaces.filter(w => w.is_active)
  const inactiveWorkspaces = workspaces.filter(w => !w.is_active)

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
          🏢 Workspace Management
        </h2>
        
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ➕ Create Workspace
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
          <p>Loading workspaces...</p>
        </div>
      )}

      {error && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: '#ef4444',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>❌</div>
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontWeight: '600', color: '#374151' }}>
                {activeWorkspaces.length} active workspace{activeWorkspaces.length !== 1 ? 's' : ''}
              </span>
              {inactiveWorkspaces.length > 0 && (
                <span style={{ marginLeft: '16px', color: '#6b7280' }}>
                  {inactiveWorkspaces.length} inactive
                </span>
              )}
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              Total: {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Active Workspaces */}
          {activeWorkspaces.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
              <p>No workspaces created yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Create your first workspace
              </button>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              marginBottom: inactiveWorkspaces.length > 0 ? '32px' : '0'
            }}>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 120px 120px 150px',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                fontWeight: '600',
                fontSize: '14px',
                color: '#374151'
              }}>
                <div>Name</div>
                <div>Description</div>
                <div>Status</div>
                <div>Created</div>
                <div>Actions</div>
              </div>

              {/* Table Rows */}
              {activeWorkspaces.map((workspace, index) => (
                <div
                  key={workspace.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 2fr 120px 120px 150px',
                    gap: '12px',
                    padding: '16px',
                    borderBottom: index < activeWorkspaces.length - 1 ? '1px solid #f3f4f6' : 'none',
                    backgroundColor: '#ffffff',
                    fontSize: '14px',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ fontWeight: '500', color: '#1f2937' }}>
                    {workspace.name}
                  </div>
                  <div style={{ color: '#6b7280' }}>
                    {workspace.description || <em>No description</em>}
                  </div>
                  <div>
                    <span style={{
                      backgroundColor: workspace.is_active ? '#22c55e' : '#6b7280',
                      color: 'white',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {workspace.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>
                    {new Date(workspace.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => startEdit(workspace)}
                      disabled={processingWorkspaces.has(workspace.id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: processingWorkspaces.has(workspace.id) ? 'not-allowed' : 'pointer',
                        opacity: processingWorkspaces.has(workspace.id) ? 0.6 : 1
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeactivateWorkspace(workspace.id)}
                      disabled={processingWorkspaces.has(workspace.id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: processingWorkspaces.has(workspace.id) ? 'not-allowed' : 'pointer',
                        opacity: processingWorkspaces.has(workspace.id) ? 0.6 : 1
                      }}
                    >
                      {processingWorkspaces.has(workspace.id) ? '⏳' : '🗑️'} Deactivate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inactive Workspaces Section */}
          {inactiveWorkspaces.length > 0 && (
            <>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#6b7280' }}>
                🚫 Inactive Workspaces
              </h3>
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                opacity: 0.7
              }}>
                {inactiveWorkspaces.map((workspace, index) => (
                  <div
                    key={workspace.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 2fr 120px 120px 150px',
                      gap: '12px',
                      padding: '16px',
                      borderBottom: index < inactiveWorkspaces.length - 1 ? '1px solid #f3f4f6' : 'none',
                      backgroundColor: '#f9fafb',
                      fontSize: '14px',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ fontWeight: '500', color: '#6b7280' }}>
                      {workspace.name}
                    </div>
                    <div style={{ color: '#9ca3af' }}>
                      {workspace.description || <em>No description</em>}
                    </div>
                    <div>
                      <span style={{
                        backgroundColor: '#6b7280',
                        color: 'white',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        Inactive
                      </span>
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                      {new Date(workspace.created_at).toLocaleDateString()}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                      Deactivated
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
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
            borderRadius: '8px',
            padding: '24px',
            minWidth: '400px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
              Create New Workspace
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                Workspace Name *
              </label>
              <input
                type="text"
                value={newWorkspace.name}
                onChange={(e) => setNewWorkspace(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter workspace name"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                Description
              </label>
              <textarea
                value={newWorkspace.description}
                onChange={(e) => setNewWorkspace(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter workspace description (optional)"
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewWorkspace({ name: '', description: '' })
                }}
                disabled={processingWorkspaces.has(-1)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkspace}
                disabled={!newWorkspace.name.trim() || processingWorkspaces.has(-1)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: newWorkspace.name.trim() ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: newWorkspace.name.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                {processingWorkspaces.has(-1) ? '⏳ Creating...' : 'Create Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingWorkspace && (
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
            borderRadius: '8px',
            padding: '24px',
            minWidth: '400px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
              Edit Workspace
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                Workspace Name *
              </label>
              <input
                type="text"
                value={editWorkspace.name || ''}
                onChange={(e) => setEditWorkspace(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter workspace name"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                Description
              </label>
              <textarea
                value={editWorkspace.description || ''}
                onChange={(e) => setEditWorkspace(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter workspace description (optional)"
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                <input
                  type="checkbox"
                  checked={editWorkspace.is_active ?? true}
                  onChange={(e) => setEditWorkspace(prev => ({ ...prev, is_active: e.target.checked }))}
                  style={{ width: '16px', height: '16px' }}
                />
                Active
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setEditingWorkspace(null)
                  setEditWorkspace({})
                }}
                disabled={processingWorkspaces.has(editingWorkspace.id)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateWorkspace}
                disabled={!editWorkspace.name?.trim() || processingWorkspaces.has(editingWorkspace.id)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: editWorkspace.name?.trim() ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: editWorkspace.name?.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                {processingWorkspaces.has(editingWorkspace.id) ? '⏳ Updating...' : 'Update Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
