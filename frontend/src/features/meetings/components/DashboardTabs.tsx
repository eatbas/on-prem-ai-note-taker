import React from 'react'

interface DashboardTabsProps {
  activeTab: 'local' | 'vps' | 'llama' | 'audio-test'
  onTabChange: (tab: 'local' | 'vps' | 'llama' | 'audio-test') => void
  localMeetingsCount: number
  vpsMeetingsCount: number
  vpsUp: boolean
}

export default function DashboardTabs({
  activeTab,
  onTabChange,
  localMeetingsCount,
  vpsMeetingsCount,
  vpsUp
}: DashboardTabsProps) {
  const tabs = [
    {
      key: 'local' as const,
      label: 'Local Meetings',
      icon: '💾',
      count: localMeetingsCount,
      description: 'Meetings stored locally'
    },
    {
      key: 'vps' as const,
      label: 'Cloud Meetings',
      icon: '☁️',
      count: vpsMeetingsCount,
      description: 'Meetings on remote server',
      disabled: !vpsUp
    },
    {
      key: 'llama' as const,
      label: 'Ask AI',
      icon: '🤖',
      description: 'Chat with AI about your meetings',
      disabled: !vpsUp
    },
    {
      key: 'audio-test' as const,
      label: 'Audio Test',
      icon: '🎤',
      description: 'Test audio recording setup'
    }
  ]

  return (
    <div style={{ 
      display: 'flex',
      backgroundColor: '#f8fafc',
      borderRadius: '12px',
      padding: '6px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      gap: '4px'
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => !tab.disabled && onTabChange(tab.key)}
          disabled={tab.disabled}
          style={{
            flex: 1,
            padding: '12px 16px',
            backgroundColor: activeTab === tab.key ? '#ffffff' : 'transparent',
            color: tab.disabled ? '#9ca3af' : activeTab === tab.key ? '#1f2937' : '#6b7280',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: activeTab === tab.key ? '600' : '500',
            cursor: tab.disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
            opacity: tab.disabled ? 0.5 : 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
          }}
          onMouseEnter={(e) => {
            if (!tab.disabled && activeTab !== tab.key) {
              e.currentTarget.style.backgroundColor = '#f1f5f9'
            }
          }}
          onMouseLeave={(e) => {
            if (!tab.disabled && activeTab !== tab.key) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontSize: '16px'
          }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {typeof tab.count !== 'undefined' && (
              <span style={{
                backgroundColor: activeTab === tab.key ? '#3b82f6' : '#e5e7eb',
                color: activeTab === tab.key ? 'white' : '#6b7280',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: '600',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {tab.count}
              </span>
            )}
          </div>
          
          <div style={{ 
            fontSize: '11px',
            color: tab.disabled ? '#9ca3af' : '#6b7280',
            textAlign: 'center'
          }}>
            {tab.description}
          </div>
          
          {tab.disabled && (
            <div style={{ 
              fontSize: '10px',
              color: '#ef4444',
              fontWeight: '600'
            }}>
              Offline
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
