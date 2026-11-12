import { useEffect, useId, useState, type ReactNode } from 'react'
import { liveQuery } from 'dexie'
import { countDue } from '../lib/review'
import { getDayStats, type DayStats } from '../lib/stats'
import { useStudyClock } from '../lib/study-clock'
import { DAILY_TARGET_KEY, loadDailyTarget } from '../lib/study-goals'
import { GardenNotice, GardenProgress } from './GardenUI'
import { IconChevron, IconClock, IconReading, IconRepeat } from './icons'

function metric(value: number | undefined, unit: string) {
  return value === undefined ? '—' : <>{value}<small>{unit}</small></>
}

export function DailyStudySummary({ heading = '今日学习', children }: { heading?: string; children?: ReactNode }) {
  const { day: today, zone, tick } = useStudyClock()
  const headingId = useId()
  const [snapshot, setSnapshot] = useState<{ day: DayStats; zone: string }>()
  const [due, setDue] = useState<number>()
  const [statsError, setStatsError] = useState(false)
  const [dueError, setDueError] = useState(false)
  const [dailyTarget, setDailyTarget] = useState(loadDailyTarget)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const subscription = liveQuery(() => getDayStats(today)).subscribe({
      next: day => { setSnapshot({ day, zone }); setStatsError(false) },
      error: () => { setSnapshot(undefined); setStatsError(true) },
    })
    return () => subscription.unsubscribe()
  }, [today, zone, attempt])

  useEffect(() => {
    const subscription = liveQuery(() => countDue()).subscribe({
      next: count => { setDue(count); setDueError(false) },
      error: () => { setDue(undefined); setDueError(true) },
    })
    return () => subscription.unsubscribe()
  }, [tick, attempt])

  useEffect(() => {
    const updateTarget = (event: StorageEvent) => {
      if (event.key === DAILY_TARGET_KEY || event.key === null) setDailyTarget(loadDailyTarget())
    }
    window.addEventListener('storage', updateTarget)
    return () => window.removeEventListener('storage', updateTarget)
  }, [])

  const day = snapshot?.day.date === today && snapshot.zone === zone ? snapshot.day : undefined
  const achieved = day ? Math.min(day.newWords, dailyTarget) : undefined
  const loading = (!day && !statsError) || (due === undefined && !dueError)

  return (
    <section className="silver-today daily-study-summary" aria-labelledby={headingId}>
      <div className="silver-today-heading">
        <h2 id={headingId}>{heading}</h2>
        <time dateTime={today}>{today.replaceAll('-', ' · ')}</time>
      </div>

      <dl className="silver-metrics">
        <div><dt><IconReading size={17} />今日新词</dt><dd>{metric(day?.newWords, '个')}</dd></div>
        <div><dt><IconRepeat size={17} />到期复习</dt><dd>{metric(due, '张')}</dd></div>
        <div><dt><IconClock size={17} />专注时长</dt><dd>{metric(day?.minutes, '分钟')}</dd></div>
      </dl>

      <GardenProgress label="今日新词目标" max={dailyTarget} value={achieved}>
        {achieved === undefined ? '—' : Math.floor(100 * achieved / dailyTarget) + '%'}
      </GardenProgress>
      {loading && <GardenNotice tone="status">正在读取今日学习记录…</GardenNotice>}
      {(statsError || dueError) && <GardenNotice tone="error">
        <span>部分学习数据无法读取。</span>{' '}
        <button className="personal-secondary" type="button" onClick={() => {
          setStatsError(false)
          setDueError(false)
          setAttempt(previous => previous + 1)
        }}>重试</button>
      </GardenNotice>}

      <div className="silver-actions">
        <a href="#/vocab" className="silver-action silver-action-primary">
          <IconReading size={32} />
          <span>开始背单词</span>
          <IconChevron className="silver-action-arrow" size={17} />
        </a>
        <a href="#/review" className="silver-action">
          <IconRepeat size={32} />
          <span>开始 FSRS 复习</span>
          <IconChevron className="silver-action-arrow" size={17} />
        </a>
      </div>
      {children}
    </section>
  )
}
