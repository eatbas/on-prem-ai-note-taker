import { useState, useEffect, useRef } from 'react'

export function useChatTimer(loading: boolean) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [lastThinkingSeconds, setLastThinkingSeconds] = useState<number | null>(null)
    const timerRef = useRef<number | null>(null)
    const startTimeRef = useRef<number | null>(null)

    // Handle live timer while loading
    useEffect(() => {
        if (loading) {
            setElapsedSeconds(0)
            const startedAt = startTimeRef.current ?? Date.now()
            if (startTimeRef.current == null) startTimeRef.current = startedAt
            
            timerRef.current = window.setInterval(() => {
                setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
            }, 1000)
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
    }, [loading])

    const getDurationSeconds = () => {
        return startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : elapsedSeconds
    }

    const resetTimer = () => {
        startTimeRef.current = null
        setElapsedSeconds(0)
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }

    const recordThinkingTime = () => {
        const duration = getDurationSeconds()
        setLastThinkingSeconds(duration)
        return duration
    }

    return {
        elapsedSeconds,
        lastThinkingSeconds,
        getDurationSeconds,
        resetTimer,
        recordThinkingTime
    }
}
