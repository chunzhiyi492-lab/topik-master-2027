import { useEffect, useState } from 'react'
import {
  buildDailyExport,
  getDayStats,
  getMonthCells,
  getWeekStats,
  type DayStats,
  type MonthCell,
  type WeekStats,
} from '../lib/stats'
import { localDateKey } from '../lib/streak'

// TOPIK MASTER 2027 — 统计页（P3：#21 学习统计面板、#20 打卡与日历）
// 功能页先用朴素结构实现，主题样式等薯饼拍板后再接入。
// 铁律：数字只从库里真实记录算；学习分钟数只取 DailyStat.minutes
// （P4 番茄钟写入后才有数），没有记录就老实显示 0，不编造。

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatPct(accuracy: number | null): string {
  return accuracy === null ? '暂无' : `${Math.round(accuracy * 100)}%`
}

export default function Stats({ onBack }: { onBack: () => void }) {
  const todayKey = localDateKey(new Date())
  const [today, setToday] = useState<DayStats | null>(null)
  const [week, setWeek] = useState<WeekStats | null>(null)
  const [streak, setStreak] = useState(0)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [cells, setCells] = useState<MonthCell[]>([])
  const [firstWeekday, setFirstWeekday] = useState(0)
  const [exportMsg, setExportMsg] = useState('')
  const [error, setError] = useState('')

  const refreshStats = async () => {
    try {
      const [d, w, exp] = await Promise.all([
        getDayStats(todayKey),
        getWeekStats(todayKey),
        buildDailyExport(todayKey),
      ])
      setToday(d)
      setWeek(w)
      setStreak(exp.streak)
    } catch (e) {
      setError(`统计加载失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const refreshCalendar = async (y: number, m: number) => {
    setCells(await getMonthCells(y, m))
    setFirstWeekday(new Date(y, m - 1, 1).getDay())
  }

  useEffect(() => {
    void refreshStats()
    void refreshCalendar(year, month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeMonth = (delta: number) => {
    let y = year
    let m = month + delta
    if (m < 1) {
      y -= 1
      m = 12
    } else if (m > 12) {
      y += 1
      m = 1
    }
    setYear(y)
    setMonth(m)
    void refreshCalendar(y, m)
  }

  const handleExport = async () => {
    setExportMsg('')
    try {
      const data = await buildDailyExport(todayKey)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `topik-stats-${todayKey}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportMsg(`已导出当日 JSON（${todayKey}）：新词 ${data.day.newWords} 个、复习 ${data.day.reviewedWords} 张、正确率 ${formatPct(data.day.accuracy)}、分钟 ${data.day.minutes}、连续 ${data.streak} 天。`)
    } catch (e) {
      setExportMsg(`导出失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const blanks: null[] = Array.from({ length: firstWeekday }, () => null)

  return (
    <>
      <p>
        <button type="button" className="secondary" onClick={onBack}>
          ← 返回首页
        </button>
      </p>
      <h1>学习统计</h1>
      {error && <p className="fail">{error}</p>}

      <h2>今日（#21）</h2>
      {today === null ? (
        <p>统计加载中…</p>
      ) : (
        <table>
          <tbody>
            <tr>
              <th>新词</th>
              <td>
                <strong>{today.newWords}</strong> 个（今天第一次打分的词）
              </td>
            </tr>
            <tr>
              <th>复习</th>
              <td>
                <strong>{today.reviewedWords}</strong> 张
              </td>
            </tr>
            <tr>
              <th>正确率</th>
              <td>
                <strong>{formatPct(today.accuracy)}</strong>
                {today.reviewedWords > 0 && `（答对 ${today.correctCount} / ${today.reviewedWords}）`}
              </td>
            </tr>
            <tr>
              <th>学习分钟</th>
              <td>
                <strong>{today.minutes}</strong> 分钟
                {today.minutes === 0 && '（番茄钟尚未开发，P4 接入后才有数）'}
              </td>
            </tr>
            <tr>
              <th>连续学习</th>
              <td>
                <strong>{streak}</strong> 天（周日休息不算断签）
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <h2>最近 7 天（#21）</h2>
      {week === null ? (
        <p>统计加载中…</p>
      ) : (
        <>
          <p>
            7 天合计：新词 <strong>{week.newWords}</strong> 个 · 复习{' '}
            <strong>{week.reviewedWords}</strong> 张 · 正确率{' '}
            <strong>{formatPct(week.accuracy)}</strong> · 学习{' '}
            <strong>{week.minutes}</strong> 分钟。
          </p>
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>新词</th>
                <th>复习</th>
                <th>正确率</th>
                <th>分钟</th>
              </tr>
            </thead>
            <tbody>
              {week.days.map((d) => (
                <tr key={d.date}>
                  <td>
                    {d.date}
                    {d.date === todayKey ? '（今天）' : ''}
                  </td>
                  <td>{d.newWords}</td>
                  <td>{d.reviewedWords}</td>
                  <td>{formatPct(d.accuracy)}</td>
                  <td>{d.minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>打卡日历（#20）</h2>
      <p>
        <button type="button" className="secondary" onClick={() => changeMonth(-1)}>
          ← 上个月
        </button>{' '}
        <strong>
          {year} 年 {month} 月
        </strong>{' '}
        <button type="button" className="secondary" onClick={() => changeMonth(1)}>
          下个月 →
        </button>
      </p>
      <p>● 已学（当天有复习记录）；周日显示“休息”，不记缺勤、不算断签。</p>
      <table>
        <thead>
          <tr>
            {WEEKDAYS.map((w) => (
              <th key={w}>{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(() => {
            const all: (MonthCell | null)[] = [...blanks, ...cells]
            const rows: (MonthCell | null)[][] = []
            for (let i = 0; i < all.length; i += 7) rows.push(all.slice(i, i + 7))
            return rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((c, ci) =>
                  c === null ? (
                    <td key={ci}></td>
                  ) : (
                    <td
                      key={c.date}
                      style={
                        c.isToday
                          ? { outline: '2px solid #c06a7a', outlineOffset: -2 }
                          : undefined
                      }
                    >
                      <strong>{c.day}</strong>
                      {c.isSunday && <div>休息</div>}
                      {c.studied && <div>● 已学</div>}
                      {c.isToday && <div>今天</div>}
                    </td>
                  ),
                )}
              </tr>
            ))
          })()}
        </tbody>
      </table>

      <h2>导出（#21）</h2>
      <p>
        <button type="button" onClick={() => void handleExport()}>
          导出当日 JSON
        </button>{' '}
        下载当日统计（新词 / 复习 / 正确率 / 分钟数 / 连续天数）。
      </p>
      {exportMsg && <p>{exportMsg}</p>}
    </>
  )
}
