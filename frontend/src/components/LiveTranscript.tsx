import React, { useEffect, useMemo, useRef, useState } from 'react'
import { invoke, listen, isTauri } from '../lib/tauri'

type PartialEvent = {
  session_id: string
  chunk_path: string
  start: number
  end: number
  text: string
  speaker?: string
}

export default function LiveTranscript() {
  const [rows, setRows] = useState<PartialEvent[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [separate, setSeparate] = useState(false)
  const unsubRef = useRef<() => void>()

  useEffect(() => {
    if (!isTauri()) return
    let unlisten: any
    listen('transcript:partial', (e: any) => {
      try {
        const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload
        setRows(prev => [...prev, payload])
      } catch {}
    }).then((un) => { unlisten = un })
    return () => { if (unlisten) unlisten() }
  }, [])

  const start = async (kind: 'mic'|'system'|'mix') => {
    if (busy) return
    setBusy(true)
    try {
      const cmd = kind === 'mic' ? 'ac_start_mic' : kind === 'system' ? 'ac_start_system' : 'ac_start_mix'
      const sid = await invoke(cmd)
      setSessionId(sid)
      setRows([])
    } finally { setBusy(false) }
  }

  const stop = async () => {
    if (busy) return
    setBusy(true)
    try {
      await invoke('ac_stop_and_finalize')
    } finally { setBusy(false) }
  }

  const exportTxt = async () => {
    // Client-side quick export of visible transcript
    const content = rows.map(r => `[${format(r.start)}] ${r.speaker || 'Speaker'}: ${r.text}`).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript_${sessionId || 'session'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const format = (s: number) => {
    const t = Math.max(0, Math.floor(s))
    const h = Math.floor(t / 3600)
    const m = Math.floor((t % 3600) / 60)
    const sec = t % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => start('mic')} disabled={busy}>Start Mic</button>
        <button onClick={() => start('system')} disabled={busy}>Start System</button>
        <button onClick={() => start('mix')} disabled={busy}>Start Mix</button>
        <button onClick={stop} disabled={busy}>Stop</button>
        <div style={{ flex: 1 }} />
        <button onClick={exportTxt} disabled={!rows.length}>Export .txt</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
          <input
            type="checkbox"
            checked={separate}
            onChange={async (e) => {
              const enabled = e.target.checked
              setSeparate(enabled)
              try {
                await invoke('ac_toggle_separate_emission', { enabled })
              } catch (err) {
                console.error('toggle separate failed', err)
              }
            }}
          />
          Keep tracks separate (emit mic/system separately)
        </label>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, maxHeight: 420, overflow: 'auto' }}>
        {rows.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No transcript yet.</div>
        ) : (
          rows.map((r, idx) => (
            <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                [{format(r.start)} - {format(r.end)}] {r.speaker || 'Speaker'}
              </div>
              <div style={{ fontSize: 14, color: '#111827' }}>{r.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}


