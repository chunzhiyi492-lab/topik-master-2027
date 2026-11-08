import { useEffect, useState } from 'react'
import {
  addAttempt,
  getLatestAttemptByQuestion,
  getQuestionById,
  getWrongQuestionIds,
  type Question,
} from '../lib/db'
import { ListeningAudio } from './Practice'

// TOPIK MASTER 2027 — 错题复练页（P7：#16）
// 口径（P7 定死）：
// - 错题 = 最新一次答题答错的客观题（db.ts getWrongQuestionIds，与 P5/P6 口径一致；
//   写作等主观题不自动判分、不进错题范围；词汇错词走复习页的错词本，不在这里）。
// - 复练按题目逐题重答：答对 → 该题最新答题记录变“答对”，自动移出错题范围；
//   答错 → 仍在错题本，可继续练。复练的答题记录同样进 attempts。
// - 一轮只练一遍：本轮答对的题当场移出本轮队列；本轮结束显示移出数与剩余数，
//   可点“再练剩余错题”继续（重新从库里取最新错题）。

interface WrongItem {
  question: Question
  /** 上次答错时选的选项文本 */
  lastSelected: string
  /** 上次答错时间 */
  lastWrongAt: Date
}

const QTYPE_FILTERS = ['全部', '听力', '阅读', '写作', '词汇', '语法', '其他']

export default function WrongQuestions({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<WrongItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qtypeFilter, setQtypeFilter] = useState('全部')
  // 复练会话状态
  const [session, setSession] = useState<Question[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [roundCorrect, setRoundCorrect] = useState(0)
  const [roundDone, setRoundDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadWrong = async () => {
    setLoading(true)
    setError('')
    try {
      const ids = await getWrongQuestionIds()
      const out: WrongItem[] = []
      for (const id of ids) {
        const q = await getQuestionById(id)
        if (!q) continue
        const latest = await getLatestAttemptByQuestion(id)
        if (!latest || latest.correct) continue
        out.push({ question: q, lastSelected: latest.selectedAnswer, lastWrongAt: latest.answeredAt })
      }
      out.sort((a, b) => b.lastWrongAt.getTime() - a.lastWrongAt.getTime())
      setItems(out)
    } catch (e) {
      setError(`读取错题本失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWrong()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = qtypeFilter === '全部' ? items : items.filter((it) => it.question.qtype === qtypeFilter)
  const current = session !== null && session.length > 0 ? session[idx] : null

  const startSession = (list: Question[]) => {
    if (list.length === 0) return
    setSession(list)
    setIdx(0)
    setSelected(null)
    setSubmitted(false)
    setLastCorrect(null)
    setRoundCorrect(0)
    setRoundDone(false)
    setError('')
  }

  const handleSubmit = async () => {
    if (!current || current.id === undefined || selected === null || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const correct = selected === current.answerIndex
      await addAttempt({
        questionId: current.id,
        selectedAnswer: current.options[selected] ?? '',
        correct,
        answeredAt: new Date(),
      })
      if (correct) setRoundCorrect((n) => n + 1)
      setLastCorrect(correct)
      setSubmitted(true)
    } catch (e) {
      setError(`记录答题失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    if (!session) return
    if (idx + 1 < session.length) {
      setIdx((i) => i + 1)
      setSelected(null)
      setSubmitted(false)
      setLastCorrect(null)
    } else {
      // 本轮结束：重新从库里取最新错题（本轮答对的已移出），显示移出数与剩余数。
      setRoundDone(true)
      void loadWrong()
    }
  }

  return (
    <>
      <button type="button" className="secondary" onClick={onBack}>
        ← 返回首页
      </button>
      <h1>错题复练</h1>
      <p>
        错题本（#16）：最新一次答错的客观题。答对后自动移出；写作题不自动判分、不进错题本；
        词汇错词在“复习”页的错词本里。
      </p>

      {error && <p className="fail">{error}</p>}
      {loading && <p>正在读取错题本……</p>}

      {!loading && session === null && (
        <>
          <p>
            错题共 {items.length} 道 · 题型：
            <select value={qtypeFilter} onChange={(e) => setQtypeFilter(e.target.value)}>
              {QTYPE_FILTERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>{' '}
            <button
              type="button"
              onClick={() => startSession(filtered.map((it) => it.question))}
              disabled={filtered.length === 0}
            >
              开始错题复练（{filtered.length} 道）
            </button>
          </p>
          {items.length === 0 ? (
            <p>错题本是空的——还没有答错的客观题。去“练习”或“模拟考试”答题后，答错的题会出现在这里。</p>
          ) : filtered.length === 0 ? (
            <p>按当前题型筛选没有错题，换个题型试试。</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>题干</th>
                  <th>题型</th>
                  <th>上次选错</th>
                  <th>答错时间</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.question.id}>
                    <td>{it.question.stem.slice(0, 40)}{it.question.stem.length > 40 ? '…' : ''}</td>
                    <td>{it.question.qtype}</td>
                    <td>{it.lastSelected || '—'}</td>
                    <td>{it.lastWrongAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {session !== null && !roundDone && current && (
        <>
          <p>
            第 {idx + 1} / {session.length} 道 · 本轮已答对 {roundCorrect} 道 · 题型 {current.qtype} ·
            来源 {current.source} · 核实状态 {current.status}
          </p>
          {current.qtype === '听力' && <ListeningAudio question={current} />}
          <div className="note">
            <p style={{ fontSize: 17 }}>{current.stem}</p>
            {current.options.map((opt, i) => (
              <p key={i}>
                <button
                  type="button"
                  className={selected === i ? undefined : 'secondary'}
                  disabled={submitted}
                  onClick={() => setSelected(i)}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </button>
              </p>
            ))}
            {!submitted ? (
              <p>
                <button type="button" onClick={() => void handleSubmit()} disabled={selected === null || submitting}>
                  提交答案
                </button>
              </p>
            ) : (
              <>
                <p className={lastCorrect ? 'pass' : 'fail'}>
                  {lastCorrect ? '答对了，已移出错题本。' : '答错了，仍在错题本里。'}
                  正确答案：
                  {current.answerIndex !== null
                    ? `${String.fromCharCode(65 + current.answerIndex)}. ${current.options[current.answerIndex]}`
                    : '—'}
                </p>
                {current.explanation && (
                  <p>
                    解析：{current.explanation}
                  </p>
                )}
                <p>
                  来源：{current.source} · 核实状态：{current.status}
                </p>
              </>
            )}
          </div>
          {submitted && (
            <p>
              <button type="button" onClick={handleNext}>
                {idx + 1 < session.length ? '下一题' : '查看本轮结果'}
              </button>
            </p>
          )}
          <p>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSession(null)
                void loadWrong()
              }}
            >
              退出复练
            </button>
          </p>
        </>
      )}

      {session !== null && roundDone && (
        <>
          <h2>本轮结果</h2>
          <p>
            本轮共 {session.length} 道 · 答对 {roundCorrect} 道（已移出错题本） · 仍错{' '}
            {session.length - roundCorrect} 道（仍在错题本里）。
          </p>
          <p>错题本现在共 {items.length} 道。</p>
          <p>
            {items.length > 0 && (
              <>
                <button type="button" onClick={() => startSession(items.map((it) => it.question))}>
                  再练剩余错题（{items.length} 道）
                </button>{' '}
              </>
            )}
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSession(null)
                setRoundDone(false)
                void loadWrong()
              }}
            >
              返回错题本
            </button>
          </p>
        </>
      )}
    </>
  )
}
