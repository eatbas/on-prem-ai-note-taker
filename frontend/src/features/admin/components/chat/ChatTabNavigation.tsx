import React, { memo } from 'react'

interface ChatTabNavigationProps {
  activeTab: 'current' | 'history'
  onTabChange: (tab: 'current' | 'history') => void
  chatHistoryCount: number
}

const ChatTabNavigation = memo(function ChatTabNavigation({
  activeTab,
  onTabChange,
  chatHistoryCount
}: ChatTabNavigationProps) {
  const tabs = [
    { key: 'current', label: '💬 Current Chat', description: 'Ask questions here' },
    { key: 'history', label: `📚 History (${chatHistoryCount})`, description: 'View past conversations' }
  ]

  return (
    <div style={{
      display: 'flex',
      backgroundColor: '#f8fafc',
      borderRadius: '12px',
      padding: '6px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key as any)}
          style={{
            flex: 1,
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

export default ChatTabNavigation
