import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import {
  buildDailyExport,
  getStatsOverview,
} from '../lib/stats'
import { useStudyClock } from '../lib/study-clock'
import StudyCalendar from '../components/StudyCalendar'
import { GardenTableScroll } from '../components/GardenUI'

// TOPIK MASTER 2027 — 统计页（P3：#21 学习统计面板、#20 打卡与日历）
// 铁律：数字只从库里真实记录算；学习分钟数只取 DailyStat.minutes
// （P4 番茄钟写入后才有数），没有记录就老实显示 0，不编造。

function formatPct(accuracy: number | null): string {
  return accuracy === null ? '暂无' : `${Math.round(accuracy * 100)}%`
}

export default function Stats({ onBack }: { onBack: () => void }) {
  const { day: todayKey, zone } = useStudyClock()
  const [result, setResult] = useState<Awaited<ReturnType<typeof getStatsOverview>>>()
  const [pickedDate, setSelectedDate] = useState<string>()
  const selectedDate = pickedDate ?? todayKey
  const [exportMsg, setExportMsg] = useState('')
  const [error, setError] = useState('')
  const current = result?.today === todayKey ? result : undefined
  const selected = current?.selected === selectedDate ? current : undefined
  const week = current?.week
  const today = week?.days[6]
  const streak = current?.streak ?? 0

  useEffect(() => {
    const subscription = liveQuery(() => getStatsOverview(todayKey, selectedDate)).subscribe({
      next: data => { setResult(data); setError('') },
      error: e => setError(`统计加载失败：${e instanceof Error ? e.message : String(e)}`),
    })
    return () => subscription.unsubscribe()
  }, [todayKey, selectedDate, zone])

  const handleExport = async () => {
    setExportMsg('')
    try {
      const data = await buildDailyExport(selectedDate)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `topik-stats-${selectedDate}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportMsg(`已请求下载 ${selectedDate} 的统计与学习明细，请确认文件已保存。`)
    } catch (e) {
      setExportMsg(`导出失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <>
      <p>
        <button type="button" className="secondary garden-back" onClick={onBack}>
          ← 返回首页
        </button>
      </p>
      <h1>学习统计</h1>
      {error && <p className="fail">{error}</p>}

      <h2>今日（#21）</h2>
      {!today ? (
        <p>统计加载中…</p>
      ) : (
        <table className="garden-metrics">
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
                <strong>{today.reviewedWords}</strong> 次 · {today.distinctReviewedWords} 个不同词条
              </td>
            </tr>
            <tr>
              <th>词汇熟悉率</th>
              <td>
                <strong>{formatPct(today.accuracy)}</strong>
                {today.reviewedWords > 0 && `（认识或很熟 ${today.correctCount} / ${today.reviewedWords} 次）`}
              </td>
            </tr>
            <tr><th>客观题作答</th><td>{today.objectiveAnswers} 次 · 计分 {today.objectiveScored} 次 · 答对 {today.objectiveCorrect} 次 · 正确率 {formatPct(today.objectiveScored ? today.objectiveCorrect / today.objectiveScored : null)}</td></tr>
            <tr><th>错题</th><td>答错 {today.wrongAnswers} 次 · 纠正 {today.corrections} 次</td></tr>
            <tr><th>模考交卷</th><td>{today.mockExams} 场</td></tr>
            <tr><th>写作</th><td>保存 {today.writingAnswers} 次 · 完成 {today.writingQuestionsCompleted} 道不同题 · 自评 {today.writingAssessments} 份</td></tr>
            <tr><th>其他完成</th><td>阅读 {today.readingPassages} 篇 · 阶段测试 {today.stageTests} 次</td></tr>
            <tr>
              <th>学习分钟</th>
              <td>
                <strong>{today.minutes}</strong> 分钟
                {today.minutes === 0 && '（完成一轮番茄钟专注后记录）'}
              </td>
            </tr>
            <tr>
              <th>连续词汇打卡</th>
              <td>
                <strong>{streak}</strong> 天（周日休息不算断签）
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <h2>最近 7 天（#21）</h2>
      {!week ? (
        <p>统计加载中…</p>
      ) : (
        <>
          <p className="garden-band">
            7 天合计：新词 <strong>{week.newWords}</strong> 个 · 复习{' '}
            <strong>{week.reviewedWords}</strong> 次（{week.distinctReviewedWords} 个不同词条）· 词汇熟悉率{' '}
            <strong>{formatPct(week.accuracy)}</strong> · 学习{' '}
            <strong>{week.minutes}</strong> 分钟。
          </p>
          <GardenTableScroll label="最近 7 天学习统计"><table>
            <thead>
              <tr>
                <th>日期</th>
                <th>新词</th>
                <th>复习次数</th>
                <th>词汇熟悉率</th>
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
          </table></GardenTableScroll>
        </>
      )}

      <StudyCalendar date={selectedDate} todayDate={todayKey} cells={selected?.month} activity={selected?.activity} onSelect={date => {
        setSelectedDate(date)
        setExportMsg('')
      }} />

      <p>按本机当前时区查看有时间戳的记录。专注分钟沿用完成时保存的日期。</p>
      {selected && <details className="note">
        <summary>统计对账</summary>
        <p>已按保存记录重新计算。下列差异仅供核查，原始记录保持原样。</p>
        <ul>
          <li>所查日期中，旧复习汇总与明细不同的日期：{selected.audit.reviewSummaryDifferences.length}</li>
          <li>重复日期汇总：{selected.audit.duplicateDailyRows} 条 · 重复专注标识：{selected.audit.duplicateFocusIds} 个</li>
          <li>未归日事件：{selected.audit.undatedEvents} 条 · 排除的无效或孤立复习：{selected.audit.ignoredReviews} 条</li>
        </ul>
      </details>}
      <h2>导出（#21）</h2>
      <p className="garden-actions">
        <button type="button" onClick={() => void handleExport()}>
          导出所选日期 JSON
        </button>
        <span className="garden-meta">下载所选日期（{selectedDate}）的统计与活动明细。</span>
      </p>
      {exportMsg && <p role="status">{exportMsg}</p>}
    </>
  )
}
