import React from 'react'
import type { PerformanceMetrics } from './types'
import { getStatusColor } from './SystemOverview'

export default function PerformancePanel({ metrics }: { metrics: PerformanceMetrics | null }) {
  return (
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
              <span style={{ fontSize: '14px', fontWeight: '600', color: getStatusColor(metrics?.audio_streaming.stream_quality || 'unknown') }}>
                {metrics?.audio_streaming.stream_quality}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


