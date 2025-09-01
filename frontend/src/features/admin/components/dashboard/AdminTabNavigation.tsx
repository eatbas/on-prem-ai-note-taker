import React, { memo } from 'react'

interface AdminTabNavigationProps {
  activeTab: string
  onTabChange: (tab: any) => void
  tabs: Array<{
    key: string
    label: string
    description: string
  }>
}

const AdminTabNavigation = memo(function AdminTabNavigation({
  activeTab,
  onTabChange,
  tabs
}: AdminTabNavigationProps) {
  return (
    <div style={{
      display: 'flex',
      backgroundColor: '#f8fafc',
      borderRadius: '12px',
      padding: '6px',
      marginBottom: '32px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      gap: '4px',
      overflowX: 'auto'
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          style={{
            flex: '1',
            minWidth: '140px',
            padding: '12px 16px',
            backgroundColor: activeTab === tab.key ? '#ffffff' : 'transparent',
            color: activeTab === tab.key ? '#1f2937' : '#6b7280',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: activeTab === tab.key ? '600' : '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.key) {
              e.currentTarget.style.backgroundColor = '#f1f5f9'
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.key) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          <span>{tab.label}</span>
          <span style={{ 
            fontSize: '11px', 
            color: activeTab === tab.key ? '#6b7280' : '#9ca3af' 
          }}>
            {tab.description}
          </span>
        </button>
      ))}
    </div>
  )
})

export default AdminTabNavigation
