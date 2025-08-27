import React from 'react'
import { useNotification, Notification } from '../../contexts/NotificationContext'

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'success': return '✅'
    case 'error': return '❌'
    case 'warning': return '⚠️'
    case 'info': return 'ℹ️'
    default: return 'ℹ️'
  }
}

const getNotificationColors = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return {
        backgroundColor: '#f0f9ff',
        borderColor: '#0ea5e9',
        textColor: '#0c4a6e'
      }
    case 'error':
      return {
        backgroundColor: '#fef2f2',
        borderColor: '#ef4444',
        textColor: '#991b1b'
      }
    case 'warning':
      return {
        backgroundColor: '#fffbeb',
        borderColor: '#f59e0b',
        textColor: '#92400e'
      }
    case 'info':
      return {
        backgroundColor: '#f8fafc',
        borderColor: '#64748b',
        textColor: '#334155'
      }
    default:
      return {
        backgroundColor: '#f8fafc',
        borderColor: '#64748b',
        textColor: '#334155'
      }
  }
}

interface NotificationItemProps {
  notification: Notification
  onClose: (id: string) => void
}

function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const colors = getNotificationColors(notification.type)
  const icon = getNotificationIcon(notification.type)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px',
        backgroundColor: colors.backgroundColor,
        border: `2px solid ${colors.borderColor}`,
        borderRadius: '12px',
        boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        maxWidth: '400px',
        minWidth: '300px',
        marginBottom: '12px',
        animation: 'slideInLeft 0.3s ease-out',
        position: 'relative'
      }}
    >
      <div style={{ 
        fontSize: '18px', 
        lineHeight: '1',
        marginTop: '1px'
      }}>
        {icon}
      </div>
      
      <div style={{ 
        flex: 1,
        fontSize: '14px',
        lineHeight: '1.4',
        color: colors.textColor,
        fontWeight: '500'
      }}>
        {notification.message}
      </div>
      
      <button
        onClick={() => onClose(notification.id)}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '16px',
          cursor: 'pointer',
          color: colors.textColor,
          opacity: 0.7,
          padding: '2px',
          borderRadius: '4px',
          lineHeight: '1'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1'
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.7'
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        ✕
      </button>
    </div>
  )
}

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotification()

  if (notifications.length === 0) {
    return null
  }

  return (
    <>
      {/* CSS Animation Styles */}
      <style>{`
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 10000,
          pointerEvents: 'auto'
        }}
      >
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
      </div>
    </>
  )
}
