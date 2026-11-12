import { studyEventDate } from '../lib/streak'
import { GardenTableScroll } from '../components/GardenUI'
import { useEffect, useRef, useState } from 'react'
import { clearAllWritingJournals, completeWritingDraft } from '../lib/writing'
import { useWritingDraft } from '../lib/use-writing-draft'
import { MANUSCRIPT_GUIDE, WRITING_GUIDE, writingCounts, writingForm, type WritingDraft } from '../lib/writing-model'
import { liveQuery } from 'dexie'
import {
  addAttempt,
  clearQuestionBank,
  getAllAttempts,
  getAllPapers,
  getAllQuestions,
  getFavoriteQuestions,
  getLatestWritingAttempt,
  getQuestionById,
  getQuestionsByPaper,
  getWrongQuestionIds,
  importQuestionBank,
  previewQuestionBankImport,
  QuestionBankPreviewChanged,
  setQuestionFavorite,
  type Paper,
  type Question,
  type QuestionBankImportPreview,
} from '../lib/db'
import { isVerifiedObjective, scoreItems, type ScoredItem, type ScoreSummary } from '../lib/scoring'
import ListeningAudio, { ListeningFilesProvider } from '../components/ListeningAudio'
import AnswerCard, { type AnswerCardState } from './AnswerCard'

// TOPIK MASTER 2027 — 练习页（P5：#9 试卷练习、#17 题目解析与来源标记、#10 随机题目练习；
// P6：#11 听力音频、#12 阅读计时、#13 写作练习；
// P7：#15 答题卡与自动计分（本次练习的答题卡 + 实时成绩 + 交卷成绩页）；#16 错题复练在
// WrongQuestions.tsx（本页随机抽题保留“仅错题”范围））
// 题库出厂是空的：首批题目来源已定为“官方真题本地导入”——用户从 topik.go.kr
// 下载官方真题后发来，再做成导入格式；本阶段不编造任何题目、不写任何真题或
// 自编题进仓库。本页只搭模型、导入器与练习流程。
// 铁律：自编题一律标“自编练习题，非官方真题”；“官方真题”四个字只出现在
// “官方真题本地导入 / 官方下载链接”这类说明性文字里，绝不出现在题目内容里。

type SessionMode = 'paper' | 'random' | 'favorite' | 'single'
type Scope = 'all' | 'wrong' | 'unanswered'

const QTYPE_OPTIONS = ['全部', '听力', '阅读', '写作', '词汇', '语法', '其他']
const DIFFICULTY_OPTIONS = ['全部', '易', '中', '难']
const UNLABELED_LEVEL = 'unlabeled'
const paperLevel = (paper?: Paper) => paper?.level.trim() ? `level:${paper.level.trim()}` : UNLABELED_LEVEL

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const WRITING_CHECKLIST = [
  '结构完整（开头—正文—结尾）',
  '语法正确，没有明显语病',
  '词汇准确，没有生造词',
  '字数符合要求',
  '通读一遍，没有漏词错字',
]

function loadChecklist(questionId: number): boolean[] {
  try {
    const raw = localStorage.getItem(`topik-master-writing-checklist-${questionId}`)
    if (!raw) return WRITING_CHECKLIST.map(() => false)
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return WRITING_CHECKLIST.map(() => false)
    return WRITING_CHECKLIST.map((_, i) => parsed[i] === true)
  } catch {
    return WRITING_CHECKLIST.map(() => false)
  }
}

/**
 * 写作卡片（P6 #13，Practice 与 MockExam 共用）。
 * 字数 = 去掉空白后的字符数；用时 = 本卡片打开后经过的秒数（页面内计时）；
 * 自查清单存在本机 localStorage；保存时把全文与用时交给 onSave——
 * Practice 里 onSave 写 attempts（主观题，不计正确率），MockExam 里 onSave
 * 只记进本次考试的答案状态，到环节结束再统一写 attempts。
 */
export function WritingCard({
  question,
  initialText,
  onSave,
  onDraftChange,
  practiceDraft = false,
  locked = false,
  showReference,
  onSkip,
}: {
  question: Question
  initialText: string
  onSave: (text: string, seconds: number, draft?: WritingDraft) => Promise<void>
  onDraftChange?: (text: string, seconds: number) => Promise<void>
  practiceDraft?: boolean
  locked?: boolean
  showReference: boolean
  onSkip?: () => void
}) {
  const [text, setText] = useState(initialText)
  const [elapsed, setElapsed] = useState(0)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const savingRef = useRef(false)
  const draftRevision = useRef(0)
  const draft = useWritingDraft(question, practiceDraft)
  const [checklist, setChecklist] = useState<boolean[]>(() =>
    question.id === undefined ? WRITING_CHECKLIST.map(() => false) : loadChecklist(question.id),
  )
  // 用户是否已在本卡片里打过字：打过字后，异步读到的初始文案不再覆盖输入框。
  const touchedRef = useRef(false)

  useEffect(() => {
    touchedRef.current = false
    setText(initialText)
    setElapsed(0)
    setSaved(false)
    setSaveError('')
    draftRevision.current += 1
    setChecklist(
      question.id === undefined ? WRITING_CHECKLIST.map(() => false) : loadChecklist(question.id),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id])

  // 初始文案是异步读到的（重进本题时从 attempts 恢复最新一次保存的答案）：
  // 读到后再同步进输入框；若用户已经开始打字则不覆盖。
  useEffect(() => {
    if (!touchedRef.current) setText(draft.initial?.text ?? initialText)
  }, [initialText, draft.initial])

  useEffect(() => {
    if (saved) return
    const start = Date.now()
    const t = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 500)
    return () => window.clearInterval(t)
  }, [saved])

  const counts = writingCounts(text)
  const form = practiceDraft ? writingForm(question.order) : undefined
  const short = !!form && !form.range
  const firstLine = text.split('\n', 1)[0] ?? ''
  const secondLine = text.includes('\n') ? text.slice(firstLine.length + 1) : ''
  const blocked = saving || locked || !draft.ready

  const changeText = (next: string) => {
    const revision = ++draftRevision.current
    touchedRef.current = true
    setText(next)
    setSaved(false)
    setSaveError('')
    if (practiceDraft) void draft.persist(next, elapsed)
    if (onDraftChange) void onDraftChange(next, elapsed).catch((error: unknown) => {
      if (revision === draftRevision.current) setSaveError(`草稿未保存：${error instanceof Error ? error.message : String(error)}。输入仍在，请重试。`)
    })
  }

  const toggleCheck = (i: number) => {
    setChecklist((prev) => {
      const next = prev.map((v, j) => (j === i ? !v : v))
      if (question.id !== undefined) {
        try {
          localStorage.setItem(
            `topik-master-writing-checklist-${question.id}`,
            JSON.stringify(next),
          )
        } catch {
          /* localStorage 写失败不阻塞写作 */
        }
      }
      return next
    })
  }

  const handleSave = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    try {
      const prepared = practiceDraft ? draft.prepare(text, elapsed) : undefined
      await onSave(text, elapsed, prepared)
      if (prepared) draft.markSaved(prepared)
      setSaved(true)
    } catch (e) {
      setSaved(false)
      setSaveError(`保存失败：${e instanceof Error ? e.message : String(e)}。输入内容仍在，可复制或重试。`)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="note garden-writing-editor">
      <p className="garden-writing-meta">
        <b>{form ? `第 ${question.order} 题 · ${form.title}` : '写作练习（#13）'}</b> · 字数：{counts.visible}（不计空格） · 本次用时：{formatSeconds(elapsed)}
      </p>
      {form && <p>{form.instruction} <a href={WRITING_GUIDE} target="_blank" rel="noreferrer">官方题型说明</a></p>}
      {short ? <>
        <p><label>空格 ㉠ <input type="text" lang="ko" value={firstLine} disabled={blocked} onChange={event => changeText(`${event.target.value}\n${secondLine}`)} /></label></p>
        <p><label>空格 ㉡ <input type="text" lang="ko" value={secondLine} disabled={blocked} onChange={event => changeText(`${firstLine}\n${event.target.value}`)} /></label></p>
        <p>客观检查：已填写 {[firstLine, secondLine].filter(line => line.trim()).length} / 2 空。句意与语法需自查。</p>
      </> : <p>
        <textarea
          aria-label="写作答案"
          lang="ko"
          value={text}
          disabled={blocked}
          onChange={(event) => changeText(event.target.value)}
          rows={8}
          style={{ width: '100%' }}
          placeholder={practiceDraft ? '在这里用韩语写答案……（自动保存草稿）' : '在这里用韩语写答案……'}
        />
      </p>}
      {form?.range && <p>客观检查：目标 {form.range[0]}–{form.range[1]} 字，当前约 {counts.approximate} 字（含空格，不计换行）。
        {counts.approximate < form.range[0] ? '低于参考范围。' : counts.approximate > form.range[1] ? '超过参考范围。' : '在参考范围内。'}
        {' '}<a href={MANUSCRIPT_GUIDE} target="_blank" rel="noreferrer">按官方稿纸规则复核</a>
      </p>}
      {practiceDraft && <p aria-live="polite">{draft.ready ? draft.status || '开始输入后会自动保存草稿。' : '正在读取草稿……'}</p>}
      {draft.error && <p className="fail" role="alert">{draft.error} <button type="button" disabled={blocked} onClick={() => void draft.persist(text, elapsed)}>重试草稿保存</button></p>}
      <p>自查清单：</p>
      {WRITING_CHECKLIST.map((item, i) => (
        <p key={item}>
          <label>
            <input type="checkbox" checked={checklist[i]} onChange={() => toggleCheck(i)} />{' '}
            {item}
          </label>
        </p>
      ))}
      <p>
        <button type="button" onClick={() => void handleSave()} disabled={blocked || saved || text.trim() === '' || (short && (!firstLine.trim() || !secondLine.trim()))}>
          {saved ? '已保存' : '保存答案'}
        </button>{' '}
        {practiceDraft && text && <button type="button" className="secondary" disabled={blocked} onClick={() => {
          if (!window.confirm('删除这份草稿？已保存的历史版本和自评会保留。')) return
          setSaving(true)
          void draft.persist('', 0).then(deleted => {
            if (deleted) { touchedRef.current = true; setText(''); setSaved(false) }
          }).finally(() => setSaving(false))
        }}>删除草稿</button>}{' '}
        {onSkip && (
          <button type="button" className="secondary" onClick={onSkip}>
            跳过本题
          </button>
        )}
      </p>
      {saveError && <p className="fail" role="alert">{saveError}</p>}
      {saved && <p role="status">已保存：答案与用时已记录，刷新后还在。</p>}
      {showReference && saved && (
        <>
          {question.answer && (
            <p>
              参考答案：{question.answer}
            </p>
          )}
          {question.explanation && (
            <p>
              解析：{question.explanation}
            </p>
          )}
          <p>
            来源：{question.source} · 核实状态：{question.status}
          </p>
        </>
      )}
      {showReference && !saved && (
        <p>保存答案后可查看参考答案与解析（写作不自动判分）。</p>
      )}
    </div>
  )
}

export default function Practice({
  onBack,
  initialQtype,
  initialMode,
  initialQuestion,
}: {
  onBack: () => void
  /** hash 参数 ?qtype=听力/阅读/写作：预选随机练习的题型筛选。 */
  initialQtype?: string
  /** hash 参数 ?mode=random：进入后定位到随机抽题区。 */
  initialMode?: string
  initialQuestion?: string
}) {
  const [papers, setPapers] = useState<Paper[]>([])
  const [paperCounts, setPaperCounts] = useState<Map<number, { total: number; subjectTotal: number; subjectAnswered: number }>>(new Map())
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [totalAttempts, setTotalAttempts] = useState(0)
  const [totalScored, setTotalScored] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [sessionMode, setSessionMode] = useState<SessionMode | null>(null)
  const [sessionPaper, setSessionPaper] = useState<Paper | null>(null)
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [showReference, setShowReference] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [favoriteQuestions, setFavoriteQuestions] = useState<Question[]>()
  const [favoriteError, setFavoriteError] = useState('')
  const [savingFavorite, setSavingFavorite] = useState(false)
  const [pendingImport, setPendingImport] = useState<{
    name: string; text: string; preview: QuestionBankImportPreview
  } | null>(null)
  const [importResult, setImportResult] = useState<QuestionBankImportPreview | null>(null)
  const [importPhase, setImportPhase] = useState<'preview' | 'saving' | null>(null)
  const [importError, setImportError] = useState('')
  const [randomQtype, setRandomQtype] = useState(
    initialQtype !== undefined && QTYPE_OPTIONS.includes(initialQtype) ? initialQtype : '全部',
  )
  const [randomDifficulty, setRandomDifficulty] = useState('全部')
  const [randomLevel, setRandomLevel] = useState('')
  const [randomScope, setRandomScope] = useState<Scope>('all')
  const [randomCount, setRandomCount] = useState(5)
  const [randomNote, setRandomNote] = useState('')
  // P6：写作卡片状态（初始文案来自最新一次保存的答案，刷新后还在）与阅读计时。
  const [writingInitial, setWritingInitial] = useState('')
  const [writingPrevSeconds, setWritingPrevSeconds] = useState(0)
  const [writingSaved, setWritingSaved] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [timeUp, setTimeUp] = useState(false)
  // P7（#15）：本次练习的作答记录（题 id → 本次作答状态），答题卡与成绩都从它算；
  // 交卷后显示成绩页（showSummary）。退出/重练时清空。
  const [sessionAnswers, setSessionAnswers] = useState<
    Map<number, { selected: number | null; correct: boolean | null; submitted: boolean; subjectiveAnswered: boolean }>
  >(new Map())
  const [showSummary, setShowSummary] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const subject = initialQtype !== undefined && initialQtype !== '全部' && QTYPE_OPTIONS.includes(initialQtype)
    ? initialQtype
    : undefined
  const paperLevels = [...new Set(papers.map(paper => paper.level.trim()).filter(Boolean))].sort()

  const refresh = async () => {
    const [ps, qs, attempts] = await Promise.all([getAllPapers(), getAllQuestions(), getAllAttempts()])
    setPapers(ps)
    setTotalQuestions(qs.length)
    const counts = new Map<number, { total: number; subjectTotal: number; subjectAnswered: number }>()
    const answered = new Set(attempts.map(attempt => attempt.questionId))
    for (const q of qs) {
      if (q.paperId === undefined) continue
      const stats = counts.get(q.paperId) ?? { total: 0, subjectTotal: 0, subjectAnswered: 0 }
      stats.total += 1
      if (q.qtype === subject) {
        stats.subjectTotal += 1
        if (q.id !== undefined && answered.has(q.id)) stats.subjectAnswered += 1
      }
      counts.set(q.paperId, stats)
    }
    setPaperCounts(counts)
    const questionIds = new Set(qs.map(question => question.id))
    const objective = attempts.filter(attempt => !attempt.subjective && questionIds.has(attempt.questionId) &&
      studyEventDate(attempt.answeredAt))
    const verified = new Set(qs.filter(isVerifiedObjective).map(question => question.id))
    const scored = objective.filter(attempt => verified.has(attempt.questionId))
    setTotalAttempts(objective.length)
    setTotalScored(scored.length)
    setTotalCorrect(scored.filter(attempt => attempt.correct).length)
  }

  const current = sessionQuestions.length > 0 ? sessionQuestions[currentIdx] : null
  const isObjective = current !== null && current.options.length > 0
  const isWriting = current !== null && current.qtype === '写作' && !isObjective
  const currentFavorite = favoriteQuestions?.some(question => question.id === current?.id) ?? false
  const attemptPaperId = sessionMode === 'favorite' || sessionMode === 'single' ? current?.paperId : sessionPaper?.id
  const practiceTitle = sessionMode === 'paper'
    ? `${subject ? subject + '专项' : '试卷'}练习：${sessionPaper?.title ?? ''}`
    : sessionMode === 'favorite' ? '收藏题练习' : sessionMode === 'single' ? '单题练习' : '随机题目练习'

  // P7（#15）：本次练习的计分项与答题卡状态（都从 sessionAnswers 算，不读历史答题记录——
  // 卡片只反映“本次练习”的已答/未答/对错；历史正确率在练习首页另有统计）。
  const sessionItems: ScoredItem[] = sessionQuestions.map((q) => {
    const a = sessionAnswers.get(q.id as number)
    const objective = q.options.length > 0
    return {
      questionId: q.id as number,
      qtype: q.qtype,
      objective,
      answered: objective ? (a?.submitted ?? false) : false,
      correct: objective ? (a?.correct ?? false) : false,
      subjectiveAnswered: !objective ? (a?.subjectiveAnswered ?? false) : false,
    }
  })
  const unverified = new Set(sessionQuestions.filter(q => q.options.length > 0 && !isVerifiedObjective(q)).map(q => q.id))
  const sessionScore: ScoreSummary = scoreItems(sessionItems.filter(item => !unverified.has(item.questionId)))
  const cardStates: AnswerCardState[] = sessionItems.map((it) => {
    if (unverified.has(it.questionId)) return 'excluded'
    if (!it.objective) return it.subjectiveAnswered ? 'subjective-answered' : 'subjective-unanswered'
    if (!it.answered) return 'unanswered'
    return it.correct ? 'correct' : 'wrong'
  })

  /** 跳到第 idx 道题，并把该题在本练习里的作答状态恢复进卡片（已答过的题显示结果与解析）。 */
  const goToQuestion = (idx: number) => {
    setCurrentIdx(idx)
    const q = sessionQuestions[idx]
    const a = q?.id !== undefined ? sessionAnswers.get(q.id) : undefined
    setSelected(a?.selected ?? null)
    setSubmitted(a?.submitted ?? false)
    setLastCorrect(a?.correct ?? null)
    setWritingSaved(a?.subjectiveAnswered ?? false)
  }

  // P6：当前是写作题时，读最新一次保存的答案做初始文案（刷新后答案还在）。
  useEffect(() => {
    let cancelled = false
    if (current && isWriting && current.id !== undefined) {
      void getLatestWritingAttempt(current.id).then((a) => {
        if (cancelled) return
        setWritingInitial(a?.selectedAnswer ?? '')
        setWritingPrevSeconds(a?.writingSeconds ?? 0)
      })
    } else {
      setWritingInitial('')
      setWritingPrevSeconds(0)
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  // P6：阅读题限时倒计时（timeLimit 分钟；时间戳算剩余，不靠累加，页面切走不丢）。
  // 无 timeLimit 的题不计时。时间到只明确提示，不强制锁题（练习模式）。
  useEffect(() => {
    if (current && current.qtype === '阅读' && current.timeLimit) {
      const end = Date.now() + current.timeLimit * 60000
      setTimeLeft(current.timeLimit * 60)
      setTimeUp(false)
      const t = window.setInterval(() => {
        const left = Math.max(0, Math.round((end - Date.now()) / 1000))
        setTimeLeft(left)
        if (left <= 0) {
          setTimeUp(true)
          window.clearInterval(t)
        }
      }, 500)
      return () => window.clearInterval(t)
    }
    setTimeLeft(null)
    setTimeUp(false)
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const subscription = liveQuery(() => getFavoriteQuestions()).subscribe({
      next: setFavoriteQuestions,
      error: () => setFavoriteError('无法读取题目收藏，请重新打开练习页。'),
    })
    return () => subscription.unsubscribe()
  }, [])

  // hash 参数 ?mode=random：进入后定位到随机抽题区（该区平时在试卷列表下方）。
  useEffect(() => {
    if (initialMode === 'random') {
      document.getElementById('random-practice')?.scrollIntoView()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetCard = () => {
    setSelected(null)
    setSubmitted(false)
    setLastCorrect(null)
    setShowReference(false)
    setWritingSaved(false)
  }

  /** P7：开一场新的练习（或退出）时清空本次作答记录与成绩页。 */
  const resetSession = () => {
    setSessionAnswers(new Map())
    setShowSummary(false)
  }

  const startPaper = async (paper: Paper, unansweredOnly = false) => {
    setError('')
    let qs = await getQuestionsByPaper(paper.id as number)
    if (subject) qs = qs.filter(question => question.qtype === subject)
    if (unansweredOnly) {
      const answered = new Set((await getAllAttempts()).map(attempt => attempt.questionId))
      qs = qs.filter(question => question.id !== undefined && !answered.has(question.id))
    }
    if (qs.length === 0) {
      setError(`“${paper.title}”暂无${unansweredOnly ? '未作答的' : ''}${subject ?? ''}题目。`)
      return
    }
    setSessionPaper(paper)
    setSessionQuestions(qs)
    setCurrentIdx(0)
    setSessionMode('paper')
    resetSession()
    resetCard()
  }

  const startRandom = async () => {
    setError('')
    setRandomNote('')
    const all = await getAllQuestions()
    let pool = all.filter(question => !question.readingId)
    if (randomQtype !== '全部') pool = pool.filter((q) => q.qtype === randomQtype)
    if (randomDifficulty !== '全部') pool = pool.filter((q) => q.difficulty === randomDifficulty)
    if (randomLevel) {
      const byId = new Map((await getAllPapers()).map(paper => [paper.id, paper]))
      pool = pool.filter(question => paperLevel(byId.get(question.paperId)) === randomLevel)
    }
    if (randomScope === 'wrong') {
      const wrongIds = new Set(await getWrongQuestionIds())
      pool = pool.filter((q) => wrongIds.has(q.id as number))
    } else if (randomScope === 'unanswered') {
      const answered = new Set((await getAllAttempts()).map(attempt => attempt.questionId))
      pool = pool.filter((q) => !answered.has(q.id as number))
    }
    if (pool.length === 0) {
      setError('按当前筛选没有可抽的题目：换个筛选，或先导入题目。')
      return
    }
    const drawn = shuffle(pool).slice(0, Math.max(1, Math.min(randomCount, pool.length)))
    setSessionPaper(null)
    setSessionQuestions(drawn)
    setCurrentIdx(0)
    setSessionMode('random')
    resetSession()
    resetCard()
    setRandomNote(`已抽 ${drawn.length} 道（题库符合筛选共 ${pool.length} 道）。`)
  }

  const startSingleQuestion = (question: Question, mode: 'favorite' | 'single') => {
    setError('')
    setFavoriteError('')
    setSessionPaper(null)
    setSessionQuestions([question])
    setCurrentIdx(0)
    setSessionMode(mode)
    resetSession()
    resetCard()
  }

  useEffect(() => {
    if (initialQuestion === undefined) return
    let active = true
    const id = Number(initialQuestion)
    void (async () => {
      const question = /^[1-9]\d*$/.test(initialQuestion) && Number.isSafeInteger(id) ? await getQuestionById(id) : undefined
      if (!active) return
      if (question?.readingId) window.location.hash = `/reading?passage=${encodeURIComponent(question.readingId)}`
      else if (question) startSingleQuestion(question, 'single')
      else setError('这道题已不在题库中，可以返回搜索重新选择。')
    })().catch(() => {
      if (active) setError('无法读取题目，请重新打开练习页。')
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion])

  const changeFavorite = async (id: number, favorite: boolean) => {
    setFavoriteError('')
    setSavingFavorite(true)
    try {
      await setQuestionFavorite(id, favorite)
    } catch (e) {
      setFavoriteError(`收藏状态未保存：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSavingFavorite(false)
    }
  }

  const handleSubmit = async () => {
    if (!current || current.id === undefined || selected === null || submitted || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const correct = selected === current.answerIndex
      const qid = current.id
      await addAttempt({
        questionId: current.id,
        paperId: attemptPaperId,
        selectedAnswer: current.options[selected] ?? '',
        correct,
        answeredAt: new Date(),
      })
      // P7：记入本次练习的作答（答题卡与成绩用）。
      setSessionAnswers((prev) => {
        const next = new Map(prev)
        next.set(qid, { selected, correct, submitted: true, subjectiveAnswered: false })
        return next
      })
      setLastCorrect(correct)
      setSubmitted(true)
      await refresh()
    } catch (e) {
      setError(`记录答题失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  // P6：写作保存——答案存 attempts（subjective，不自动判分、不计正确率、不进错题范围）。
  const handleWritingSave = async (_text: string, _seconds: number, draft?: WritingDraft) => {
    if (!current || current.id === undefined || !draft) throw new Error('找不到当前写作题')
    const qid = current.id
    setError('')
    await completeWritingDraft(draft, attemptPaperId)
    setSessionAnswers((prev) => {
      const next = new Map(prev)
      next.set(qid, { selected: null, correct: null, submitted: false, subjectiveAnswered: true })
      return next
    })
    setWritingSaved(true)
    // 刷新统计失败不应把已经写入的答案说成保存失败。
    void refresh().catch(() => setError('答案已保存，但未能刷新统计。'))
  }

  const handleNext = () => {
    if (currentIdx + 1 < sessionQuestions.length) {
      // P7：跳题时恢复目标题在本练习里的作答状态（已答过的题显示结果与解析）。
      goToQuestion(currentIdx + 1)
    } else {
      // P7：最后一题答完 → 交卷看成绩（不直接退出）。
      setShowSummary(true)
    }
  }

  /** P7：退出本次练习（回到练习首页）。 */
  const exitSession = () => {
    setSessionMode(null)
    setSessionQuestions([])
    setSessionPaper(null)
    resetSession()
    resetCard()
    void refresh()
  }

  const handleFile = async (file: File | undefined) => {
    if (!file || importPhase) return
    setImportPhase('preview')
    setPendingImport(null)
    setImportResult(null)
    setImportError('')
    try {
      const text = await file.text()
      const preview = await previewQuestionBankImport(text)
      setPendingImport({ name: file.name, text, preview })
    } catch (e) {
      setImportError(`无法预览：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImportPhase(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    if (!pendingImport || importPhase) return
    setImportError('')
    setImportPhase('saving')
    try {
      const result = await importQuestionBank(pendingImport.text, undefined, pendingImport.preview)
      setPendingImport(null)
      setImportResult(result)
      void refresh().catch(() => setImportError('已导入，但题库计数未能刷新，请重新打开练习页。'))
    } catch (e) {
      if (e instanceof QuestionBankPreviewChanged) {
        setPendingImport({ ...pendingImport, preview: e.preview })
        setImportError(e.message)
      } else {
        setImportError(`导入失败，题库没有变更：${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      setImportPhase(null)
    }
  }

  const handleClear = async () => {
    if (!window.confirm('确定清空试卷题库吗？将清除独立题目、试卷作答与模考进度，阅读篇章及其作答会保留。')) {
      return
    }
    await clearQuestionBank()
    clearAllWritingJournals()
    setSessionMode(null)
    setSessionQuestions([])
    setSessionPaper(null)
    setPendingImport(null)
    setImportResult(null)
    setImportError('')
    await refresh()
  }

  const accuracy = totalScored > 0 ? Math.round((totalCorrect / totalScored) * 100) : null
  const importSummary = pendingImport?.preview ?? importResult
  const canImport = !!pendingImport && (pendingImport.preview.papersAdded > 0 || pendingImport.preview.questionsAdded > 0)

  return (
    <>
      <button type="button" className="secondary garden-back" onClick={onBack}>
        ← 返回首页
      </button>
      <h1>练习</h1>
      <p className="garden-band">
        试卷 {papers.length} 场 · 题目 {totalQuestions} 道 · 已答 {totalAttempts} 次
        {accuracy === null ? '' : ` · 正确率 ${accuracy}%（答对 ${totalCorrect} / ${totalScored} 道计分题）`}
      </p>

      {error && <p className="fail">{error}</p>}

      {sessionMode === null && (
        <>
          <p className="garden-navline"><a href="#/writing">按题型练习写作</a><a href="#/writing-history">写作历史与自评</a></p>
          {totalQuestions === 0 && (
            <div className="note">
              题库目前是空的。首批题目来源已定为<b>官方真题本地导入</b>：请从 TOPIK 官网下载官方真题后，
              用下方导入入口把试卷 JSON 导进来。本应用不内置、不打包任何官方真题文件；
              自编题（如以后有）会明确标“自编练习题，非官方真题”。
            </div>
          )}

          <h2>{subject ? `${subject}专项练习` : '试卷练习（#9）'}</h2>
          {subject && <p>选卷后只练{subject}题。进度按已保存的作答统计，同一题只计一次。</p>}
          {papers.length === 0 ? (
            <p>还没有试卷。导入试卷 JSON 后，这里会按场次列出练习卷。</p>
          ) : (
            <GardenTableScroll label="试卷列表">
              <table>
                <thead>
                  <tr>
                    <th>场次</th>
                    <th>级别</th>
                    <th>考试日期</th>
                    <th>来源</th>
                    <th>核实状态</th>
                    <th>{subject ? '已答 / 总题数' : '题数'}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {papers.map(p => {
                    const counts = paperCounts.get(p.id!)
                    const total = subject ? counts?.subjectTotal ?? 0 : counts?.total ?? 0
                    const answered = counts?.subjectAnswered ?? 0
                    return <tr key={p.id}>
                      <td>{p.title}</td>
                      <td>{p.level || '—'}</td>
                      <td>{p.examDate || '—'}</td>
                      <td>{p.source}</td>
                      <td>{p.status}</td>
                      <td>{subject ? `${answered} / ${total}` : total}</td>
                      <td>
                        <button type="button" disabled={total === 0} onClick={() => void startPaper(p)}>
                          开始练习
                        </button>
                        {subject && answered > 0 && answered < total && (
                          <button type="button" className="secondary" onClick={() => void startPaper(p, true)}>
                            练未答题
                          </button>
                        )}
                      </td>
                    </tr>
                  })}
                </tbody>
              </table>
            </GardenTableScroll>
          )}

          <section aria-labelledby="question-favorites">
            <h2 id="question-favorites">题目收藏夹</h2>
            {favoriteError && <p className="fail" role="alert">{favoriteError}</p>}
            {favoriteQuestions === undefined && !favoriteError && <p role="status">正在读取收藏题目……</p>}
            {favoriteQuestions?.length === 0 && <p>还没有收藏题目。练习时选择「收藏本题」，之后就能在这里复练。</p>}
            {favoriteQuestions && favoriteQuestions.length > 0 && (
              <ul>
                {favoriteQuestions.map(question => {
                  const answer = question.answerIndex === null
                    ? question.answer
                    : question.options[question.answerIndex]
                  return (
                    <li key={question.id}>
                      <p>{question.stem}</p>
                      <p>{question.qtype} · 来源 {question.source} · {question.status}</p>
                      <details>
                        <summary>查看答案与解析</summary>
                        <p>{question.answerIndex === null ? '参考答案' : '正确答案'}：{answer || '未提供'}</p>
                        <p>解析：{question.explanation || '未提供'}</p>
                      </details>
                      <p>
                        <button type="button" onClick={() => startSingleQuestion(question, 'favorite')}>练习此题</button>{' '}
                        <button type="button" className="secondary" disabled={savingFavorite}
                          onClick={() => void changeFavorite(question.id!, false)}>
                          取消收藏
                        </button>
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <h2 id="random-practice">随机题目练习（#10）</h2>
          <p>
            题型：
            <select value={randomQtype} onChange={(e) => setRandomQtype(e.target.value)}>
              {QTYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>{' '}
            <label>试卷等级{' '}
              <select value={randomLevel} onChange={event => setRandomLevel(event.target.value)}>
                <option value="">全部等级</option>
                {paperLevels.map(level => <option key={level} value={`level:${level}`}>{level}</option>)}
                <option value={UNLABELED_LEVEL}>未标注等级</option>
              </select>
            </label>{' '}
            难度：
            <select value={randomDifficulty} onChange={(e) => setRandomDifficulty(e.target.value)}>
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>{' '}
            范围：
            <select value={randomScope} onChange={(e) => setRandomScope(e.target.value as Scope)}>
              <option value="all">全部题目</option>
              <option value="wrong">仅错题</option>
              <option value="unanswered">仅未答</option>
            </select>{' '}
            抽
            <input
              type="number"
              min={1}
              max={20}
              value={randomCount}
              onChange={(e) => setRandomCount(Number(e.target.value) || 5)}
              style={{ width: 56 }}
            />{' '}
            道{' '}
            <button type="button" onClick={() => void startRandom()}>
              随机抽题
            </button>
          </p>
          {randomNote && <p>{randomNote}</p>}

          <h2>导入试卷（官方真题本地导入）</h2>
          <div className="note">
            官方真题请先从{' '}
            <a href="https://www.topik.go.kr" target="_blank" rel="noreferrer">
              TOPIK 官网（topik.go.kr）学习资料室
            </a>{' '}
            下载，再按下方格式做成 JSON 导入。本应用不提供官方文件下载、不打包官方 PDF / MP3 进仓库。
            导入格式：<code>{'{ papers: [...], questions: [...] }'}</code>，字段说明见 ACCEPTANCE.md P5 一节。
            校验规则：题干、来源、题型缺一不可，缺来源的条目拒绝入库并报错；客观题 answerIndex 必须在选项范围内。
          </div>
          <p>
            <input
              ref={fileRef}
              type="file"
              aria-label="选择题库 JSON 文件"
              accept=".json,application/json"
              disabled={importPhase !== null}
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </p>
          {importPhase === 'preview' && <p role="status">正在检查导入文件……</p>}
          {importError && <p className="fail" role="alert">{importError}</p>}
          {importSummary && (
            <div className="note">
              <h3>{pendingImport ? '题库导入预览' : '题库导入结果'}</h3>
              <p role="status">
                {pendingImport ? `“${pendingImport.name}”预计` : '导入完成。'}
                新增试卷 {importSummary.papersAdded} 场（复用 {importSummary.papersReused} 场）、
                新增题目 {importSummary.questionsAdded} 道、重复题目 {importSummary.duplicateQuestionRows.length} 道、
                冲突 {importSummary.issues.filter(issue => issue.kind === 'conflict').length} 条、
                无效 {importSummary.issues.filter(issue => issue.kind === 'invalid').length} 条、
                跳过空试卷 {importSummary.issues.filter(issue => issue.kind === 'empty-paper').length} 场。
              </p>
              {importSummary.issues.length > 0 && (
                <ul>
                  {importSummary.issues.map(issue => (
                    <li key={`${issue.collection}-${issue.row}-${issue.kind}`}>{issue.message}</li>
                  ))}
                </ul>
              )}
              {pendingImport && (
                <>
                  <p>{canImport ? '确认后只导入可新增的试卷与题目。' : '没有可新增的内容，本次无需导入。'}</p>
                  <button type="button" disabled={!canImport || importPhase !== null} onClick={() => void confirmImport()}>
                    {importPhase === 'saving' ? '正在导入……' : '确认导入'}
                  </button>{' '}
                  <button type="button" className="secondary" disabled={importPhase !== null} onClick={() => {
                    setPendingImport(null)
                    setImportError('')
                  }}>
                    取消预览
                  </button>
                </>
              )}
            </div>
          )}

          <h2>题库管理</h2>
          <p>
            <button type="button" className="secondary" disabled={importPhase !== null} onClick={() => void handleClear()}>
              清空试卷题库（保留独立阅读篇章）
            </button>
          </p>
        </>
      )}

      {sessionMode !== null && showSummary && (
        <>
          <h2>本次练习成绩（#15）</h2>
          <p>
            {practiceTitle}
            · 客观题自动判分，写作题不自动判分（待自评）。
          </p>
          <GardenTableScroll label="本次练习成绩明细">
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
                  <td>{sessionScore.total} 道</td>
                </tr>
                <tr>
                  <td>已答</td>
                  <td>{sessionScore.answered} 道</td>
                </tr>
                <tr>
                  <td>答对</td>
                  <td>{sessionScore.correct} 道</td>
                </tr>
                <tr>
                  <td>答错</td>
                  <td>{sessionScore.wrong} 道</td>
                </tr>
                <tr>
                  <td>未答</td>
                  <td>{sessionScore.unanswered} 道</td>
                </tr>
                <tr>
                  <td>正确率（答对 ÷ 已答）</td>
                  <td>{sessionScore.accuracy === null ? '—（本次没答客观题）' : `${sessionScore.accuracy}%`}</td>
                </tr>
                <tr>
                  <td>主观题（写作）</td>
                  <td>
                    已写 {sessionScore.subjectiveAnswered} / {sessionScore.subjectiveTotal} 道 · 待自评，不计正确率
                  </td>
                </tr>
              </tbody>
            </table>
          </GardenTableScroll>
          {sessionScore.byQtype.length > 0 && (
            <>
              <h3>按题型分项</h3>
              <GardenTableScroll label="本次错题">
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
                    {sessionScore.byQtype.map((row) => (
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
          <p>
            <button
              type="button"
              onClick={() => {
                // 再练一次：同一批题重新开始（本次作答记录清空，答题记录仍在库里）。
                setShowSummary(false)
                resetSession()
                resetCard()
                setCurrentIdx(0)
              }}
            >
              再练一次
            </button>{' '}
            <button type="button" className="secondary" onClick={exitSession}>
              返回练习首页
            </button>
          </p>
        </>
      )}

      {sessionMode !== null && !showSummary && current && (
        <ListeningFilesProvider>
          <h2>
            {practiceTitle}
            （#9 / #10）
          </h2>
          <p className="garden-meta">
            第 {currentIdx + 1} / {sessionQuestions.length} 道 · 题型 {current.qtype} · 难度{' '}
            {current.difficulty} · 来源 {current.source} · 核实状态 {current.status}
          </p>
          {current.id !== undefined && (
            <p>
              <button type="button" className="secondary" aria-label="收藏本题" aria-pressed={currentFavorite}
                disabled={savingFavorite || favoriteQuestions === undefined}
                onClick={() => void changeFavorite(current.id!, !currentFavorite)}>
                {currentFavorite ? '取消收藏' : '收藏本题'}
              </button>
            </p>
          )}
          {favoriteError && <p className="fail" role="alert">{favoriteError}</p>}
          <AnswerCard
            title="答题卡（#15）"
            states={cardStates}
            current={currentIdx}
            onJump={goToQuestion}
          />
          <p>
            本次练习成绩：客观题已答 {sessionScore.answered} / {sessionScore.total} 道 · 答对{' '}
            {sessionScore.correct} 道 · 正确率{' '}
            {sessionScore.accuracy === null ? '—' : `${sessionScore.accuracy}%`}
            {sessionScore.subjectiveTotal > 0 &&
              ` · 写作已写 ${sessionScore.subjectiveAnswered} / ${sessionScore.subjectiveTotal} 道（待自评，不计正确率）`}
          </p>
          {current.qtype === '听力' && <ListeningAudio key={current.id} question={current} />}
          {current.qtype === '阅读' && current.timeLimit !== undefined && (
            <div className="note">
              <p>
                阅读计时（#12）：限时 {current.timeLimit} 分钟 · 剩余{' '}
                {timeLeft !== null ? formatSeconds(timeLeft) : '—'}
              </p>
              {timeUp && <p className="fail">时间到！请提交答案（练习模式不锁题）。</p>}
            </div>
          )}
          {current.qtype === '阅读' && current.timeLimit === undefined && (
            <p>本题未设限时。</p>
          )}
          {isWriting ? (
            <>
              <div className="note">
                <p lang="ko" style={{ fontSize: 17, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{current.stem}</p>
                <p>
                  来源：{current.source} · 核实状态：{current.status}
                  {current.status === '待核实' ? '（未核实来源，仅供练习参考）' : ''}
                </p>
                {writingPrevSeconds > 0 && (
                  <p>上次保存用时：{formatSeconds(writingPrevSeconds)}</p>
                )}
              </div>
              <WritingCard
                key={current.id}
                question={current}
                initialText={writingInitial}
                onSave={handleWritingSave}
                practiceDraft
                showReference
                onSkip={handleNext}
              />
            </>
          ) : (
            <div className="note">
              <p style={{ fontSize: 17 }}>{current.stem}</p>
              {isObjective ? (
                <>
                  {current.options.map((opt, i) => (
                    <p className="garden-option" key={i}>
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
                      <p className={isVerifiedObjective(current) ? (lastCorrect ? 'pass' : 'fail') : 'note'}>
                        {isVerifiedObjective(current) ? (lastCorrect ? '答对了。正确答案：' : '答错了。正确答案：') : '已提交，答案待核实，不计分。参考选项：'}
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
                        {current.status === '待核实' ? '（未核实来源，仅供练习参考）' : ''}
                      </p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p>主观题不自动判分。</p>
                  {!showReference ? (
                    <p>
                      <button type="button" onClick={() => setShowReference(true)}>
                        查看参考答案与解析
                      </button>
                    </p>
                  ) : (
                    <>
                      {current.answer && (
                        <p>
                          参考答案：{current.answer}
                        </p>
                      )}
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
                </>
              )}
            </div>
          )}
          {(submitted || (isWriting ? writingSaved : !isObjective)) && (
            <p>
              <button type="button" onClick={handleNext}>
                {currentIdx + 1 < sessionQuestions.length ? '下一题' : '结束练习'}
              </button>
            </p>
          )}
          <p>
            <button type="button" onClick={() => setShowSummary(true)}>
              交卷看成绩
            </button>{' '}
            <button type="button" className="secondary" onClick={exitSession}>
              退出本次练习
            </button>
          </p>
        </ListeningFilesProvider>
      )}
    </>
  )
}
