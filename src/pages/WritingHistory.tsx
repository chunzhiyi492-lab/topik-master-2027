import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db, getWritingHistory } from '../lib/db'
import { saveWritingAssessment } from '../lib/writing'
import { WRITING_CRITERIA, WRITING_GUIDE, type WritingAssessment } from '../lib/writing-model'

function Assessment({ id, order, initial }: { id: number; order: number; initial?: WritingAssessment }) {
  const [checks, setChecks] = useState(initial?.checks ?? [])
  const [note, setNote] = useState(initial?.note ?? '')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <fieldset className="garden-assessment" disabled={busy}>
    <legend>本版本自评 · 仅供学习参考</legend>
    <p>以下由你逐项判断。语境、论证和表达质量需要人工判断。<a href={WRITING_GUIDE} target="_blank" rel="noreferrer">官方写作指南</a></p>
    {(order === 53 || order === 54) && <p>官方量规参考配分（内容与任务 / 结构 / 语言）：{order === 53 ? '7 / 7 / 16' : '12 / 12 / 26'}。勾选只记录自查结果。</p>}
    {(order === 51 || order === 52) && <p>纸笔题型参考满分 10 分。人工核对每空是否符合前后语境、语法、语体和拼写。</p>}
    {WRITING_CRITERIA.map(([key, label]) => <p key={key}><label><input type="checkbox" checked={checks.includes(key)}
      onChange={event => setChecks(event.target.checked ? [...checks, key] : checks.filter(item => item !== key))} /> {label}</label></p>)}
    <p><label>下一次修改建议 <textarea rows={3} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} /></label></p>
    <button type="button" onClick={() => {
      setBusy(true); setError(''); setStatus('')
      void saveWritingAssessment(id, checks, note).then(() => setStatus('自评与修改建议已保存。'))
        .catch(() => setError('自评未保存，请重试。')).finally(() => setBusy(false))
    }}>保存本版本自评</button>
    {status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}
  </fieldset>
}

export default function WritingHistory({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof getWritingHistory>>>()
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<{ id: number; stem: string; updatedAt: string; completed: boolean }[]>([])

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [history, rows] = await Promise.all([getWritingHistory(), db.writingDrafts.toArray()])
      const active = rows.filter(row => row.text.trim()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      const questions = await db.questions.bulkGet(active.map(row => row.questionId))
      return { history, drafts: active.flatMap((row, index) => {
        const question = questions[index]
        return question ? [{ id: row.questionId, stem: question.stem, updatedAt: row.updatedAt,
          completed: history.some(entry => entry.attempt.id === row.lastAttemptId && entry.attempt.selectedAnswer === row.text) }] : []
      }) }
    }).subscribe({
      next: value => { setEntries(value.history); setDrafts(value.drafts) },
      error: () => setError('无法读取写作记录，请重新打开此页。'),
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <>
      <button type="button" className="secondary garden-back" onClick={onBack}>← 返回练习</button>
      <h1>写作历史</h1>
      <p><a href="#/writing">按题型练习</a></p>
      <h2>草稿与继续练习</h2>
      {drafts.length === 0 ? <p className="note">暂无草稿。</p> : <ul className="garden-entries">{drafts.map(draft => <li key={draft.id}>
        <a href={`#/practice?question=${draft.id}`}>{draft.stem.split('\n')[0]}</a><span className="garden-meta">{draft.completed ? '已完成' : '草稿待完成'} · {new Date(draft.updatedAt).toLocaleString()}</span>
      </li>)}</ul>}
      <p>按保存时间从新到旧排列。可对照题目、自己的答案和参考答案复盘。</p>
      {error && <p role="alert" className="fail">{error}</p>}
      {!entries && !error && <p role="status">正在读取写作历史……</p>}
      {entries?.length === 0 && <p>还没有写作记录。完成并保存一道写作题后，就会在这里显示。</p>}
      {entries && entries.length > 0 && <p>共 {entries.length} 条写作记录</p>}
      {entries?.map(({ attempt, question }) => (
        <details key={attempt.id} className="note">
          <summary><time dateTime={attempt.answeredAt.toISOString()}>{attempt.answeredAt.toLocaleString()}</time>
            {' · '}{question.stem}</summary>
          <p>来源：{question.source}{attempt.writingSeconds !== undefined &&
            ` · 用时 ${Math.floor(attempt.writingSeconds / 60)} 分 ${attempt.writingSeconds % 60} 秒`}</p>
          <h2>我的答案</h2>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{attempt.selectedAnswer}</p>
          <h2>参考答案与解析</h2>
          <p>{question.answer || '未提供参考答案'}</p>
          {question.explanation && <p>{question.explanation}</p>}
          <Assessment id={attempt.id!} order={question.order} initial={attempt.writingAssessment} />
        </details>
      ))}
    </>
  )
}
