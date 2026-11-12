import { useEffect, useState } from 'react'
import { localDateKey } from './streak.ts'

function readClock(now = new Date()) {
  return { day: localDateKey(now), zone: Intl.DateTimeFormat().resolvedOptions().timeZone, tick: Math.floor(+now / 30_000) }
}

export function useStudyClock() {
  const [clock, setClock] = useState(readClock)
  useEffect(() => {
    let timer: number
    const sync = () => {
      const now = new Date()
      const next = readClock(now)
      setClock(previous => previous.day === next.day && previous.zone === next.zone && previous.tick === next.tick ? previous : next)
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      window.clearTimeout(timer)
      timer = window.setTimeout(sync, Math.min(+tomorrow - +now, 30_000 - (+now % 30_000)))
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [])
  return clock
}

export function useStudyDay(): string {
  return useStudyClock().day
}
