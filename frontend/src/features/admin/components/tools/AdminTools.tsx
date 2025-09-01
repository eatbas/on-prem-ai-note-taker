import React from 'react'
import QuickActions from '../monitoring/health/QuickActions'
import { useQuickActions } from '../monitoring/health/useQuickActions'

export default function AdminTools({ onShowToast }: { onShowToast?: (type: 'success' | 'error', message: string) => void }) {
  // Reuse the same quick actions as Health
  const { actions } = useQuickActions()
  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        🔧 Administrative Tools
      </h2>
      <QuickActions actions={actions as any} />
    </div>
  )
}


