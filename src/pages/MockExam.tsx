import { useEffect, useRef, useState } from 'react'
import {
  addAttempt,
  getAllPapers,
  getQuestionsByPaper,
  type Paper,
  type Question,
} from '../lib/db'
import { ListeningAudio, WritingCard } from './Practice'

// TOPIK MASTER 2027 — 模拟考试页（P6：#14 模拟考试计时）
// 环节顺序按任务与分期计划：听力 → 阅读 → 写作；各环节时长可调，默认按 TOPIK II
// 公开结构（听力 60 / 阅读 70 / 写作 50 分钟），页面标注“按 TOPIK II 公开结构，
// 实际以当年准考证为准”——不编造确切考试结构与日期。
// 结束页只出成绩摘要（已答 / 未答 / 用时），不自动判分、不出分数；自动计分在 P7 的 #15 接上。
// 词汇 / 语法 / 其他题型的题不计入本次模拟（页面明示数量）；客观题答案在环节结束时
// 一次性写 attempts，写作答案以 subjective 标记写入（不计正确率，与 P5 口径一致）。

type SectionKey = 'listening' | 'reading' | 'writing'

interface Section {
  key: SectionKey
  label: string
  minutes: number
  questions: Question[]
}

interface ExamAnswer {
  selected?: number
  text?: string
  seconds?: number
}

interface SectionSummary {
  key: SectionKey
  label: string
  answered: number
  unanswered: number
  seconds: number
}

const DEFAULT_DURATIONS: Record<SectionKey, number> = {
  listening: 60,
  reading: 70,
  writing: 50,
}

const SECTION_LABELS: Record<SectionKey, string> = {
  listening: '听力',
  reading: '阅读',
  writing: '写作',
}

function loadDurations(): Record<SectionKey, number> {
  try {
    const raw = localStorage.getItem('topik-master-mock-durations')
    if (!raw) return { ...DEFAULT_DURATIONS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_DURATIONS }
    const r = parsed as Record<string, unknown>
    const pick = (k: SectionKey) =>
      typeof r[k] === 'number' && Number.isInteger(r[k]) && (r[k] as number) >= 1 && (r[k] as number) <= 600
        ? (r[k] as number)
        : DEFAULT_DURATIONS[k]
    return { listening: pick('listening'), reading: pick('reading'), writing: pick('writing') }
  } catch {
    return { ...DEFAULT_DURATIONS }
  }
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatMinutes(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return s === 0 ? `${m} 分钟` : `${m} 分 ${s} 秒`
}

export default function MockExam({ onBack }: { onBack: () => void }) {
  const [papers, setPapers] = useState<Paper[]>([])
  const [paperId, setPaperId] = useState<number | ''>('')
  const [durations, setDurations] = useState<Record<SectionKey, number>>(loadDurations)
  const [stage, setStage] = useState<'setup' | 'running' | 'done'>('setup')
  const [sections, setSections] = useState<Section[]>([])
  const [sectionIdx, setSectionIdx] = useState(0)
  const [questionIdx, setQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState<Map<number, ExamAnswer>>(new Map())
  const [summaries, setSummaries] = useState<SectionSummary[]>([])
  const [sectionEndAt, setSectionEndAt] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [otherCount, setOtherCount] = useState(0)
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const sectionStartRef = useRef(0)
  const sectionsRef = useRef<Section[]>([])
  const answersRef = useRef<Map<number, ExamAnswer>>(new Map())
  const summariesRef = useRef<SectionSummary[]>([])

  useEffect(() => {
    void getAllPapers().then(setPapers)
  }, [])

  const currentSection = sections.length > 0 ? sections[sectionIdx] : null
  const current =
    currentSection && currentSection.questions.length > 0
      ? currentSection.questions[questionIdx]
      : null
  const isObjective = current !== null && current.options.length > 0

  const setDuration = (key: SectionKey, value: number) => {
    const v = Number.isFinite(value) ? Math.max(1, Math.min(600, Math.floor(value) || 1)) : DEFAULT_DURATIONS[key]
    setDurations((prev) => {
      const next = { ...prev, [key]: v }
      try {
        localStorage.setItem('topik-master-mock-durations', JSON.stringify(next))
      } catch {
        /* localStorage 写失败不阻塞 */
      }
      return next
    })
  }

  const buildSections = async (paper: Paper): Promise<{ built: Section[]; others: number }> => {
    const qs = await getQuestionsByPaper(paper.id as number)
    const byType = (t: string) => qs.filter((q) => q.qtype === t)
    const others = qs.filter((q) => q.qtype !== '听力' && q.qtype !== '阅读' && q.qtype !== '写作').length
    const built: Section[] = []
    const listening = byType('听力')
    if (listening.length > 0) built.push({ key: 'listening', label: '听力', minutes: durations.listening, questions: listening })
    const reading = byType('阅读')
    if (reading.length > 0) built.push({ key: 'reading', label: '阅读', minutes: durations.reading, questions: reading })
    const writing = byType('写作')
    if (writing.length > 0) built.push({ key: 'writing', label: '写作', minutes: durations.writing, questions: writing })
    return { built, others }
  }

  const startExam = async () => {
    setError('')
    setNotice('')
    if (paperId === '') {
      setError('请先选一场试卷。')
      return
    }
    const paper = papers.find((p) => p.id === paperId)
    if (!paper) {
      setError('选中的试卷找不到了，请刷新后重试。')
      return
    }
    const { built, others } = await buildSections(paper)
    if (built.length === 0) {
      setError(`“${paper.title}”里没有听力 / 阅读 / 写作题，无法开始模拟考试。`)
      return
    }
    sectionsRef.current = built
    answersRef.current = new Map()
    summariesRef.current = []
    setSections(built)
    setAnswers(new Map())
    setSummaries([])
    setOtherCount(others)
    setSelectedPaper(paper)
    setSectionIdx(0)
    setQuestionIdx(0)
    sectionStartRef.current = Date.now()
    setSectionEndAt(Date.now() + built[0].minutes * 60000)
    setSecondsLeft(built[0].minutes * 60)
    setStage('running')
  }

  /** 把指定环节已作答的题写 attempts；未作答的不写。 */
  const flushSection = async (section: Section) => {
    for (const q of section.questions) {
      const a = answersRef.current.get(q.id as number)
      if (!a) continue
      if (q.options.length > 0) {
        if (a.selected === undefined) continue
        await addAttempt({
          questionId: q.id as number,
          paperId: selectedPaper?.id,
          selectedAnswer: q.options[a.selected] ?? '',
          correct: a.selected === q.answerIndex,
          answeredAt: new Date(),
        })
      } else {
        if (a.text === undefined || a.text.trim() === '') continue
        await addAttempt({
          questionId: q.id as number,
          paperId: selectedPaper?.id,
          selectedAnswer: a.text,
          correct: false,
          answeredAt: new Date(),
          subjective: true,
          writingSeconds: a.seconds ?? 0,
        })
      }
    }
  }

  const finishSection = async (timedOut: boolean) => {
    const section = sectionsRef.current[sectionIdx]
    if (!section) return
    const elapsed = Math.floor((Date.now() - sectionStartRef.current) / 1000)
    await flushSection(section)
    const answered = section.questions.filter((q) => {
      const a = answersRef.current.get(q.id as number)
      if (!a) return false
      return q.options.length > 0 ? a.selected !== undefined : (a.text?.trim() ?? '') !== ''
    }).length
    const summary: SectionSummary = {
      key: section.key,
      label: section.label,
      answered,
      unanswered: section.questions.length - answered,
      seconds: elapsed,
    }
    summariesRef.current = [...summariesRef.current, summary]
    setSummaries(summariesRef.current)
    if (timedOut) {
      setNotice(`“${section.label}”环节时间到，已自动进入下一环节。`)
    } else {
      setNotice('')
    }
    if (sectionIdx + 1 < sectionsRef.current.length) {
      const next = sectionsRef.current[sectionIdx + 1]
      setSectionIdx((i) => i + 1)
      setQuestionIdx(0)
      sectionStartRef.current = Date.now()
      setSectionEndAt(Date.now() + next.minutes * 60000)
      setSecondsLeft(next.minutes * 60)
    } else {
      setStage('done')
    }
  }

  // 环节倒计时：时间戳算剩余；到点自动进入下一环节。
  useEffect(() => {
    if (stage !== 'running' || sectionEndAt === 0) return
    const t = window.setInterval(() => {
      const left = Math.max(0, Math.round((sectionEndAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        window.clearInterval(t)
        void finishSection(true)
      }
    }, 500)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, sectionEndAt, sectionIdx])

  const setAnswer = (questionId: number, patch: Partial<ExamAnswer>) => {
    const next = new Map(answersRef.current)
    const prev = next.get(questionId) ?? {}
    next.set(questionId, { ...prev, ...patch })
    answersRef.current = next
    setAnswers(next)
  }

  const exitExam = async () => {
    const section = sectionsRef.current[sectionIdx]
    if (section) await flushSection(section)
    setStage('setup')
    setSections([])
    setSectionIdx(0)
    setQuestionIdx(0)
    setNotice('')
  }

  const totalAnswered = summaries.reduce((n, s) => n + s.answered, 0)
  const totalUnanswered = summaries.reduce((n, s) => n + s.unanswered, 0)
  const totalSeconds = summaries.reduce((n, s) => n + s.seconds, 0)

  return (
    <>
      <button type="button" className="secondary" onClick={onBack}>
        ← 返回首页
      </button>
      <h1>模拟考试</h1>
      <p>
        按听力 → 阅读 → 写作为环节计时走完（#14）。结束页只出成绩摘要（已答 / 未答 / 用时），
        不自动判分、不出分数；自动计分在 P7 接上。
      </p>
      <p>
        环节时长默认按 TOPIK II 公开结构（听力 60 分钟、阅读 70 分钟、写作 50 分钟），
        实际以当年准考证为准。
      </p>

      {error && <p className="fail">{error}</p>}
      {notice && <p className="note">{notice}</p>}

      {stage === 'setup' && (
        <>
          {papers.length === 0 ? (
            <p>还没有试卷。先在“练习”页导入试卷 JSON，再回来模拟考试。</p>
          ) : (
            <>
              <p>
                选择试卷：
                <select
                  value={paperId}
                  onChange={(e) => setPaperId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">— 请选择 —</option>
                  {papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </p>
              <h2>环节时长（可调，分钟）</h2>
              <table>
                <tbody>
                  {(['listening', 'reading', 'writing'] as SectionKey[]).map((key) => (
                    <tr key={key}>
                      <td>{SECTION_LABELS[key]}</td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          max={600}
                          value={durations[key]}
                          onChange={(e) => setDuration(key, Number(e.target.value))}
                          style={{ width: 72 }}
                        />{' '}
                        分钟（默认 {DEFAULT_DURATIONS[key]}）
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                <button type="button" onClick={() => void startExam()}>
                  开始模拟考试
                </button>
              </p>
              <p>
                模拟考试按试卷的听力 / 阅读 / 写作题分组计时；词汇 / 语法 /
                其他题型的题不计入本次模拟。客观题答案在环节结束时写入答题记录，
                写作答案以主观题标记写入（不计正确率）。
              </p>
            </>
          )}
        </>
      )}

      {stage === 'running' && currentSection && current && (
        <>
          <h2>
            {selectedPaper?.title ?? ''} · {currentSection.label}环节（#14）
          </h2>
          <p>
            环节 {sectionIdx + 1} / {sections.length} · 剩余 {formatSeconds(secondsLeft)}
            （本环节 {currentSection.minutes} 分钟） · 第 {questionIdx + 1} /{' '}
            {currentSection.questions.length} 道
          </p>
          {otherCount > 0 && (
            <p>本场另有 {otherCount} 道其他题型题目未计入本次模拟。</p>
          )}
          <p>
            题型 {current.qtype} · 难度 {current.difficulty} · 来源 {current.source} · 核实状态{' '}
            {current.status}
          </p>

          {current.qtype === '听力' && <ListeningAudio question={current} />}

          {isObjective ? (
            <div className="note">
              <p style={{ fontSize: 17 }}>{current.stem}</p>
              {current.options.map((opt, i) => {
                const chosen = answers.get(current.id as number)?.selected === i
                return (
                  <p key={i}>
                    <button
                      type="button"
                      className={chosen ? undefined : 'secondary'}
                      onClick={() => setAnswer(current.id as number, { selected: i })}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                    </button>
                  </p>
                )
              })}
              <p>
                {answers.get(current.id as number)?.selected !== undefined
                  ? `已选：${String.fromCharCode(65 + (answers.get(current.id as number)?.selected as number))}`
                  : '尚未作答（考试模式不显示对错，答案在环节结束时统一记录）'}
              </p>
            </div>
          ) : current.qtype === '写作' ? (
            <>
              <div className="note">
                <p style={{ fontSize: 17 }}>{current.stem}</p>
              </div>
              <WritingCard
                question={current}
                initialText={answers.get(current.id as number)?.text ?? ''}
                onSave={(text, seconds) => {
                  setAnswer(current.id as number, { text, seconds })
                }}
                showReference={false}
                onSkip={() => {
                  if (questionIdx + 1 < currentSection.questions.length) {
                    setQuestionIdx((i) => i + 1)
                  }
                }}
              />
            </>
          ) : (
            <div className="note">
              <p style={{ fontSize: 17 }}>{current.stem}</p>
              <p>主观题不自动判分；答案请在写作卡片里写（仅写作题型有写作卡片）。</p>
            </div>
          )}

          <p>
            <button
              type="button"
              className="secondary"
              disabled={questionIdx === 0}
              onClick={() => setQuestionIdx((i) => i - 1)}
            >
              上一题
            </button>{' '}
            <button
              type="button"
              className="secondary"
              disabled={questionIdx + 1 >= currentSection.questions.length}
              onClick={() => setQuestionIdx((i) => i + 1)}
            >
              下一题
            </button>{' '}
            <button type="button" onClick={() => void finishSection(false)}>
              {sectionIdx + 1 < sections.length ? '进入下一环节' : '结束考试'}
            </button>{' '}
            <button
              type="button"
              className="secondary"
              onClick={() => void exitExam()}
            >
              退出模拟考试（本环节已作答的题会先记入答题记录）
            </button>
          </p>
        </>
      )}

      {stage === 'done' && (
        <>
          <h2>成绩摘要（#14）</h2>
          <p>
            {selectedPaper?.title ?? ''} · 本次模拟已完成。本页只出已答 / 未答 / 用时，
            不自动判分、不出分数（自动计分在 P7 接上）。
          </p>
          <table>
            <thead>
              <tr>
                <th>环节</th>
                <th>已答</th>
                <th>未答</th>
                <th>用时</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.key}>
                  <td>{s.label}</td>
                  <td>{s.answered}</td>
                  <td>{s.unanswered}</td>
                  <td>{formatMinutes(s.seconds)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <b>合计</b>
                </td>
                <td>
                  <b>{totalAnswered}</b>
                </td>
                <td>
                  <b>{totalUnanswered}</b>
                </td>
                <td>
                  <b>{formatMinutes(totalSeconds)}</b>
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            <button
              type="button"
              onClick={() => {
                setStage('setup')
                setSections([])
                setSectionIdx(0)
                setQuestionIdx(0)
                setSummaries([])
                setNotice('')
              }}
            >
              再考一次
            </button>{' '}
            <button type="button" className="secondary" onClick={onBack}>
              返回首页
            </button>
          </p>
        </>
      )}
    </>
  )
}
