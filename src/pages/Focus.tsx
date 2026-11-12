import { useEffect, useRef, useState } from 'react'
import { getDailyStat, incrementDailyStat } from '../lib/db'
import { localDateKey } from '../lib/streak'

// TOPIK MASTER 2027 — 番茄钟（P4：#18）
// 计时按时间戳差值（Date.now）算：开始时记一个结束时间点，
// 每 250ms 用“结束时间 − 现在”算剩余时间。切到后台、刷新页面再回来，
// 剩余时间按时间点补算，不会丢；计时器状态（模式、结束时间点、是否进行中）
// 存在 localStorage，刷新也不丢。
// 只有走完一整轮专注才记分钟：结束时把分钟数写入 DailyStat.minutes，
// 中途放弃、暂停不走完不记。iPhone Safari 后台行为需真机复测。

type TimerMode = 'focus' | 'short' | 'long'

const MODE_LABEL: Record<TimerMode, string> = {
  focus: '专注',
  short: '短休息',
  long: '长休息',
}

const SETTINGS_KEY = 'topik-master-focus-settings'
const TIMER_KEY = 'topik-master-focus-timer'

interface FocusSettings {
  focusMin: number
  shortMin: number
  longMin: number
}

interface TimerState {
  mode: TimerMode
  /** 本轮总时长（毫秒）。 */
  totalMs: number
  /** 进行中时的结束时间点（Date.now 毫秒）；暂停或未开始时为 null。 */
  endAt: number | null
  /** 暂停时剩下的毫秒数；未开始时为 null（= 整轮总时长）。 */
  remainingMs: number | null
  running: boolean
  sessionId?: string
}

const DEFAULT_SETTINGS: FocusSettings = { focusMin: 25, shortMin: 5, longMin: 15 }

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? Math.floor(v) : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function loadSettings(): FocusSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const p = JSON.parse(raw) as Partial<FocusSettings>
    return {
      focusMin: clampInt(p.focusMin, 25, 1, 120),
      shortMin: clampInt(p.shortMin, 5, 1, 60),
      longMin: clampInt(p.longMin, 15, 1, 60),
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function loadTimer(settings: FocusSettings): TimerState {
  const totalMs = settings.focusMin * 60000
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    if (!raw) return { mode: 'focus', totalMs, endAt: null, remainingMs: null, running: false }
    const p = JSON.parse(raw) as Partial<TimerState>
    const mode: TimerMode =
      p.mode === 'short' || p.mode === 'long' ? p.mode : 'focus'
    const total =
      typeof p.totalMs === 'number' && p.totalMs > 0 ? p.totalMs : totalMs
    return {
      mode,
      totalMs: total,
      endAt: typeof p.endAt === 'number' ? p.endAt : null,
      remainingMs: typeof p.remainingMs === 'number' ? p.remainingMs : null,
      running: p.running === true,
      sessionId: typeof p.sessionId === 'string' && /^[a-z0-9-]{1,100}$/.test(p.sessionId) ? p.sessionId : undefined,
    }
  } catch {
    return { mode: 'focus', totalMs, endAt: null, remainingMs: null, running: false }
  }
}

function saveTimer(t: TimerState) {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(t))
  } catch {
    // 存不进不阻塞计时显示
  }
}

export default function Focus({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<FocusSettings>(() => loadSettings())
  const [timer, setTimer] = useState<TimerState>(() => loadTimer(loadSettings()))
  const [now, setNow] = useState(() => Date.now())
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [completionRetry, setCompletionRetry] = useState(0)
  const completingRef = useRef(false)

  // 每 250ms 刷新一次“现在”，剩余时间用时间戳差值算。
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const refreshTodayMinutes = async () => {
    try {
      const stat = await getDailyStat(localDateKey(new Date()))
      setTodayMinutes(stat?.minutes ?? 0)
    } catch (e) {
      setError(`今日分钟加载失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  useEffect(() => {
    void refreshTodayMinutes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remainingMs =
    timer.running && timer.endAt !== null
      ? timer.endAt - now
      : timer.remainingMs ?? timer.totalMs
  const remaining = Math.max(0, remainingMs)
  const totalMin = Math.round(timer.totalMs / 60000)

  // 计时走完：只有专注轮才记分钟；休息轮只切换回专注。
  useEffect(() => {
    if (!timer.running || remaining > 0 || completingRef.current) return
    completingRef.current = true
    const finishedMode = timer.mode
    const finishedMinutes = Math.round(timer.totalMs / 60000)
    const finishedAt = timer.endAt ?? Date.now()
    void (async () => {
      try {
        if (finishedMode === 'focus') {
          const key = localDateKey(new Date(finishedAt))
          const stat = await incrementDailyStat(key, {
            minutes: finishedMinutes,
            focusSessionId: timer.sessionId ?? `legacy-${finishedAt}-${timer.totalMs}`,
          })
          const sameDay = stat.date === localDateKey(new Date())
          if (sameDay) setTodayMinutes(stat.minutes)
          const next: TimerState = {
            mode: 'short',
            totalMs: settings.shortMin * 60000,
            endAt: null,
            remainingMs: null,
            running: false,
          }
          setTimer(next)
          saveTimer(next)
          setMsg(
            `专注完成，已记录 ${finishedMinutes} 分钟。${sameDay ? `今天共 ${stat.minutes} 分钟。` : `已计入 ${stat.date}。`}`,
          )
        } else {
          const next: TimerState = {
            mode: 'focus',
            totalMs: settings.focusMin * 60000,
            endAt: null,
            remainingMs: null,
            running: false,
          }
          setTimer(next)
          saveTimer(next)
          setMsg('休息结束，回到专注。')
        }
      } catch (e) {
        setError(`计时结束处理失败：${e instanceof Error ? e.message : String(e)}`)
      } finally {
        completingRef.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.running, remaining, completionRetry])

  const persistTimer = (next: TimerState) => {
    setTimer(next)
    saveTimer(next)
  }

  const handleStart = () => {
    const rest = timer.remainingMs ?? timer.totalMs
    const next: TimerState = {
      ...timer, endAt: Date.now() + rest, remainingMs: null, running: true,
      sessionId: timer.sessionId ?? crypto.randomUUID(),
    }
    persistTimer(next)
    setMsg('')
  }

  const handlePause = () => {
    if (timer.endAt === null) return
    const next: TimerState = {
      ...timer,
      endAt: null,
      remainingMs: Math.max(0, timer.endAt - Date.now()),
      running: false,
    }
    persistTimer(next)
    setMsg('已暂停，剩余时间已记住，点“继续”接着走。')
  }

  const handleReset = () => {
    const next: TimerState = {
      ...timer,
      endAt: null,
      remainingMs: null,
      running: false,
      sessionId: undefined,
    }
    persistTimer(next)
    setMsg('')
  }

  const switchMode = (mode: TimerMode) => {
    const total =
      mode === 'focus'
        ? settings.focusMin * 60000
        : mode === 'short'
          ? settings.shortMin * 60000
          : settings.longMin * 60000
    const next: TimerState = { mode, totalMs: total, endAt: null, remainingMs: null, running: false }
    persistTimer(next)
    setMsg('')
  }

  const updateSettings = (patch: Partial<FocusSettings>) => {
    const next = { ...settings, ...patch }
    // 校验后写回（输入框本身也限了 min/max，这里再兜底一次）
    next.focusMin = clampInt(next.focusMin, 25, 1, 120)
    next.shortMin = clampInt(next.shortMin, 5, 1, 60)
    next.longMin = clampInt(next.longMin, 15, 1, 60)
    setSettings(next)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    } catch {
      // 存不进不阻塞显示
    }
    // 没在计时时，当前轮的总时长跟着新设置走
    if (!timer.running) {
      const total =
        timer.mode === 'focus'
          ? next.focusMin * 60000
          : timer.mode === 'short'
            ? next.shortMin * 60000
            : next.longMin * 60000
      const t: TimerState = { ...timer, totalMs: total, remainingMs: null }
      persistTimer(t)
    }
  }

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const clock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  const elapsedPct =
    timer.totalMs > 0 ? Math.min(100, Math.round(((timer.totalMs - remaining) / timer.totalMs) * 100)) : 0

  return (
    <>
      <p>
        <button type="button" className="secondary garden-back" onClick={onBack}>
          ← 返回首页
        </button>
      </p>
      <h1>番茄钟</h1>
      {error && timer.running && remaining === 0 && (
        <button type="button" onClick={() => {
          setError('')
          setCompletionRetry(value => value + 1)
        }}>重试保存专注时长</button>
      )}
      {error && <p className="fail">{error}</p>}

      <section className="garden-timer" aria-labelledby="garden-focus-mode">
        <h2 id="garden-focus-mode">
          {MODE_LABEL[timer.mode]}（#18）
        </h2>
        <p className="garden-actions">
          <button
            type="button"
            className={timer.mode === 'focus' ? undefined : 'secondary'}
            aria-pressed={timer.mode === 'focus'}
            onClick={() => switchMode('focus')}
          >
            专注
          </button>{' '}
          <button
            type="button"
            className={timer.mode === 'short' ? undefined : 'secondary'}
            aria-pressed={timer.mode === 'short'}
            onClick={() => switchMode('short')}
          >
            短休息
          </button>{' '}
          <button
            type="button"
            className={timer.mode === 'long' ? undefined : 'secondary'}
            aria-pressed={timer.mode === 'long'}
            onClick={() => switchMode('long')}
          >
            长休息
          </button>
        </p>
        <p className="garden-timer-value">{clock}</p>
        <p>
          {timer.running
            ? `${MODE_LABEL[timer.mode]}进行中，剩 ${clock}（已走 ${elapsedPct}%）。`
            : remaining < timer.totalMs
              ? `${MODE_LABEL[timer.mode]}已暂停，剩 ${clock}。`
              : `本轮${MODE_LABEL[timer.mode]} ${totalMin} 分钟，还没开始。`}
        </p>
        <p className="garden-actions">
          {timer.running ? (
            <button type="button" onClick={handlePause}>
              暂停
            </button>
          ) : (
            <button type="button" onClick={handleStart}>
              {remaining < timer.totalMs ? '继续' : '开始'}
            </button>
          )}{' '}
          <button type="button" className="secondary" onClick={handleReset}>
            重置本轮
          </button>
        </p>
        {msg && <p>{msg}</p>}
        <p>
          今天已专注 <strong>{todayMinutes}</strong> 分钟（只记走完的专注轮，中途放弃不记）。
        </p>
      </section>
      <div className="note">
        计时按结束时间点算：切到后台、刷新页面再回来，剩余时间按时间点补算，不会丢。
        如果一轮在后台走完，回来后会自动记入今日分钟。iPhone Safari 后台行为需真机复测。
      </div>

      <h2>时长设置</h2>
      <table className="garden-metrics garden-timer-settings">
        <tbody>
          <tr>
            <th>专注</th>
            <td>
              <input
                type="number"
                min={1}
                max={120}
                value={settings.focusMin}
                onChange={(e) => updateSettings({ focusMin: Number(e.target.value) })}
                aria-label="专注时长（分钟）"
              />{' '}
              分钟（默认 25，可调 1–120）
            </td>
          </tr>
          <tr>
            <th>短休息</th>
            <td>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.shortMin}
                onChange={(e) => updateSettings({ shortMin: Number(e.target.value) })}
                aria-label="短休息时长（分钟）"
              />{' '}
              分钟（默认 5，可调 1–60）
            </td>
          </tr>
          <tr>
            <th>长休息</th>
            <td>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.longMin}
                onChange={(e) => updateSettings({ longMin: Number(e.target.value) })}
                aria-label="长休息时长（分钟）"
              />{' '}
              分钟（默认 15，可调 1–60）
            </td>
          </tr>
        </tbody>
      </table>
      <p>时长改完自动保存（只存本机浏览器）；没在计时时，当前轮的总时长跟着新设置走。</p>
    </>
  )
}
