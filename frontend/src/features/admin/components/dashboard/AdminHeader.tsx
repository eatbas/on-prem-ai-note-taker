import React, { memo } from 'react'

interface AdminHeaderProps {
  onBackToApp: () => void
}

const AdminHeader = memo(function AdminHeader({ onBackToApp }: AdminHeaderProps) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '32px' 
    }}>
      <div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Admin Dashboard
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: '#6b7280', 
          margin: 0 
        }}>
          System administration and monitoring
        </p>
      </div>
      
      <button
        onClick={onBackToApp}
        style={{
          padding: '8px 16px',
          backgroundColor: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '14px',
          cursor: 'pointer',
          fontWeight: '500',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#e5e7eb'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f3f4f6'
        }}
      >
        ← Back to App
      </button>
    </div>
  )
})

export default AdminHeader
