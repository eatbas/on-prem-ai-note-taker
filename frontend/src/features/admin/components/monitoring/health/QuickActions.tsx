import React from 'react'

interface Action {
  title: string
  description: string
  icon: string
  action: () => void | Promise<void>
  loading?: boolean
  color: string
}

export default function QuickActions({ actions }: { actions: Action[] }) {
  return (
    <div style={{
      backgroundColor: '#f8fafc',
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid #e2e8f0'
    }}>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
        🔧 Quick Actions
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {actions.map((tool, index) => (
          <div
            key={index}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                fontSize: '32px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${(tool as any).color}15`,
                borderRadius: '12px'
              }}>
                {tool.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                  {tool.title}
                </h3>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              {tool.description}
            </p>

            <button
              onClick={tool.action}
              disabled={tool.loading}
              style={{
                width: '100%',
                padding: '12px 20px',
                backgroundColor: tool.loading ? '#9ca3af' : (tool as any).color,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: tool.loading ? 'not-allowed' : 'pointer',
                opacity: tool.loading ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {tool.loading ? 'Processing...' : `Execute ${tool.title}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}


