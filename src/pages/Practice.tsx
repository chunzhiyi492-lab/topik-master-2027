import { useEffect, useRef, useState } from 'react'
import {
  addAttempt,
  clearQuestionBank,
  getAllPapers,
  getAllQuestions,
  getAttemptsByQuestion,
  getQuestionsByPaper,
  getWrongQuestionIds,
  importQuestionBank,
  type Attempt,
  type Paper,
  type Question,
  type QuestionBankImportResult,
} from '../lib/db'

// TOPIK MASTER 2027 — 练习页（P5：#9 试卷练习、#17 题目解析与来源标记、#10 随机题目练习）
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
      attempts += list.length
      correct += list.filter((a) => a.correct).length
    }
    setTotalAttempts(attempts)
    setTotalCorrect(correct)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetCard = () => {
    setSelected(null)
    setSubmitted(false)
    setLastCorrect(null)
    setShowReference(false)
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
    resetCard()
    setRandomNote(`已抽 ${drawn.length} 道（题库符合筛选共 ${pool.length} 道）。`)
  }

  const current = sessionQuestions.length > 0 ? sessionQuestions[currentIdx] : null
  const isObjective = current !== null && current.options.length > 0

  const handleSubmit = async () => {
    if (!current || current.id === undefined || selected === null || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const correct = selected === current.answerIndex
      await addAttempt({
        questionId: current.id,
        paperId: sessionPaper?.id,
        selectedAnswer: current.options[selected] ?? '',
        correct,
        answeredAt: new Date(),
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

  const handleNext = () => {
    if (currentIdx + 1 < sessionQuestions.length) {
      setCurrentIdx((i) => i + 1)
      resetCard()
    } else {
      setSessionMode(null)
      setSessionQuestions([])
      setSessionPaper(null)
      resetCard()
      void refresh()
    }
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

      {sessionMode !== null && current && (
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
                <p>主观题（写作 / 简答）：不自动判分，答题记录在 P6 写作练习里接。</p>
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
          {(submitted || !isObjective) && (
            <p>
              <button type="button" onClick={handleNext}>
                {currentIdx + 1 < sessionQuestions.length ? '下一题' : '结束练习'}
              </button>
            </p>
          )}
          <p>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSessionMode(null)
                setSessionQuestions([])
                setSessionPaper(null)
                resetCard()
              }}
            >
              退出本次练习
            </button>
          </p>
        </>
      )}
    </>
  )
}
