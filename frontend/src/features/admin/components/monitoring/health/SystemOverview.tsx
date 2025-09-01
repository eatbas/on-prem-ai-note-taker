import React from 'react'
import type { SystemHealth } from './types'

export function getStatusColor(status: string) {
  switch (status) {
    case 'healthy':
    case 'connected':
    case 'excellent':
      return '#10b981'
    case 'warning':
    case 'good':
      return '#f59e0b'
    case 'critical':
    case 'disconnected':
    case 'poor':
      return '#ef4444'
    default:
      return '#6b7280'
  }
}

export function getUsageColor(usage: number, warning = 70, critical = 85) {
  if (usage >= critical) return '#ef4444'
  if (usage >= warning) return '#f59e0b'
  return '#10b981'
}

export default function SystemOverview({ health }: { health: SystemHealth | null }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '20px',
      marginBottom: '30px'
    }}>
      {/* VPS Health */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: getStatusColor(health?.vps.status || 'unknown')
            }}
          />
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>🖥️ VPS Health</h3>
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>CPU Usage</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: getUsageColor(health?.vps.cpu_usage || 0) }}>
              {health?.vps.cpu_usage.toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Memory</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: getUsageColor(health?.vps.memory_usage || 0) }}>
              {health?.vps.memory_usage.toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Response Time</span>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{health?.vps.response_time}ms</span>
          </div>
        </div>
      </div>

      {/* Redis Status */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: getStatusColor(health?.redis.status || 'unknown')
            }}
          />
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>🔄 Redis Queue</h3>
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Queue Length</span>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{health?.redis.queue_length} tasks</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Memory Usage</span>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{health?.redis.memory_usage.toFixed(1)} MB</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Clients</span>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{health?.redis.connected_clients}</span>
          </div>
        </div>
      </div>

      {/* Celery Workers */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: getStatusColor(health?.celery.status || 'unknown')
            }}
          />
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>⚙️ Workers</h3>
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Active Workers</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>{health?.celery.active_workers}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Pending Tasks</span>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{health?.celery.pending_tasks}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Failed (24h)</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: health?.celery.failed_tasks_24h === 0 ? '#10b981' : '#ef4444' }}>{health?.celery.failed_tasks_24h}</span>
          </div>
        </div>
      </div>

      {/* Speaker Intelligence */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8b5cf6' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>🎤 Speaker AI</h3>
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Enhanced Summaries</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#8b5cf6' }}>{health?.speaker_intelligence.enhanced_summaries_count}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Avg Speakers</span>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{health?.speaker_intelligence.avg_speaker_count.toFixed(1)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Accuracy Score</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: getUsageColor(health?.speaker_intelligence.accuracy_score || 0, 80, 90) }}>{health?.speaker_intelligence.accuracy_score.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}


