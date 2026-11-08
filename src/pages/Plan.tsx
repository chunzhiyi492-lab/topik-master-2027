import { useEffect, useState } from 'react'
import { countVocab, getAllReviews } from '../lib/db'
import { getDayStats } from '../lib/stats'
import { getStudyStreak } from '../lib/review'
import { localDateKey } from '../lib/streak'

// TOPIK MASTER 2027 — 每日学习计划 + TOPIK 目标进度（P4：#19、#22）
// 默认课表就是她确认的真实课表（2026-10-26 起执行）：韩语 4 小时 +
// 专业课重修 2 小时 + 英语 1 小时，周一到周六，周日休息。
// 每节课的时间、科目、内容都可改，改完保存进 localStorage（不升 Dexie 版本）。
// 目标进度只引用库里真实统计，不编造口径（见 ACCEPTANCE.md P4 一节）。

type Subject = '韩语' | '专业课' | '英语'

interface PlanSession {
  id: string
  subject: Subject
  /** 开始时间 HH:MM */
  start: string
  /** 结束时间 HH:MM */
  end: string
  /** 内容，如“发音与拼读” */
  label: string
}

/** 周计划：键为星期几（'1'..'6'，周一到周六）；周日（'0'）不排课，固定休息。 */
type WeekPlan = Record<string, PlanSession[]>

const PLAN_KEY = 'topik-master-plan'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const KOREAN: PlanSession[] = [
  { id: 'ko-1', subject: '韩语', start: '09:00', end: '09:30', label: '发音与拼读' },
  { id: 'ko-2', subject: '韩语', start: '09:30', end: '11:00', label: '延世教材' },
  { id: 'ko-3', subject: '韩语', start: '14:00', end: '14:45', label: '听力与跟读' },
  { id: 'ko-4', subject: '韩语', start: '14:45', end: '15:30', label: '阅读与词汇' },
  { id: 'ko-5', subject: '韩语', start: '15:30', end: '16:00', label: 'TOPIK 专项与复盘' },
]

const ENGLISH: PlanSession[] = [
  { id: 'en-1', subject: '英语', start: '20:00', end: '21:00', label: '英语学习' },
]

/** 专业课 17:30–19:30 按周分科（键为星期几）。 */
function majorSessions(weekday: number): PlanSession[] {
  const s = (id: string, start: string, end: string, label: string): PlanSession => ({
    id,
    subject: '专业课',
    start,
    end,
    label,
  })
  switch (weekday) {
    case 1:
      return [s('mj-1', '17:30', '19:30', '计算机组成原理')]
    case 2:
      return [s('mj-2', '17:30', '19:30', '高等数学 1')]
    case 3:
      return [s('mj-3', '17:30', '19:30', '计算机组成原理')]
    case 4:
      return [s('mj-4', '17:30', '19:30', '离散数学')]
    case 5:
      return [
        s('mj-5a', '17:30', '18:30', '计算机组成原理'),
        s('mj-5b', '18:30', '19:30', '高等数学 1'),
      ]
    case 6:
      return [
        s('mj-6a', '17:30', '18:30', '离散数学'),
        s('mj-6b', '18:30', '19:30', '本周最弱科目'),
      ]
    default:
      return []
  }
}

function defaultPlan(): WeekPlan {
  const plan: WeekPlan = {}
  for (let w = 1; w <= 6; w++) {
    plan[String(w)] = [...KOREAN, ...majorSessions(w), ...ENGLISH].map((s) => ({ ...s }))
  }
  return plan
}

function isValidSession(x: unknown): x is PlanSession {
  if (typeof x !== 'object' || x === null) return false
  const s = x as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    (s.subject === '韩语' || s.subject === '专业课' || s.subject === '英语') &&
    typeof s.start === 'string' &&
    typeof s.end === 'string' &&
    typeof s.label === 'string'
  )
}

function loadPlan(): WeekPlan {
  try {
    const raw = localStorage.getItem(PLAN_KEY)
    if (!raw) return defaultPlan()
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const plan = defaultPlan()
    for (let w = 1; w <= 6; w++) {
      const arr = parsed[String(w)]
      if (Array.isArray(arr) && arr.every(isValidSession)) {
        plan[String(w)] = arr.map((s) => ({ ...s }))
      }
    }
    return plan
  } catch {
    return defaultPlan()
  }
}

/** "HH:MM" → 当天分钟数；格式不对返回 -1。 */
function toMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return -1
  return Number(m[1]) * 60 + Number(m[2])
}

function formatDaysLeft(target: Date, today: Date): number {
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.ceil((t - d) / 86400000)
}

export default function Plan({ onBack }: { onBack: () => void }) {
  const today = new Date()
  const todayWeekday = today.getDay()
  const [weekday, setWeekday] = useState(todayWeekday)
  const [plan, setPlan] = useState<WeekPlan>(() => loadPlan())
  const [saveMsg, setSaveMsg] = useState('')
  const [error, setError] = useState('')

  // #22 目标进度（真实统计）
  const [totalVocab, setTotalVocab] = useState(0)
  const [learnedCount, setLearnedCount] = useState(0)
  const [reviewedTotal, setReviewedTotal] = useState(0)
  const [streak, setStreak] = useState(0)
  const [todayNew, setTodayNew] = useState(0)
  const [todayReviewed, setTodayReviewed] = useState(0)

  useEffect(() => {
    void (async () => {
      try {
        const [total, reviews, day, s] = await Promise.all([
          countVocab(),
          getAllReviews(),
          getDayStats(localDateKey(today)),
          getStudyStreak(),
        ])
        setTotalVocab(total)
        setLearnedCount(new Set(reviews.map((r) => r.vocabId)).size)
        setReviewedTotal(reviews.length)
        setStreak(s)
        setTodayNew(day.newWords)
        setTodayReviewed(day.reviewedWords)
      } catch (e) {
        setError(`目标进度加载失败：${e instanceof Error ? e.message : String(e)}`)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isSunday = weekday === 0
  const sessions = isSunday ? [] : plan[String(weekday)] ?? []
  const isToday = weekday === todayWeekday
  const nowMinutes = today.getHours() * 60 + today.getMinutes()

  const updateSession = (id: string, patch: Partial<PlanSession>) => {
    setPlan((prev) => ({
      ...prev,
      [String(weekday)]: prev[String(weekday)].map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    }))
    setSaveMsg('')
  }

  const addSession = () => {
    const id = `s-${Date.now()}`
    setPlan((prev) => ({
      ...prev,
      [String(weekday)]: [
        ...prev[String(weekday)],
        { id, subject: '韩语', start: '09:00', end: '09:30', label: '新课程' },
      ],
    }))
    setSaveMsg('')
  }

  const removeSession = (id: string) => {
    setPlan((prev) => ({
      ...prev,
      [String(weekday)]: prev[String(weekday)].filter((s) => s.id !== id),
    }))
    setSaveMsg('')
  }

  const handleSave = () => {
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(plan))
      setSaveMsg(`已保存${WEEKDAYS[weekday]}的课表，刷新后还在。`)
    } catch (e) {
      setSaveMsg(`保存失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleReset = () => {
    const fresh = defaultPlan()
    setPlan(fresh)
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(fresh))
      setSaveMsg('已恢复默认课表。')
    } catch (e) {
      setSaveMsg(`恢复失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // #22：距 2027 年 4 月考试的天数，按 4 月 1 日估算（确切日期以 NIIED 官方公布为准，不编造）。
  const examDate = new Date(2027, 3, 1)
  const daysLeft = formatDaysLeft(examDate, today)
  const coverage = totalVocab > 0 ? Math.round((learnedCount / totalVocab) * 100) : 0

  return (
    <>
      <p>
        <button type="button" className="secondary" onClick={onBack}>
          ← 返回首页
        </button>
      </p>
      <h1>每日学习计划</h1>
      {error && <p className="fail">{error}</p>}

      <h2>今日课表（#19）</h2>
      <p>
        {WEEKDAYS.map((w, i) => (
          <span key={w}>
            <button
              type="button"
              className={weekday === i ? undefined : 'secondary'}
              onClick={() => {
                setWeekday(i)
                setSaveMsg('')
              }}
            >
              {w}
              {i === todayWeekday ? '（今天）' : ''}
            </button>{' '}
          </span>
        ))}
      </p>

      {isSunday ? (
        <div className="note">
          <strong>周日休息，没有正式课程。</strong>
          韩语、专业课、英语今天都不排课；轻量复习仅为可选项，不记缺勤、不算断签。
        </div>
      ) : (
        <>
          <p>
            {WEEKDAYS[weekday]}的课表：每节课的时间、科目、内容都能改，改完点“保存课表”
            （只存本机浏览器）。每天 7 小时：韩语 4 小时 + 专业课 2 小时 + 英语 1 小时。
          </p>
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>科目</th>
                <th>内容</th>
                <th>状态</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const start = toMinutes(s.start)
                const end = toMinutes(s.end)
                const inProgress =
                  isToday && start >= 0 && end > start && nowMinutes >= start && nowMinutes < end
                return (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="time"
                        value={s.start}
                        onChange={(e) => updateSession(s.id, { start: e.target.value })}
                        aria-label="开始时间"
                      />
                      {' – '}
                      <input
                        type="time"
                        value={s.end}
                        onChange={(e) => updateSession(s.id, { end: e.target.value })}
                        aria-label="结束时间"
                      />
                    </td>
                    <td>
                      <select
                        value={s.subject}
                        onChange={(e) =>
                          updateSession(s.id, { subject: e.target.value as Subject })
                        }
                        aria-label="科目"
                      >
                        <option value="韩语">韩语</option>
                        <option value="专业课">专业课</option>
                        <option value="英语">英语</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => updateSession(s.id, { label: e.target.value })}
                        aria-label="内容"
                      />
                    </td>
                    <td>{inProgress ? '进行中' : ''}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => removeSession(s.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p>
            <button type="button" onClick={addSession}>
              加一节课
            </button>{' '}
            <button type="button" onClick={handleSave}>
              保存课表
            </button>{' '}
            <button type="button" className="secondary" onClick={handleReset}>
              恢复默认课表
            </button>
          </p>
          {saveMsg && <p>{saveMsg}</p>}
        </>
      )}

      <h2>TOPIK 目标进度（#22）</h2>
      <table>
        <tbody>
          <tr>
            <th>考试</th>
            <td>2027 年 4 月 TOPIK II</td>
          </tr>
          <tr>
            <th>目标等级</th>
            <td>
              <strong>保 4 冲 5</strong>
            </td>
          </tr>
          <tr>
            <th>距考试</th>
            <td>
              <strong>{daysLeft}</strong> 天（按 2027 年 4 月 1 日估算，具体日期以官方公布为准）
            </td>
          </tr>
          <tr>
            <th>词汇覆盖</th>
            <td>
              已学 <strong>{learnedCount}</strong> / 库内 {totalVocab} 个词（{coverage}
              %）。已学 = 累计第一次打过分的词数，来自复习记录，不是编的。
            </td>
          </tr>
          <tr>
            <th>累计复习</th>
            <td>
              <strong>{reviewedTotal}</strong> 张（复习记录总条数）
            </td>
          </tr>
          <tr>
            <th>连续学习</th>
            <td>
              <strong>{streak}</strong> 天（周日休息不算断签）
            </td>
          </tr>
          <tr>
            <th>今日</th>
            <td>
              新词 {todayNew} 个 · 复习 {todayReviewed} 张
            </td>
          </tr>
        </tbody>
      </table>
      <p className="note">
        进度口径：词汇覆盖 = 累计第一次打分的词数 ÷ 库内词总数；累计复习 = 复习记录总条数；
        连续天数按“周日不算断签”算。以上全部来自本机真实学习记录。
      </p>
    </>
  )
}
