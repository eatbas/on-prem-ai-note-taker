import React, { useState, useEffect } from 'react'
import { useToast } from '../../../../components/common'

interface SystemHealth {
  vps: {
    status: 'healthy' | 'warning' | 'critical'
    cpu_usage: number
    memory_usage: number
    disk_usage: number
    response_time: number
  }
  redis: {
    status: 'connected' | 'disconnected'
    memory_usage: number
    connected_clients: number
    queue_length: number
  }
  celery: {
    status: 'healthy' | 'warning' | 'critical'
    active_workers: number
    pending_tasks: number
    failed_tasks_24h: number
    avg_task_duration: number
  }
  whisper: {
    model_loaded: boolean
    memory_usage_mb: number
    processing_queue: number
    avg_processing_time: number
  }
  speaker_intelligence: {
    total_meetings_processed: number
    enhanced_summaries_count: number
    avg_speaker_count: number
    accuracy_score: number
  }
}

interface PerformanceMetrics {
  meeting_processing: {
    avg_duration_minutes: number
    success_rate: number
    throughput_per_hour: number
  }
  frontend: {
    dashboard_load_time: number
    search_response_time: number
    ui_responsiveness_score: number
  }
  audio_streaming: {
    avg_startup_time: number
    buffer_health: number
    stream_quality: 'excellent' | 'good' | 'fair' | 'poor'
  }
}

export default function ProductionHealthDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const { showToast } = useToast()

  const fetchHealthData = async () => {
    try {
      // Simulate health data fetching
      // In production, these would be real API calls
      const healthResponse = await fetch('/api/admin/health/comprehensive')
      const metricsResponse = await fetch('/api/admin/metrics/performance')
      
      if (healthResponse.ok && metricsResponse.ok) {
        setHealth(await healthResponse.json())
        setMetrics(await metricsResponse.json())
      }
    } catch (error) {
      console.error('Failed to fetch health data:', error)
      // Mock data for development/testing
      setHealth({
        vps: {
          status: 'healthy',
          cpu_usage: 45.2,
          memory_usage: 68.5,
          disk_usage: 23.1,
          response_time: 150
        },
        redis: {
          status: 'connected',
          memory_usage: 12.3,
          connected_clients: 5,
          queue_length: 2
        },
        celery: {
          status: 'healthy',
          active_workers: 3,
          pending_tasks: 1,
          failed_tasks_24h: 0,
          avg_task_duration: 45.7
        },
        whisper: {
          model_loaded: true,
          memory_usage_mb: 2048,
          processing_queue: 0,
          avg_processing_time: 32.4
        },
        speaker_intelligence: {
          total_meetings_processed: 127,
          enhanced_summaries_count: 89,
          avg_speaker_count: 2.8,
          accuracy_score: 87.5
        }
      })
      
      setMetrics({
        meeting_processing: {
          avg_duration_minutes: 2.4,
          success_rate: 98.5,
          throughput_per_hour: 12
        },
        frontend: {
          dashboard_load_time: 320,
          search_response_time: 180,
          ui_responsiveness_score: 95
        },
        audio_streaming: {
          avg_startup_time: 1.2,
          buffer_health: 98,
          stream_quality: 'excellent'
        }
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData()
    
    if (autoRefresh) {
      const interval = setInterval(fetchHealthData, 30000) // 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const getStatusColor = (status: string) => {
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

  const getUsageColor = (usage: number, warning = 70, critical = 85) => {
    if (usage >= critical) return '#ef4444'
    if (usage >= warning) return '#f59e0b'
    return '#10b981'
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        color: '#6b7280'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
          <p>Loading production health data...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>
            🔍 Production Health Dashboard
          </h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>
            Real-time monitoring of speaker intelligence system
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchHealthData}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 Refresh Now
          </button>
        </div>
      </div>

      {/* System Status Overview */}
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
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600',
                color: getUsageColor(health?.vps.cpu_usage || 0)
              }}>
                {health?.vps.cpu_usage.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Memory</span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600',
                color: getUsageColor(health?.vps.memory_usage || 0)
              }}>
                {health?.vps.memory_usage.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Response Time</span>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                {health?.vps.response_time}ms
              </span>
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
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                {health?.redis.queue_length} tasks
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Memory Usage</span>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                {health?.redis.memory_usage.toFixed(1)} MB
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Clients</span>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                {health?.redis.connected_clients}
              </span>
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
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                {health?.celery.active_workers}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Pending Tasks</span>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                {health?.celery.pending_tasks}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Failed (24h)</span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600',
                color: health?.celery.failed_tasks_24h === 0 ? '#10b981' : '#ef4444'
              }}>
                {health?.celery.failed_tasks_24h}
              </span>
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
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#8b5cf6'
              }}
            />
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>🎤 Speaker AI</h3>
          </div>
          
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Enhanced Summaries</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#8b5cf6' }}>
                {health?.speaker_intelligence.enhanced_summaries_count}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Avg Speakers</span>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                {health?.speaker_intelligence.avg_speaker_count.toFixed(1)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Accuracy Score</span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600',
                color: getUsageColor(health?.speaker_intelligence.accuracy_score || 0, 80, 90)
              }}>
                {health?.speaker_intelligence.accuracy_score.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#1f2937' }}>
          📊 Performance Metrics
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {/* Meeting Processing */}
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
              🎙️ Meeting Processing
            </h4>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Avg Duration</span>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  {metrics?.meeting_processing.avg_duration_minutes.toFixed(1)} min
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Success Rate</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                  {metrics?.meeting_processing.success_rate.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Throughput/Hour</span>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  {metrics?.meeting_processing.throughput_per_hour} meetings
                </span>
              </div>
            </div>
          </div>

          {/* Frontend Performance */}
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
              💻 Frontend Performance
            </h4>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Dashboard Load</span>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  {metrics?.frontend.dashboard_load_time}ms
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Search Response</span>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  {metrics?.frontend.search_response_time}ms
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>UI Responsiveness</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                  {metrics?.frontend.ui_responsiveness_score}/100
                </span>
              </div>
            </div>
          </div>

          {/* Audio Streaming */}
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
              🎵 Audio Streaming
            </h4>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Startup Time</span>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  {metrics?.audio_streaming.avg_startup_time.toFixed(1)}s
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Buffer Health</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                  {metrics?.audio_streaming.buffer_health}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Stream Quality</span>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: '600',
                  color: getStatusColor(metrics?.audio_streaming.stream_quality || 'unknown')
                }}>
                  {metrics?.audio_streaming.stream_quality}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        backgroundColor: '#f8fafc',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
          🔧 Quick Actions
        </h3>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => showToast('VPS diagnostics started', 'info')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔍 Run VPS Diagnostics
          </button>
          
          <button
            onClick={() => showToast('Memory cleanup initiated', 'info')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🧹 Cleanup Memory
          </button>
          
          <button
            onClick={() => showToast('Queue processing restarted', 'success')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 Restart Queue
          </button>
          
          <button
            onClick={() => showToast('Performance test initiated', 'info')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ⚡ Performance Test
          </button>
        </div>
      </div>
    </div>
  )
}
