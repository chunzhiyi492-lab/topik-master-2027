import { useEffect, useRef, useState } from 'react'
import {
  addAttempt,
  clearQuestionBank,
  getAllPapers,
  getAllQuestions,
  getAttemptsByQuestion,
  getLatestWritingAttempt,
  getQuestionsByPaper,
  getWrongQuestionIds,
  importQuestionBank,
  updateQuestionAudio,
  type Attempt,
  type Paper,
  type Question,
  type QuestionBankImportResult,
} from '../lib/db'
import { scoreItems, type ScoredItem, type ScoreSummary } from '../lib/scoring'
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

type SessionMode = 'paper' | 'random'
type Scope = 'all' | 'wrong' | 'unanswered'

const QTYPE_OPTIONS = ['全部', '听力', '阅读', '写作', '词汇', '语法', '其他']
const DIFFICULTY_OPTIONS = ['全部', '易', '中', '难']

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

/**
 * 听力音频块（P6 #11，Practice 与 MockExam 共用）。
 * 音频文件本身不进仓库、不进 IndexedDB：题目只记文件名（question.audio），
 * 用户每次练习重新选择本机音频文件，播放在会话内用 URL.createObjectURL 完成；
 * 浏览器安全限制决定了文件无法跨会话保留，页面上明说，不假装已保存。
 */
export function ListeningAudio({ question }: { question: Question }) {
  const [audioUrl, setAudioUrl] = useState('')
  const [audioRef, setAudioRef] = useState(question.audio ?? '')
  const [audioStatus, setAudioStatus] = useState('')
  const [audioError, setAudioError] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setAudioRef(question.audio ?? '')
    setAudioUrl('')
    setAudioStatus('')
    setAudioError('')
  }, [question.id, question.audio])

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    },
    [audioUrl],
  )

  const handleAudioFile = async (file: File | undefined) => {
    if (!file || question.id === undefined) return
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    setAudioStatus('已选择文件，等待播放')
    setAudioError('')
    try {
      await updateQuestionAudio(question.id, file.name)
      setAudioRef(file.name)
    } catch (e) {
      setAudioError(`记音频引用失败：${e instanceof Error ? e.message : String(e)}`)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="note">
      <p>
        <b>听力音频（#11）</b>
      </p>
      {audioRef ? (
        <p>音频引用：{audioRef}</p>
      ) : (
        <p className="fail">未导入音频：本题还没有关联音频文件。</p>
      )}
      <p>
        音频文件不存题库、不进仓库；每次练习请重新选择本机音频文件。
        官方音频请先从{' '}
        <a href="https://www.topik.go.kr" target="_blank" rel="noreferrer">
          TOPIK 官网（topik.go.kr）学习资料室
        </a>{' '}
        下载。
      </p>
      <p>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          onChange={(e) => void handleAudioFile(e.target.files?.[0])}
        />
      </p>
      {audioUrl && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            controls
            src={audioUrl}
            preload="metadata"
            onLoadedMetadata={() => setAudioStatus('音频已加载，可以播放')}
            onPlay={() => setAudioStatus('朗读中…')}
            onPlaying={() => setAudioStatus('正在播放')}
            onEnded={() => setAudioStatus('播放结束')}
            onError={() => {
              setAudioStatus('')
              setAudioError('音频加载失败：文件可能损坏或格式不受支持，请换一个音频文件。')
            }}
          />
          {audioStatus && <p>{audioStatus}</p>}
        </>
      )}
      {audioError && <p className="fail">{audioError}</p>}
    </div>
  )
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
  showReference,
  onSkip,
}: {
  question: Question
  initialText: string
  onSave: (text: string, seconds: number) => void | Promise<void>
  showReference: boolean
  onSkip?: () => void
}) {
  const [text, setText] = useState(initialText)
  const [elapsed, setElapsed] = useState(0)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
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
    setChecklist(
      question.id === undefined ? WRITING_CHECKLIST.map(() => false) : loadChecklist(question.id),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id])

  // 初始文案是异步读到的（重进本题时从 attempts 恢复最新一次保存的答案）：
  // 读到后再同步进输入框；若用户已经开始打字则不覆盖。
  useEffect(() => {
    if (!touchedRef.current) setText(initialText)
  }, [initialText])

  useEffect(() => {
    if (saved) return
    const start = Date.now()
    const t = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 500)
    return () => window.clearInterval(t)
  }, [saved])

  const wordCount = text.replace(/\s/g, '').length

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
    if (saving) return
    setSaving(true)
    try {
      await onSave(text, elapsed)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="note">
      <p>
        <b>写作练习（#13）</b> · 字数：{wordCount}（不计空格） · 本次用时：{formatSeconds(elapsed)}
      </p>
      <p>
        <textarea
          value={text}
          onChange={(e) => {
            touchedRef.current = true
            setText(e.target.value)
            setSaved(false)
          }}
          rows={8}
          style={{ width: '100%' }}
          placeholder="在这里用韩语写答案……（保存后刷新还在）"
        />
      </p>
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
        <button type="button" onClick={() => void handleSave()} disabled={saving || text.trim() === ''}>
          {saved ? '已保存' : '保存答案'}
        </button>{' '}
        {onSkip && (
          <button type="button" className="secondary" onClick={onSkip}>
            跳过本题
          </button>
        )}
      </p>
      {saved && <p>已保存：答案与用时已记录，刷新后还在。</p>}
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

export default function Practice({ onBack }: { onBack: () => void }) {
  const [papers, setPapers] = useState<Paper[]>([])
  const [paperCounts, setPaperCounts] = useState<Map<number, number>>(new Map())
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [totalAttempts, setTotalAttempts] = useState(0)
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
  const [importResult, setImportResult] = useState<QuestionBankImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [randomQtype, setRandomQtype] = useState('全部')
  const [randomDifficulty, setRandomDifficulty] = useState('全部')
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

  const refresh = async () => {
    const [ps, qs] = await Promise.all([getAllPapers(), getAllQuestions()])
    setPapers(ps)
    setTotalQuestions(qs.length)
    const counts = new Map<number, number>()
    for (const q of qs) {
      if (q.paperId !== undefined) counts.set(q.paperId, (counts.get(q.paperId) ?? 0) + 1)
    }
    setPaperCounts(counts)
    let attempts = 0
    let correct = 0
    for (const q of qs) {
      const list: Attempt[] = await getAttemptsByQuestion(q.id as number)
      // P6：写作等主观题答题（subjective）不计入正确率。
      const objective = list.filter((a) => !a.subjective)
      attempts += objective.length
      correct += objective.filter((a) => a.correct).length
    }
    setTotalAttempts(attempts)
    setTotalCorrect(correct)
  }

  const current = sessionQuestions.length > 0 ? sessionQuestions[currentIdx] : null
  const isObjective = current !== null && current.options.length > 0
  const isWriting = current !== null && current.qtype === '写作' && !isObjective

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
  const sessionScore: ScoreSummary = scoreItems(sessionItems)
  const cardStates: AnswerCardState[] = sessionItems.map((it) => {
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

  const startPaper = async (paper: Paper) => {
    setError('')
    const qs = await getQuestionsByPaper(paper.id as number)
    if (qs.length === 0) {
      setError(`“${paper.title}”里还没有题目，先导入该场的题目。`)
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
    let pool = all
    if (randomQtype !== '全部') pool = pool.filter((q) => q.qtype === randomQtype)
    if (randomDifficulty !== '全部') pool = pool.filter((q) => q.difficulty === randomDifficulty)
    if (randomScope === 'wrong') {
      const wrongIds = new Set(await getWrongQuestionIds())
      pool = pool.filter((q) => wrongIds.has(q.id as number))
    } else if (randomScope === 'unanswered') {
      const answered = new Set<number>()
      for (const q of pool) {
        const list = await getAttemptsByQuestion(q.id as number)
        if (list.length > 0) answered.add(q.id as number)
      }
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

  const handleSubmit = async () => {
    if (!current || current.id === undefined || selected === null || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const correct = selected === current.answerIndex
      const qid = current.id
      await addAttempt({
        questionId: current.id,
        paperId: sessionPaper?.id,
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
  const handleWritingSave = async (text: string, seconds: number) => {
    if (!current || current.id === undefined) return
    const qid = current.id
    setError('')
    try {
      await addAttempt({
        questionId: current.id,
        paperId: sessionPaper?.id,
        selectedAnswer: text,
        correct: false,
        answeredAt: new Date(),
        subjective: true,
        writingSeconds: seconds,
      })
      // P7：记入本次练习的作答（答题卡上写作题变“已写”）。
      setSessionAnswers((prev) => {
        const next = new Map(prev)
        next.set(qid, { selected: null, correct: null, submitted: false, subjectiveAnswered: true })
        return next
      })
      setWritingSaved(true)
      await refresh()
    } catch (e) {
      setError(`保存答案失败：${e instanceof Error ? e.message : String(e)}`)
    }
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
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setError('')
    try {
      const text = await file.text()
      const res = await importQuestionBank(text)
      setImportResult(res)
      await refresh()
    } catch (e) {
      setError(`导入失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleClear = async () => {
    if (!window.confirm('确定清空整个题库吗？只删试卷、题目与答题记录，词汇、复习、统计数据不受影响。')) {
      return
    }
    await clearQuestionBank()
    setSessionMode(null)
    setSessionQuestions([])
    setSessionPaper(null)
    setImportResult(null)
    await refresh()
  }

  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null

  return (
    <>
      <button type="button" className="secondary" onClick={onBack}>
        ← 返回首页
      </button>
      <h1>练习</h1>
      <p>
        试卷 {papers.length} 场 · 题目 {totalQuestions} 道 · 已答 {totalAttempts} 次
        {accuracy === null ? '' : ` · 正确率 ${accuracy}%（答对 ${totalCorrect} / ${totalAttempts}）`}
      </p>

      {error && <p className="fail">{error}</p>}

      {sessionMode === null && (
        <>
          {totalQuestions === 0 && (
            <div className="note">
              题库目前是空的。首批题目来源已定为<b>官方真题本地导入</b>：请从 TOPIK 官网下载官方真题后，
              用下方导入入口把试卷 JSON 导进来。本应用不内置、不打包任何官方真题文件；
              自编题（如以后有）会明确标“自编练习题，非官方真题”。
            </div>
          )}

          <h2>试卷练习（#9）</h2>
          {papers.length === 0 ? (
            <p>还没有试卷。导入试卷 JSON 后，这里会按场次列出练习卷。</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>场次</th>
                  <th>级别</th>
                  <th>考试日期</th>
                  <th>来源</th>
                  <th>核实状态</th>
                  <th>题数</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>{p.level || '—'}</td>
                    <td>{p.examDate || '—'}</td>
                    <td>{p.source}</td>
                    <td>{p.status}</td>
                    <td>{paperCounts.get(p.id as number) ?? 0}</td>
                    <td>
                      <button type="button" onClick={() => void startPaper(p)}>
                        开始练习
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>随机题目练习（#10）</h2>
          <p>
            题型：
            <select value={randomQtype} onChange={(e) => setRandomQtype(e.target.value)}>
              {QTYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>{' '}
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
              accept=".json,application/json"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </p>
          {importing && <p>正在导入……</p>}
          {importResult && (
            <div className="note">
              导入完成：新增试卷 {importResult.papersAdded} 场（复用已有试卷 {importResult.papersReused} 场）、
              新增题目 {importResult.questionsAdded} 道（重复跳过 {importResult.questionsSkipped} 道）。
              {importResult.errors.length === 0 ? (
                <>全部条目校验通过。</>
              ) : (
                <>
                  拒绝 {importResult.errors.length} 条：
                  <ul>
                    {importResult.errors.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <h2>题库管理</h2>
          <p>
            <button type="button" className="secondary" onClick={() => void handleClear()}>
              清空题库（只删试卷、题目与答题记录）
            </button>
          </p>
        </>
      )}

      {sessionMode !== null && showSummary && (
        <>
          <h2>本次练习成绩（#15）</h2>
          <p>
            {sessionMode === 'paper'
              ? `试卷练习：${sessionPaper?.title ?? ''}`
              : '随机题目练习'}
            · 客观题自动判分，写作题不自动判分（待自评）。
          </p>
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
          {sessionScore.byQtype.length > 0 && (
            <>
              <h3>按题型分项</h3>
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
        <>
          <h2>
            {sessionMode === 'paper'
              ? `试卷练习：${sessionPaper?.title ?? ''}`
              : '随机题目练习'}
            （#9 / #10）
          </h2>
          <p>
            第 {currentIdx + 1} / {sessionQuestions.length} 道 · 题型 {current.qtype} · 难度{' '}
            {current.difficulty} · 来源 {current.source} · 核实状态 {current.status}
          </p>
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
          {current.qtype === '听力' && <ListeningAudio question={current} />}
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
                <p style={{ fontSize: 17 }}>{current.stem}</p>
                <p>
                  来源：{current.source} · 核实状态：{current.status}
                  {current.status === '待核实' ? '（未核实来源，仅供练习参考）' : ''}
                </p>
                {writingPrevSeconds > 0 && (
                  <p>上次保存用时：{formatSeconds(writingPrevSeconds)}</p>
                )}
              </div>
              <WritingCard
                question={current}
                initialText={writingInitial}
                onSave={(text, seconds) => void handleWritingSave(text, seconds)}
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
                        {lastCorrect ? '答对了' : '答错了'}。正确答案：
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
        </>
      )}
    </>
  )
}
