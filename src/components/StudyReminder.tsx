import { useEffect, useRef, useState, type FormEvent } from 'react'
import { db } from '../lib/db'
import { getDayStats } from '../lib/stats'
import { go } from '../lib/router'
import { countDue } from '../lib/review'
import { localDateKey } from '../lib/streak'
import {
  isReminderTime, loadReminderPreferences, REMINDER_DISMISS_KEY, REMINDER_KEY, saveReminderPreferences,
  type ReminderPreferences,
} from '../lib/reminders'

export function ReminderSettings() {
  const [preferences, setPreferences] = useState(loadReminderPreferences)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const change = (fields: Partial<ReminderPreferences>) => {
    setPreferences(current => ({ ...current, ...fields }))
    setMessage('')
    setError('')
  }
  const save = (event: FormEvent) => {
    event.preventDefault()
    try {
      saveReminderPreferences(preferences)
      setMessage('学习提醒设置已保存。')
    } catch (e) {
      setError(`设置未保存：${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return (
    <section aria-labelledby="study-reminder-settings">
      <h2 id="study-reminder-settings">学习提醒</h2>
      <p>按这台设备的时间在首页显示。关闭应用后不会发送通知。</p>
      <form onSubmit={save}>
        <p><label><input type="checkbox" checked={preferences.enabled}
          onChange={event => change({ enabled: event.target.checked })} /> 开启学习提醒</label></p>
        <p><label>提醒时间 <input type="time" required value={preferences.time}
          onChange={event => change({ time: event.target.value })} /></label></p>
        <p><label>提醒频率 <select value={preferences.schedule}
          onChange={event => change({ schedule: event.target.value as ReminderPreferences['schedule'] })}>
          <option value="mon-sat">周一至周六</option><option value="daily">每天</option>
        </select></label></p>
        <p><label><input type="checkbox" checked={preferences.dailyStudy}
          onChange={event => change({ dailyStudy: event.target.checked })} /> 今天还没有学习记录</label></p>
        <p><label><input type="checkbox" checked={preferences.dueReviews}
          onChange={event => change({ dueReviews: event.target.checked })} /> 有到期待复习单词</label></p>
        <button type="submit">保存提醒设置</button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" className="fail">{error}</p>}
    </section>
  )
}

async function studiedToday(now: Date): Promise<boolean> {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const [stats, grammar] = await Promise.all([
    getDayStats(localDateKey(now)),
    db.grammarStudy.where('updatedAt').between(start.toISOString(), end.toISOString(), true, false).first(),
  ])
  return stats.studied || !!grammar
}

function dismissedToday(day: string): boolean {
  try { return localStorage.getItem(REMINDER_DISMISS_KEY) === day } catch { return false }
}

export function StudyReminder() {
  const [banner, setBanner] = useState<{ day: string; due: number; needsStudy: boolean }>()
  const localDismissal = useRef('')

  useEffect(() => {
    let request = 0
    let active = true
    const refresh = async () => {
      if (document.hidden) return
      const currentRequest = ++request
      const now = new Date()
      const day = localDateKey(now)
      const pref = loadReminderPreferences()
      if (!isReminderTime(pref, now) || localDismissal.current === day || dismissedToday(day)) {
        setBanner(undefined)
        return
      }
      try {
        const [due, studied] = await Promise.all([
          pref.dueReviews ? countDue(now) : 0,
          pref.dailyStudy ? studiedToday(now) : true,
        ])
        if (!active || currentRequest !== request || localDismissal.current === day || dismissedToday(day)) return
        setBanner(due > 0 || !studied ? { day, due, needsStudy: !studied } : undefined)
      } catch {
        if (active && currentRequest === request) setBanner(undefined)
      }
    }
    const check = () => void refresh()
    const onStorage = (event: StorageEvent) => {
      if (event.key === REMINDER_KEY || event.key === REMINDER_DISMISS_KEY || event.key === null) check()
    }
    check()
    const timer = window.setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('storage', onStorage)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  if (!banner) return null
  return (
    <aside className="note" aria-label="学习提醒">
      <p role="status">
        {banner.needsStudy && '今天还没有学习记录。'}
        {banner.due > 0 && `有 ${banner.due} 张单词卡到期。`}
      </p>
      <button type="button" onClick={() => go(banner.due > 0 ? '/review' : '/plan')}>
        {banner.due > 0 ? '开始复习' : '查看学习计划'}
      </button>{' '}
      <button type="button" className="secondary" onClick={() => {
        localDismissal.current = banner.day
        try { localStorage.setItem(REMINDER_DISMISS_KEY, banner.day) } catch { /* Current page still dismisses it. */ }
        setBanner(undefined)
      }}>今天不再提醒</button>
    </aside>
  )
}
