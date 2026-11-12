import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { getAllPapers, type Paper } from '../lib/db'
import { discardStageRun, getStageRuns, moveStageCursor, saveStageAnswer, scoreStageRun, startStageRun, submitStageRun } from '../lib/stage'
import { STAGE_MAX_QUESTIONS, STUDY_STAGES, type StageRun, type StudyStage } from '../lib/stage-model'
import AnswerCard from './AnswerCard'
import ListeningAudio, { ListeningFilesProvider } from '../components/ListeningAudio'

export default function StageTest({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<{ papers: Paper[]; runs: StageRun[] }>()
  const [stage, setStage] = useState<StudyStage>('yonsei-1-2')
  const [paperId, setPaperId] = useState('')
  const [resultId, setResultId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [papers, runs] = await Promise.all([getAllPapers(), getStageRuns()])
      return { papers, runs }
    }).subscribe({
      next: setData,
      error: () => setError('无法读取阶段测试，请重新打开此页。'),
    })
    return () => subscription.unsubscribe()
  }, [])

  const active = data?.runs.find(run => !run.finishedAt)
  const run = data?.runs.find(item => item.id === resultId) ?? active
  const current = run?.questions[run.cursor]
  const score = run?.finishedAt ? scoreStageRun(run) : undefined

  const perform = async (action: () => Promise<void>) => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="secondary" onClick={onBack}>← 返回学习计划</button>
      <h1>阶段测试</h1>
      {error && <p role="alert" className="fail">{error}</p>}
      {!data && !error && <p role="status">正在读取阶段测试……</p>}
      {data && !run && (
        <>
          <p>选择教材阶段和适合的已导入试卷。每次取试卷中最多 {STAGE_MAX_QUESTIONS} 道客观题；阶段标签由你选择。</p>
          {data.papers.length === 0 ? <p>还没有试卷。<a href="#/practice">前往练习页导入试卷</a>。</p> : (
            <form onSubmit={event => {
              event.preventDefault()
              void perform(async () => { await startStageRun(stage, Number(paperId)) })
            }}>
              <p><label>教材阶段 <select value={stage} onChange={event => setStage(event.target.value as StudyStage)}>
                {Object.entries(STUDY_STAGES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select></label></p>
              <p><label>测试试卷 <select value={paperId} required onChange={event => setPaperId(event.target.value)}>
                <option value="">请选择试卷</option>
                {data.papers.map(paper => <option key={paper.id} value={paper.id}>{paper.title}</option>)}
              </select></label></p>
              <button type="submit" disabled={!paperId || busy}>开始阶段测试</button>
            </form>
          )}
          <h2>测试历史</h2>
          {data.runs.length === 0 && <p>还没有已提交的阶段测试。</p>}
          <ul>{data.runs.filter(item => item.finishedAt).map(item => {
            const summary = scoreStageRun(item)
            return (
              <li key={item.id}>
                {STUDY_STAGES[item.stage]} · {item.paperTitle} · {summary.correct}/{summary.total} 道 ·{' '}
                {new Date(item.finishedAt!).toLocaleDateString()}{' '}
                <button type="button" className="secondary" onClick={() => setResultId(item.id)}>查看成绩</button>
              </li>
            )
          })}</ul>
        </>
      )}
      {run && !run.finishedAt && current && (
        <ListeningFilesProvider key={run.id}>
          <h2>{STUDY_STAGES[run.stage]} · {run.paperTitle}</h2>
          <p>第 {run.cursor + 1} / {run.questions.length} 题 · {current.qtype} · 来源 {current.source}</p>
          <AnswerCard title="阶段测试答题卡"
            states={run.answers.map(answer => answer === null ? 'unanswered' : 'answered')}
            current={run.cursor}
            onJump={busy ? undefined : index => void perform(() => moveStageCursor(run.id, index))} />
          {current.qtype === '听力' && <ListeningAudio key={current.questionId} question={{ audio: current.audio }} />}
          <p>{current.stem}</p>
          <ul>{current.options.map((option, index) => (
            <li key={index}>
              <button type="button" className={run.answers[run.cursor] === index ? undefined : 'secondary'}
                aria-pressed={run.answers[run.cursor] === index} disabled={busy}
                onClick={() => void perform(() => saveStageAnswer(run.id, run.cursor, index))}>
                {option}
              </button>
            </li>
          ))}</ul>
          <p>
            <button type="button" className="secondary" disabled={busy || run.cursor === 0}
              onClick={() => void perform(() => moveStageCursor(run.id, run.cursor - 1))}>上一题</button>{' '}
            <button type="button" className="secondary" disabled={busy || run.cursor === run.questions.length - 1}
              onClick={() => void perform(() => moveStageCursor(run.id, run.cursor + 1))}>下一题</button>{' '}
            <button type="button" disabled={busy} onClick={() => {
              if (run.answers.includes(null) && !window.confirm('还有未答题目，确定提交这次测试吗？')) return
              void perform(async () => { await submitStageRun(run.id); setResultId(run.id) })
            }}>提交阶段测试</button>{' '}
            <button type="button" className="secondary" disabled={busy} onClick={() => {
              if (window.confirm('放弃这次未完成的阶段测试并丢弃本次答案吗？')) {
                void perform(() => discardStageRun(run.id))
              }
            }}>放弃本次测试</button>
          </p>
          <p>答案与题目位置会保存在本机。离开后可以继续。</p>
        </ListeningFilesProvider>
      )}
      {run && score && (
        <>
          <h2>阶段测试成绩</h2>
          <p>{STUDY_STAGES[run.stage]} · {run.paperTitle}</p>
          <p>答对 {score.correct} / {score.total} 道 · 答错 {score.wrong} 道 · 未答 {score.unanswered} 道</p>
          <h3>按题型回顾</h3>
          <ul>{score.byQtype.map(row => (
            <li key={row.qtype}>{row.qtype} · 答对 {row.correct} / {row.total} 道
              {row.correct < row.total ? ' · 建议复习' : ''}</li>
          ))}</ul>
          {run.questions.map((question, index) => (
            <details key={question.questionId}>
              <summary>第 {index + 1} 题 · {question.qtype} · {run.answers[index] === null ? '未答'
                : run.answers[index] === question.answerIndex ? '答对' : '答错'}</summary>
              <p>{question.stem}</p>
              <p>正确答案：{question.options[question.answerIndex]}</p>
              <p>你的答案：{run.answers[index] === null ? '未答' : question.options[run.answers[index]!]}</p>
              {question.explanation && <p>解析：{question.explanation}</p>}
            </details>
          ))}
          <button type="button" className="secondary" onClick={() => setResultId(undefined)}>返回阶段测试</button>
        </>
      )}
    </>
  )
}
