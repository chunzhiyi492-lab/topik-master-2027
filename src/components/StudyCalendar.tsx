import { useState } from 'react'
import { type DayActivity, type MonthCell } from '../lib/stats'
import { localDateKey } from '../lib/streak'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const LABELS = { review: '词汇复习', objective: '客观题', writing: '写作', assessment: '写作自评', stage: '阶段测试', reading: '阅读篇章', mock: '模考' } as const
const PAGE_SIZE = 30

function DayActivityPanel({ date, activity }: { date: string; activity?: DayActivity }) {
  const [visible, setVisible] = useState(PAGE_SIZE)

  return (
    <section className="garden-day-activity" aria-labelledby="daily-activity">
      <h3 id="daily-activity"><time dateTime={date}>{date}</time> 学习明细</h3>
      {!activity ? <p role="status">正在读取当天的记录……</p>
          : !activity.summary.studied
            ? <p>这一天没有已保存的学习记录。</p>
            : (
              <>
                <ul>
                  <li>新词 {activity.summary.newWords} 个 · 复习 {activity.summary.reviewedWords} 次 · {activity.summary.distinctReviewedWords} 个不同词条</li>
                  <li>客观题作答 {activity.objectiveAnswers} 次 · 答对 {activity.objectiveCorrect} 次</li>
                  <li>客观题计分 {activity.summary.objectiveScored} 次 · 正确率 {activity.summary.objectiveScored ? Math.round(100 * activity.objectiveCorrect / activity.summary.objectiveScored) + '%' : '暂无'}</li>
                  <li>答错 {activity.summary.wrongAnswers} 次 · 纠正 {activity.summary.corrections} 次 · 模考交卷 {activity.summary.mockExams} 场</li>
                  <li>阅读篇章完成 {activity.readingPassages} 篇</li>
                  <li>写作保存 {activity.writingAnswers} 次 · 完成 {activity.writingQuestionsCompleted} 道不同写作题 · 自评 {activity.summary.writingAssessments} 份 · 阶段测试 {activity.stageTests} 次</li>
                  <li>专注 {activity.summary.minutes} 分钟</li>
                </ul>
                {activity.events.length > 0 && (
                  <ol className="study-activity-list">
                    {activity.events.slice(0, visible).map(event => (
                      <li key={event.id}>
                        <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                        {' · '}{LABELS[event.kind]} · {event.title} · {event.outcome}
                      </li>
                    ))}
                  </ol>
                )}
                {activity.events.length > visible && (
                  <button type="button" className="secondary" onClick={() => setVisible(count => count + PAGE_SIZE)}>
                    显示更多记录
                  </button>
                )}
              </>
            )}
    </section>
  )
}

export default function StudyCalendar({ date, todayDate, cells, activity, onSelect }: {
  date: string
  todayDate: string
  cells?: MonthCell[]
  activity?: DayActivity
  onSelect: (date: string) => void
}) {
  const [year, month] = date.split('-').map(Number)
  const changeMonth = (delta: number) => {
    const next = localDateKey(new Date(year, month - 1 + delta, 1))
    onSelect(next.slice(0, 7) === todayDate.slice(0, 7) ? todayDate : next)
  }
  const blanks = Array<null>(new Date(year, month - 1, 1).getDay()).fill(null)
  const all = cells ? [...blanks, ...cells] : []
  const rows = Array.from({ length: Math.ceil(all.length / 7) }, (_, index) => all.slice(index * 7, index * 7 + 7))

  return (
    <section className="garden-calendar" aria-labelledby="study-calendar-title">
      <h2 id="study-calendar-title">学习日历</h2>
      <p className="garden-calendar-controls">
        <button type="button" className="secondary" onClick={() => changeMonth(-1)}>← 上个月</button>{' '}
        <strong>{year} 年 {month} 月</strong>{' '}
        <button type="button" className="secondary" onClick={() => changeMonth(1)}>下个月 →</button>{' '}
        {date !== todayDate && <button type="button" className="secondary" onClick={() => onSelect(todayDate)}>回到今天</button>}
      </p>
      <p className="garden-meta">● 表示当天有学习记录。选择日期查看明细。连续打卡仍按词汇复习计算，周日不算断签。</p>
      {!cells && <p role="status">正在读取本月日历……</p>}
      {cells && (
        <table className="study-calendar" aria-label={`${year} 年 ${month} 月学习记录`}>
          <thead><tr>{WEEKDAYS.map(day => <th key={day} scope="col">{day}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => (
            <tr key={index}>{row.map((cell, column) => cell ? (
              <td key={cell.date}>
                <button type="button" className="secondary" aria-pressed={cell.date === date}
                  aria-current={cell.isToday ? 'date' : undefined}
                  aria-label={`${cell.date}${cell.studied ? '，有学习记录' : ''}${cell.isSunday ? '，周日休息' : ''}`}
                  onClick={() => onSelect(cell.date)}>
                  {cell.day}{cell.studied && <span aria-hidden="true"> ●</span>}
                </button>
              </td>
            ) : <td key={column} />)}</tr>
          ))}</tbody>
        </table>
      )}
      <DayActivityPanel key={date} date={date} activity={activity} />
    </section>
  )
}
