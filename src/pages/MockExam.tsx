import { useEffect, useRef, useState } from 'react'
import { GardenTableScroll } from '../components/GardenUI'
import {
  getAllPapers,
  getQuestionsByPaper,
  type Paper,
  type Question,
} from '../lib/db'
import { checkpointExam, getExamHistory, loadExam, moveExamCursor, saveExamAnswer, setExamPaused, startExam as createExam, submitExamSection, submitExpiredExam } from '../lib/exam'
import { canPauseExam, createExamClock, EXAM_PROFILES, SECTION_TYPES, type ExamAnswer, type ExamMode, type ExamSession, type SectionKey } from '../lib/exam-model'
import { isVerifiedObjective, scoreItems, type ScoredItem } from '../lib/scoring'
import { WritingCard } from './Practice'
import ListeningAudio, { ListeningFilesProvider } from '../components/ListeningAudio'
import AnswerCard, { type AnswerCardState } from './AnswerCard'

const DEFAULT_DURATIONS: Record<SectionKey, number> = {
  listening: 60,
  reading: 70,
  writing: 50,
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
  const [mode, setMode] = useState<ExamMode>('practice')
  const [scope, setScope] = useState<SectionKey>()
  const [history, setHistory] = useState<ExamSession[]>([])
  const [session, setSession] = useState<ExamSession>()
  const [questions, setQuestions] = useState<Question[]>([])
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [retryTick, setRetryTick] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const finishing = useRef(false)
  const unsaved = useRef(new Map<number, { answer: ExamAnswer; enteredAt: number }>())
  const clock = useRef<ReturnType<typeof createExamClock> | null>(null)
  clock.current ??= createExamClock()
  const readTime = clock.current
  const pending = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    let active = true
    void (async () => {
      const [list, saved, results] = await Promise.all([getAllPapers(), loadExam(), getExamHistory()])
      const qs = saved ? await getQuestionsByPaper(saved.paperId) : []
      if (!active) return
      setPapers(list)
      setHistory(results)
      setQuestions(qs)
      setSession(saved)
      setReady(true)
    })().catch((e: unknown) => {
      if (active) setError(`无法读取考试进度：${e instanceof Error ? e.message : String(e)}`)
    })
    return () => { active = false }
  }, [])

  const stage = session?.status ?? 'setup'
  const sectionIdx = session?.sectionIdx ?? 0
  const questionIdx = session?.questionIdx ?? 0
  const sectionEndAt = session?.sectionEndAt ?? 0
  const pausedAt = session?.pausedAt
  const expired = secondsLeft === 0 && pausedAt === undefined
  const summaries = session?.summaries ?? []
  const otherCount = session?.otherCount ?? 0
  const selectedPaper = papers.find(p => p.id === session?.paperId)
  const questionsById = new Map(questions.map(q => [q.id, q]))
  const sections = (session?.sections ?? []).map(sec => ({
    ...sec,
    label: SECTION_TYPES[sec.key],
    questions: sec.questionIds.flatMap(id => {
      const q = questionsById.get(id)
      return q ? [q] : []
    }),
  }))
  const currentSection = sections[sectionIdx]
  const current = currentSection?.questions[questionIdx]
  const isObjective = !!current?.options.length
  const answers = new Map(Object.entries(session?.answers ?? {}).map(([id, answer]) => [Number(id), answer]))
  const unsavedChoice = current && unsaved.current.get(current.id!)?.answer.selected
  const currentChoice = unsavedChoice ?? (current && answers.get(current.id!)?.selected)

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

  const startExam = async () => {
    if (!ready || finishing.current) return
    setError('')
    setNotice('')
    if (paperId === '') {
      setError('请先选一场试卷。')
      return
    }
    finishing.current = true
    setSubmitting(true)
    try {
      const saved = await createExam(paperId, durations, undefined, Date.now(), { mode, scope })
      clock.current = createExamClock()
      setQuestions(await getQuestionsByPaper(saved.paperId))
      setSession(saved)
    } catch (e) {
      setError(`无法开始考试：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      finishing.current = false
      setSubmitting(false)
    }
  }

  const enqueue = <T,>(action: () => Promise<T>): Promise<T> => {
    const next = pending.current.then(action)
    pending.current = next.catch(() => undefined)
    return next
  }

  const writeAnswer = async (id: string, index: number, questionId: number, answer: ExamAnswer, enteredAt: number) => {
    try {
      setSession(await saveExamAnswer(id, index, questionId, answer, undefined, enteredAt))
      if (unsaved.current.delete(questionId) && !unsaved.current.size) setError('')
    } catch (e) {
      unsaved.current.set(questionId, { answer, enteredAt })
      setError(`答案未保存：${e instanceof Error ? e.message : String(e)}`)
      throw e
    }
  }

  const setAnswer = async (questionId: number, answer: ExamAnswer) => {
    if (!session || finishing.current) throw new Error('正在提交，请稍后重试')
    // Capture the input time before the write joins the queue.
    const enteredAt = readTime(session.updatedAt)
    if (enteredAt >= session.sectionEndAt || pausedAt !== undefined) {
      setError('当前不能继续作答，未保存这次输入。')
      throw new Error('当前不能继续作答')
    }
    await enqueue(() => writeAnswer(session.id, sectionIdx, questionId, answer, enteredAt))
  }

  const retryAnswers = async () => {
    if (!session || finishing.current) return
    finishing.current = true
    setSubmitting(true)
    try {
      await enqueue(async () => {
        for (const [id, { answer, enteredAt }] of unsaved.current) {
          await writeAnswer(session.id, sectionIdx, id, answer, enteredAt)
        }
      })
      setRetryTick(count => count + 1)
    } catch {
      // Keep the failed answer and the write error visible.
    } finally {
      finishing.current = false
      setSubmitting(false)
    }
  }

  const goToQuestion = (index: number) => {
    if (!session || finishing.current) return
    void enqueue(async () => {
      if (unsaved.current.size) throw new Error('请先保存当前答案，或复制未保存的内容')
      setSession(await moveExamCursor(session.id, sectionIdx, index, undefined, readTime(session.updatedAt)))
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }

  const togglePause = async () => {
    if (!session || finishing.current) return
    finishing.current = true
    setSubmitting(true)
    try {
      await enqueue(async () => {
        if (unsaved.current.size) throw new Error('请先重试保存答案')
        setSession(await setExamPaused(session.id, sectionIdx, pausedAt === undefined, readTime(session.updatedAt)))
        setError('')
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      finishing.current = false
      setSubmitting(false)
    }
  }

  const finishSection = async (timedOut: boolean) => {
    if (!session || finishing.current) return
    finishing.current = true
    setSubmitting(true)
    setError('')
    try {
      await enqueue(async () => {
        if (unsaved.current.size && (timedOut || !window.confirm('有答案未写入设备。确定只提交已经保存的答案吗？'))) {
          throw new Error('有未保存的答案，本环节尚未提交。可以重试写入，或复制未保存的内容。')
        }
        const now = readTime(session.updatedAt)
        const submitted = await submitExamSection(session.id, sectionIdx, undefined, now)
        unsaved.current.clear()
        setSession(submitted)
        const saved = await submitExpiredExam(submitted, now)
        setSession(saved)
        if (saved.status === 'done') setHistory(previous => [saved, ...previous.filter(exam => exam.id !== saved.id)])
        setNotice(timedOut || now >= sectionEndAt ? '考试时间已到，已提交到期科目中保存的答案。' : '')
      })
    } catch (e) {
      setError(`未能提交：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      finishing.current = false
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!session || stage !== 'running') return
    let checkpoint = session.updatedAt
    let autoRequested = false
    const tick = (forceCheckpoint = false) => {
      const now = pausedAt ?? readTime(checkpoint)
      const left = Math.max(0, Math.ceil((sectionEndAt - now) / 1000))
      setSecondsLeft(left)
      if (pausedAt !== undefined) return
      if (left === 0 && !autoRequested && !finishing.current) {
        autoRequested = true
        void finishSection(true)
      }
      if (now > checkpoint && (forceCheckpoint || now - checkpoint >= 30_000)) {
        checkpoint = now
        void checkpointExam(session.id, sectionIdx, now).catch(() => {
          // The next periodic or lifecycle checkpoint can retry; answers have their own transactions.
        })
      }
    }
    const onVisibility = () => tick(document.hidden)
    const onWake = () => tick()
    const onHide = () => tick(true)
    tick()
    const timer = window.setInterval(onWake, 250)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onWake)
    window.addEventListener('focus', onWake)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('pagehide', onHide)
    }
    // Reset the automatic submission guard when the phase changes or failed answers are retried.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, sectionEndAt, sectionIdx, session?.id, pausedAt, retryTick])

  const leaveExam = async () => {
    await pending.current
    if (unsaved.current.size || finishing.current) return
    if (session?.status === 'running' && pausedAt === undefined) {
      try {
        await checkpointExam(session.id, sectionIdx, readTime(session.updatedAt))
      } catch (e) {
        setError(`无法保存考试进度：${e instanceof Error ? e.message : String(e)}`)
        return
      }
    }
    onBack()
  }

  const openResult = async (result: ExamSession) => {
    if (finishing.current) return
    finishing.current = true
    setSubmitting(true)
    try {
      setQuestions(await getQuestionsByPaper(result.paperId))
      setSession(result)
      setNotice('')
      setError('')
    } catch (e) {
      setError(`无法打开成绩：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      finishing.current = false
      setSubmitting(false)
    }
  }

  const totalAnswered = summaries.reduce((n, s) => n + s.answered, 0)
  const totalUnanswered = summaries.reduce((n, s) => n + s.unanswered, 0)
  const totalSeconds = summaries.reduce((n, s) => n + s.seconds, 0)

  const examItems: ScoredItem[] = sections.flatMap(s => s.questions.flatMap(q => {
    const a = answers.get(q.id!)
    const grade = session?.grades?.[q.id!]
    const objective = q.options.length > 0
    if (grade === 'excluded') return []
    return [{
      questionId: q.id!, qtype: q.qtype, objective,
      answered: objective && (grade ? grade !== 'unanswered' : a?.selected !== undefined),
      correct: objective && (grade ? grade === 'correct' : a?.selected === q.answerIndex),
      subjectiveAnswered: !objective && (grade ? grade === 'written' : !!a?.text?.trim()),
    }]
  }))
  const examScore = scoreItems(examItems)
  const excluded = Object.values(session?.grades ?? {}).filter(grade => grade === 'excluded').length
  const preset = mode === 'practice' ? undefined : EXAM_PROFILES[mode]
  const activePreset = session?.mode && session.mode !== 'practice' ? EXAM_PROFILES[session.mode] : undefined
  const incomplete = activePreset?.sections.some(spec => sections.find(s => s.key === spec.key)?.questionIds.length !== spec.count)

  // P7（#15）：考试进行中的答题卡状态——只显示已答/未答，不泄露对错（P6 口径：
  // “考试模式不显示对错”）；写作题只显示已写/未写。
  const runningCardStates: AnswerCardState[] = currentSection
    ? currentSection.questions.map((q) => {
        const a = answers.get(q.id as number)
        const objective = q.options.length > 0
        if (!objective) {
          return (a?.text?.trim() ?? '') !== '' ? 'subjective-answered' : 'subjective-unanswered'
        }
        return a?.selected === undefined ? 'unanswered' : 'answered'
      })
    : []

  return (
    <>
      <button type="button" className="secondary garden-back" disabled={submitting || unsaved.current.size > 0}
        onClick={() => void leaveExam()}>
        ← 返回首页
      </button>
      <h1>模拟考试</h1>
      <p>整场模考连续计时。离开页面也会继续计时，单科练习可主动暂停。</p>

      {error && <p className="fail" role="alert">{error}</p>}
      {notice && <p className="note" role="status">{notice}</p>}
      {unsaved.current.size > 0 && (
        <button type="button" className="secondary" disabled={submitting} onClick={() => void retryAnswers()}>
          重试未保存答案
        </button>
      )}
      {ready && stage !== 'running' && history.length > 0 && (
        <details>
          <summary>历史成绩（{history.length} 场）</summary>
          <ul>
            {history.map(result => (
              <li key={result.id}>
                <button type="button" className="secondary" disabled={submitting}
                  onClick={() => void openResult(result)}>
                  {papers.find(p => p.id === result.paperId)?.title ?? '试卷'} · {new Date(result.updatedAt).toLocaleString()}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!ready && !error && <p>正在读取考试进度……</p>}

      {ready && stage === 'setup' && (
        <>
          {papers.length === 0 ? (
            <p>还没有试卷。先在“练习”页导入试卷 JSON，再回来模拟考试。</p>
          ) : (
            <>
              <p>
                选择试卷：
                <select
                  aria-label="选择试卷"
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
              <fieldset className="garden-exam-options">
                <legend>考试类型</legend>
                {(Object.keys(EXAM_PROFILES) as (keyof typeof EXAM_PROFILES)[]).map(key => (
                  <label key={key}>
                    <input type="radio" name="exam-mode" checked={mode === key} onChange={() => setMode(key)} />
                    {EXAM_PROFILES[key].label} 整场模考
                  </label>
                ))}
                <label>
                  <input type="radio" name="exam-mode" checked={mode === 'practice'} onChange={() => setMode('practice')} />
                  自定义练习
                </label>
              </fieldset>
              {preset ? (
                <p>
                  {preset.sections.map(sec => `${SECTION_TYPES[sec.key]} ${sec.minutes} 分钟`).join(' → ')}。
                  采用所选考试的答题时长，科目间连续计时。试卷题量不足时会标明。
                  {' '}<a href="https://www.niied.go.kr/convert/preview/1764681501492/index.html" target="_blank" rel="noreferrer">NIIED 考试规则</a>
                </p>
              ) : (
                <fieldset className="garden-exam-options">
                  <legend>练习科目与时长</legend>
                  <label>
                    <input type="radio" name="exam-scope" checked={scope === undefined} onChange={() => setScope(undefined)} />
                    试卷中的所有可用科目
                  </label>
                  {(Object.keys(SECTION_TYPES) as SectionKey[]).map(key => (
                    <div key={key}>
                      <label>
                        <input type="radio" name="exam-scope" checked={scope === key} onChange={() => setScope(key)} />
                        只练{SECTION_TYPES[key]}
                      </label>{' '}
                      <label>
                        {SECTION_TYPES[key]}时长{' '}
                        <input type="number" min={1} max={600} value={durations[key]}
                          onChange={e => setDuration(key, Number(e.target.value))} style={{ width: 72 }} /> 分钟
                      </label>
                    </div>
                  ))}
                </fieldset>
              )}
              <p>
                <button type="button" onClick={() => void startExam()} disabled={submitting}>
                  开始模拟考试
                </button>
              </p>
              <p>
                模拟考试按试卷的听力 / 阅读 / 写作题分组计时；词汇 / 语法 /
                其他题型的题不计入本次模拟。客观题答案在环节结束时写入答题记录，
                待核实的客观题可作答，暂不计分。写作记为待自评。
              </p>
            </>
          )}
        </>
      )}

      {stage === 'running' && currentSection && current && (
        <ListeningFilesProvider key={session?.id}>
          <h2>
            {selectedPaper?.title ?? ''} · {currentSection.label}环节（#14）
          </h2>
          <p className="garden-band garden-clock">
            环节 {sectionIdx + 1} / {sections.length} · 剩余 {formatSeconds(secondsLeft)}
            （本环节 {currentSection.minutes} 分钟） · 第 {questionIdx + 1} /{' '}
            {currentSection.questions.length} 道
          </p>
          {incomplete && <p className="note">这份试卷的题量与所选考试规格不一致，本场按标准时间练习。</p>}
          {pausedAt !== undefined && <p role="status">单科练习已暂停。</p>}
          {session && canPauseExam(session) && (
            <button type="button" className="secondary" disabled={submitting || expired} onClick={() => void togglePause()}>
              {pausedAt === undefined ? '暂停单科练习' : '继续单科练习'}
            </button>
          )}
          {otherCount > 0 && (
            <p>本场另有 {otherCount} 道题未纳入本次所选科目。</p>
          )}
          <p>
            题型 {current.qtype} · 难度 {current.difficulty} · 来源 {current.source} · 核实状态{' '}
            {current.status}
            {isObjective && !isVerifiedObjective(current) && ' · 答案待核实，不参与自动评分'}
          </p>
          <AnswerCard
            title={`答题卡（#15）· ${currentSection.label}环节`}
            states={runningCardStates}
            current={questionIdx}
            onJump={submitting || expired || pausedAt !== undefined ? undefined : goToQuestion}
          />

          {current.qtype === '听力' && <ListeningAudio key={current.id} question={current} />}

          {isObjective ? (
            <div className="note">
              <p style={{ fontSize: 17 }}>{current.stem}</p>
              {current.options.map((opt, i) => {
                const chosen = currentChoice === i
                return (
                  <p key={i}>
                    <button
                      type="button"
                      className={chosen ? undefined : 'secondary'}
                      disabled={submitting || expired || pausedAt !== undefined}
                      onClick={() => void setAnswer(current.id!, { selected: i }).catch(() => undefined)}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                    </button>
                  </p>
                )
              })}
              <p>
                {currentChoice !== undefined
                  ? `${unsavedChoice === undefined ? '已选' : '待保存'}：${String.fromCharCode(65 + currentChoice)}`
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
                onSave={(text, seconds) => setAnswer(current.id!, { text, seconds })}
                onDraftChange={(text, seconds) => setAnswer(current.id!, { text, seconds }).catch(() => undefined)}
                locked={submitting || expired || pausedAt !== undefined}
                showReference={false}
                onSkip={() => {
                  if (questionIdx + 1 < currentSection.questions.length) {
                    goToQuestion(questionIdx + 1)
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
              disabled={submitting || expired || pausedAt !== undefined || questionIdx === 0}
              onClick={() => goToQuestion(questionIdx - 1)}
            >
              上一题
            </button>{' '}
            <button
              type="button"
              className="secondary"
              disabled={submitting || expired || pausedAt !== undefined || questionIdx + 1 >= currentSection.questions.length}
              onClick={() => goToQuestion(questionIdx + 1)}
            >
              下一题
            </button>{' '}
            <button type="button" onClick={() => void finishSection(false)} disabled={submitting || pausedAt !== undefined}>
              {sectionIdx + 1 < sections.length ? '进入下一环节' : '结束考试'}
            </button>{' '}
            <button
              type="button"
              className="secondary"
              disabled={submitting || unsaved.current.size > 0}
              onClick={() => void leaveExam()}
            >
              返回首页（保留考试进度）
            </button>
          </p>
        </ListeningFilesProvider>
      )}

      {stage === 'done' && (
        <>
          <h2>成绩（#15）</h2>
          <p>
            {selectedPaper?.title ?? ''} · 本次模拟已完成。客观题自动判分；写作题不自动判分、
            标“待自评”，请对照参考答案自评。
          </p>
          <p>结果供学习参考。正式等级和分数以 TOPIK 官方成绩为准。</p>
          {incomplete && <p className="note">本场题量与所选考试规格不一致。</p>}
          {excluded > 0 && <p>有 {excluded} 道客观题的答案待核实，已排除在自动评分之外。</p>}
          <h3>自动计分（客观题）</h3>
          <GardenTableScroll label="模考科目成绩">
            <table>
              <thead>
                <tr>
                  <th>项目</th>
                  <th>数量</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>客观题总数</td>
                  <td>{examScore.total} 道</td>
                </tr>
                <tr>
                  <td>已答</td>
                  <td>{examScore.answered} 道</td>
                </tr>
                <tr>
                  <td>答对</td>
                  <td>{examScore.correct} 道</td>
                </tr>
                <tr>
                  <td>答错</td>
                  <td>{examScore.wrong} 道</td>
                </tr>
                <tr>
                  <td>未答</td>
                  <td>{examScore.unanswered} 道</td>
                </tr>
                <tr>
                  <td>正确率（答对 ÷ 已答）</td>
                  <td>{examScore.accuracy === null ? '—（本次没答客观题）' : `${examScore.accuracy}%`}</td>
                </tr>
                <tr>
                  <td>主观题（写作）</td>
                  <td>
                    已写 {examScore.subjectiveAnswered} / {examScore.subjectiveTotal} 道 · 待自评，不计正确率
                  </td>
                </tr>
              </tbody>
            </table>
          </GardenTableScroll>
          {examScore.byQtype.length > 0 && (
            <>
              <h3>按题型分项</h3>
              <GardenTableScroll label="模考错题">
                <table>
                  <thead>
                    <tr>
                      <th>题型</th>
                      <th>客观题答对 / 已答 / 总数</th>
                      <th>正确率</th>
                      <th>主观题已写 / 总数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examScore.byQtype.map((row) => (
                      <tr key={row.qtype}>
                        <td>{row.qtype}</td>
                        <td>
                          {row.correct} / {row.answered} / {row.total}
                        </td>
                        <td>{row.accuracy === null ? '—' : `${row.accuracy}%`}</td>
                        <td>
                          {row.subjectiveAnswered} / {row.subjectiveTotal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GardenTableScroll>
            </>
          )}
          <h3>答题回顾（考后才显示对错）</h3>
          {sections.map((s) => (
            <AnswerCard
              key={s.key}
              title={`答题卡回顾 · ${s.label}环节`}
              states={s.questions.map((q) => {
                const it = examItems.find((x) => x.questionId === q.id)
                if (!it) return session?.grades?.[q.id!] === 'excluded' ? 'excluded' : 'unanswered'
                if (!it.objective) return it.subjectiveAnswered ? 'subjective-answered' : 'subjective-unanswered'
                if (!it.answered) return 'unanswered'
                return it.correct ? 'correct' : 'wrong'
              })}
              current={-1}
            />
          ))}
          <h3>用时摘要（#14）</h3>
          <GardenTableScroll label="写作答卷">
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
          </GardenTableScroll>
          <p>
            <button
              type="button"
              onClick={() => {
                setSession(undefined)
                setQuestions([])
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
