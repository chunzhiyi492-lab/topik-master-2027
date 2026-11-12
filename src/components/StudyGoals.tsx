import { liveQuery } from 'dexie'
import { useEffect, useState, type FormEvent } from 'react'
import { getStudyGoalActivity } from '../lib/stats'
import { DAILY_TARGET_KEY, loadDailyTarget, loadWeeklyTargets, saveWeeklyTargets, WEEKLY_METRICS, type WeeklyTargets } from '../lib/study-goals'

export default function StudyGoals() {
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof getStudyGoalActivity>>>()
  const [dailyTarget, setDailyTarget] = useState(loadDailyTarget)
  const [targets, setTargets] = useState(loadWeeklyTargets)
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [readError, setReadError] = useState('')
  const configured = WEEKLY_METRICS.filter(({ key }) => targets[key] > 0)
  const achieved = activity ? configured.filter(({ key }) => activity.totals[key] >= targets[key]).length : 0

  useEffect(() => {
    const subscription = liveQuery(() => getStudyGoalActivity()).subscribe({
      next: setActivity,
      error: () => setReadError('无法读取目标进度，请重新打开学习计划。'),
    })
    const onStorage = (event: StorageEvent) => {
      if (event.key === DAILY_TARGET_KEY || event.key === null) setDailyTarget(loadDailyTarget())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setSaveError('')
    const form = new FormData(event.currentTarget)
    const next = {} as WeeklyTargets
    for (const { key } of WEEKLY_METRICS) next[key] = Number(form.get(key) ?? 0)
    try {
      saveWeeklyTargets(next)
      setTargets(next)
      setMessage('每周目标已保存。')
    } catch (e) {
      setSaveError(`目标未保存：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <section className="garden-study-goals" aria-labelledby="study-goals">
      <h2 id="study-goals">学习目标与本周计划</h2>
      {readError && <p className="fail" role="alert">{readError}</p>}
      {!activity && !readError && <p role="status">正在读取学习进度……</p>}
      {activity && (
        <>
          <h3>今日新词</h3>
          <p>今日新词完成 {activity.today.newWords} / {dailyTarget} 个。
            {activity.today.newWords >= dailyTarget ? '今日目标已完成。' : <a href="#/vocab">继续背词</a>}
            {' '}<a href="#/vocab">调整每日目标</a>
          </p>
          <progress aria-label="今日新词目标进度" max={dailyTarget} value={Math.min(dailyTarget, activity.today.newWords)} />
          <h3>本周进度</h3>
          <p><time>{activity.startDate}</time> 至 <time>{activity.endDate}</time>，按本机周一至周日统计。</p>
          {configured.length > 0 && <p>本周达成 {achieved} / {configured.length} 项目标。</p>}
          <p>新词按首次评分计，复习按评分次数计，客观题按作答次数计。</p>
          <ul>{WEEKLY_METRICS.map(({ key, label, unit, href, action }) => {
            const actual = activity.totals[key]
            const target = targets[key]
            return (
              <li key={key}>
                {label}：{actual}{target ? ` / ${target}` : ''} {unit}
                {target ? actual >= target ? ' · 已达成' : ` · 还差 ${target - actual} ${unit}` : ' · 未设目标'}
                {target > 0 && `（${Math.round(actual / target * 100)}%）`}
                {' · '}<a href={href}>{action}</a>
              </li>
            )
          })}</ul>
          <details>
            <summary>查看本周每日记录</summary>
            <ul>{activity.days.map(day => <li key={day.date}>
              <time>{day.date}</time> · 新词 {day.newWords} · 复习 {day.reviewedWords} · 客观题 {day.practice} · 专注 {day.minutes} 分钟
            </li>)}</ul>
          </details>
        </>
      )}
      <details>
        <summary>设置每周目标</summary>
        <p>填 0 表示不设该项。目标设置只保存在这台设备。</p>
        <form onSubmit={save}>
          {WEEKLY_METRICS.map(({ key, label, max, unit }) => (
            <p key={key}><label>每周{label}目标{' '}
              <input name={key} type="number" min={0} max={max} step={1} defaultValue={targets[key]} /> {unit}
            </label></p>
          ))}
          <button type="submit">保存每周目标</button>
        </form>
        {message && <p role="status">{message}</p>}
        {saveError && <p role="alert" className="fail">{saveError}</p>}
      </details>
    </section>
  )
}
