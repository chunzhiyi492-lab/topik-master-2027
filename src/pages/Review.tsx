import { useEffect, useRef, useState } from 'react'
import { GardenBack, GardenNotice, GardenPageTitle, GardenProgress } from '../components/GardenUI'
import { PearlWordCard, StudySpeak } from '../components/StudyCard'
import {
  getAllVocab,
  getUnlearnedVocab,
  getVocabByMastery,
  getWrongVocab,
  toggleFavorite,
  type VocabEntry,
} from '../lib/db'
import {
  countDue,
  countReviewedToday,
  DueCardChanged,
  formatDateTime,
  formatDue,
  getDueList,
  getMastery,
  getRandomVocab,
  getStudyStreak,
  gradeCard,
  previewGrades,
  GRADES,
  type DueItem,
  type GradeLabel,
} from '../lib/review'
import { isSpeechSupported, listKoreanVoices, speakKorean } from '../lib/speech'
import { useStudyDay } from '../lib/study-clock'
import '../review-v4.css'

// TOPIK MASTER 2027 — 复习页（P2：#2 FSRS 间隔复习卡片、#3 随机抽词、
// #7 词汇掌握度标记、#5 收藏与错词本；P3 加 #6 词条发音）
// 铁律：打分只按 FSRS 改下次到期日；掌握度 = 最新一次打分档位；
// 错词 = 最新一次打分是“不认识/模糊”的词，打“认识/很熟”后自动离开错词本。

type QueueMode = 'due' | 'wrong' | 'favorite' | 'random'

const SPEECH_RATE_KEY = 'topik-master-speech-rate'

/** 语速 0.5–1.5，默认 0.9（与 speech.ts 一致），与词汇页共用一个 localStorage 键。 */
function loadSpeechRate(): number {
  const raw = Number(window.localStorage.getItem(SPEECH_RATE_KEY) ?? '')
  return raw >= 0.5 && raw <= 1.5 ? raw : 0.9
}

const MODE_LABEL: Record<QueueMode, string> = {
  due: '到期复习',
  wrong: '错词复练',
  favorite: '收藏复习',
  random: '随机抽词复习',
}

const LIST_LIMIT = 200

export default function Review({ onBack }: { onBack: () => void }) {
  const [dueTotal, setDueTotal] = useState(0)
  const [queue, setQueue] = useState<DueItem[]>([])
  const [queueMode, setQueueMode] = useState<QueueMode>('due')
  const [queueTotal, setQueueTotal] = useState(0)
  const [showZh, setShowZh] = useState(false)
  const [preview, setPreview] = useState<{
    cardKey: string
    grades: { grade: string; dueAt: Date; scheduledDays: number }[]
  } | null>(null)
  const [lastResult, setLastResult] = useState<{
    ko: string
    grade: GradeLabel
    dueAt: Date
  } | null>(null)
  const [reviewedToday, setReviewedToday] = useState(0)
  const [streak, setStreak] = useState(0)
  const [wrongList, setWrongList] = useState<{ vocab: VocabEntry; grade: string; reviewedAt: Date }[]>([])
  const [favoriteList, setFavoriteList] = useState<VocabEntry[]>([])
  const [randomWord, setRandomWord] = useState<VocabEntry | null>(null)
  const [drawnIds, setDrawnIds] = useState<number[]>([])
  const [masteryFilter, setMasteryFilter] = useState('')
  const [masteryList, setMasteryList] = useState<VocabEntry[]>([])
  const [masteryCount, setMasteryCount] = useState(0)
  const [grading, setGrading] = useState(false)
  const gradePending = useRef(false)
  const favoritePending = useRef(false)
  const [savingFavoriteId, setSavingFavoriteId] = useState<number | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [error, setError] = useState('')
  const [speechRate, setSpeechRate] = useState<number>(() => loadSpeechRate())
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  const [voiceNote, setVoiceNote] = useState('')
  const [speakError, setSpeakError] = useState('')

  const current = queue.length > 0 ? queue[0] : null
  const currentId = current?.vocab.id
  const cardKey = current ? [currentId, current.reviewId, current.dueAt.getTime()].join(':') : ''
  const studyDay = useStudyDay()

  const refreshCounts = async () => {
    const [due, today, s, wrong, favs] = await Promise.all([
      countDue(),
      countReviewedToday(),
      getStudyStreak(),
      getWrongVocab(),
      getAllVocab().then((all) => all.filter((v) => v.favorite)),
    ])
    setDueTotal(due)
    setReviewedToday(today)
    setStreak(s)
    setWrongList(wrong)
    setFavoriteList(favs)
  }

  const loadDueQueue = async () => {
    const list = await getDueList()
    setQueue(list)
    setQueueTotal(list.length)
    setQueueMode('due')
    setShowZh(false)
    setLastResult(null)
  }

  const refreshAll = async () => {
    await refreshCounts()
    await loadDueQueue()
  }

  useEffect(() => {
    const sync = () => {
      if (document.hidden || gradePending.current) return
      const refresh = queueMode === 'due' ? refreshAll() : refreshCounts()
      void refresh.catch(() => setError('无法更新复习队列，请重试。'))
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueMode, studyDay])

  // 发音：进页时查一次本机韩语语音；语音列表晚到时 voiceschanged 再查一次。
  // 无韩语语音不静默失败，voiceNote 原样显示原因。
  useEffect(() => {
    const check = () => {
      if (!isSpeechSupported()) {
        setVoiceNote('当前浏览器不支持 speechSynthesis，发音不可用。')
        return
      }
      const { voices, reason } = listKoreanVoices()
      setVoiceNote(
        voices.length > 0
          ? `已找到 ${voices.length} 个韩语语音：${voices.map((v) => v.name).join('、')}`
          : reason,
      )
    }
    check()
    const synth = window.speechSynthesis
    synth?.addEventListener('voiceschanged', check)
    return () => synth?.removeEventListener('voiceschanged', check)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 当前卡变化时，刷新四档下次到期预览。
  useEffect(() => {
    if (currentId === undefined) return
    let cancelled = false
    void previewGrades(currentId).then((grades) => {
      if (!cancelled) setPreview({ cardKey, grades })
    }).catch(() => {
      if (!cancelled) setPreview({ cardKey, grades: [] })
    })
    return () => {
      cancelled = true
    }
  }, [currentId, cardKey])

  const handleGrade = async (grade: GradeLabel) => {
    if (!current || current.vocab.id === undefined || gradePending.current) return
    gradePending.current = true
    setGrading(true)
    setError('')
    try {
      const res = await gradeCard(current.vocab.id, grade, undefined, undefined,
        queueMode === 'due' ? { reviewId: current.reviewId } : undefined)
      setLastResult({ ko: current.vocab.ko, grade, dueAt: res.dueAt })
      // 打完分的卡离开本轮队列（下次到期日已按 FSRS 延后，不再是到期卡）。
      setQueue((q) => q.slice(1))
      setShowZh(false)
      void refreshCounts().catch(() => setError('评分已保存，但未能刷新统计。'))
    } catch (e) {
      setError(`打分失败：${e instanceof Error ? e.message : String(e)}`)
      if (e instanceof DueCardChanged) {
        await refreshAll().catch(() => setError('无法更新复习队列，请重试。'))
      }
    } finally {
      gradePending.current = false
      setGrading(false)
    }
  }

  const handleSkip = () => {
    if (queue.length <= 1) return
    setQueue((q) => [...q.slice(1), q[0]])
    setShowZh(false)
  }

  const handleFavorite = async () => {
    const vocabId = current?.vocab.id
    if (!current || vocabId === undefined || favoritePending.current) return
    const favorite = !current.vocab.favorite
    favoritePending.current = true
    setSavingFavoriteId(vocabId)
    setError('')
    try {
      await toggleFavorite(vocabId, favorite)
      setQueue((q) => q.map((item) =>
        item.vocab.id === vocabId ? { ...item, vocab: { ...item.vocab, favorite } } : item,
      ))
      setRandomWord((word) => word?.id === vocabId ? { ...word, favorite } : word)
      await getAllVocab().then((all) => setFavoriteList(all.filter((v) => v.favorite)))
        .catch(() => setError('收藏状态已保存，但未能刷新收藏列表。'))
    } catch {
      setError('收藏状态未能更新，请重试。')
    } finally {
      favoritePending.current = false
      setSavingFavoriteId(null)
    }
  }

  const startWrongQueue = async () => {
    const wrong = await getWrongVocab()
    const items: DueItem[] = await Promise.all(
      wrong.map(async (w) => ({
        vocab: w.vocab,
        dueAt: w.reviewedAt,
        isNew: false,
        lastGrade: w.grade,
      })),
    )
    setQueue(items)
    setQueueTotal(items.length)
    setQueueMode('wrong')
    setShowZh(false)
    setLastResult(null)
  }

  const startFavoriteQueue = async () => {
    const favs = await getAllVocab().then((all) => all.filter((v) => v.favorite))
    const items: DueItem[] = await Promise.all(
      favs.map(async (v) => ({
        vocab: v,
        dueAt: new Date(),
        isNew: false,
        lastGrade: await getMastery(v.id ?? -1),
      })),
    )
    setQueue(items)
    setQueueTotal(items.length)
    setQueueMode('favorite')
    setShowZh(false)
    setLastResult(null)
  }

  const handleDraw = async () => {
    setDrawing(true)
    setError('')
    try {
      const word = await getRandomVocab(drawnIds)
      if (!word) {
        setError('已经抽完了：库内所有词本轮都抽过一遍了，点“重新抽”可再来一轮。')
        return
      }
      setRandomWord(word)
      if (word.id !== undefined) setDrawnIds((ids) => [...ids, word.id as number])
    } catch (e) {
      setError(`抽词失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDrawing(false)
    }
  }

  const handleReviewRandom = async () => {
    if (!randomWord || randomWord.id === undefined) return
    const mastery = await getMastery(randomWord.id)
    setQueue([{ vocab: randomWord, dueAt: new Date(), isNew: mastery === null, lastGrade: mastery }])
    setQueueTotal(1)
    setQueueMode('random')
    setShowZh(false)
    setLastResult(null)
  }

  const handleMasteryFilter = async (value: string) => {
    setMasteryFilter(value)
    if (!value) {
      setMasteryList([])
      setMasteryCount(0)
      return
    }
    const list =
      value === '未学'
        ? await getUnlearnedVocab(10000)
        : await getVocabByMastery(value as GradeLabel)
    setMasteryCount(list.length)
    setMasteryList(list.slice(0, LIST_LIMIT))
  }

  const previewFor = (grade: GradeLabel) => {
    if (!preview || preview.cardKey !== cardKey) return '正在计算下次复习'
    const interval = preview.grades.find((item) => item.grade === grade)
    return interval ? `下次${formatDue(interval.dueAt)}` : '下次复习时间暂不可用'
  }

  // 发音（#6）：调 speech.ts 的 speakKorean（ko-KR + 语速）；播完恢复按钮。
  const handleSpeak = (entry: VocabEntry) => {
    if (entry.id === undefined) return
    const res = speakKorean(entry.ko, { rate: speechRate })
    if (!res.ok) {
      setSpeakError(`发音失败：${res.reason}`)
      return
    }
    setSpeakError('')
    setSpeakingId(entry.id)
    const timer = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        window.clearInterval(timer)
        setSpeakingId(null)
      }
    }, 200)
    window.setTimeout(() => {
      window.clearInterval(timer)
      setSpeakingId(null)
    }, 15000)
  }

  const handleRateChange = (value: string) => {
    const r = Number(value)
    if (Number.isNaN(r) || r < 0.5 || r > 1.5) return
    setSpeechRate(r)
    window.localStorage.setItem(SPEECH_RATE_KEY, String(r))
  }

  const doneCount = queueTotal - queue.length

  return (
    <section className="v4-study review-v4">
      <header className="review-v4-header">
        <GardenBack onClick={onBack}>返回首页</GardenBack>
        <GardenPageTitle>复习</GardenPageTitle>
        <dl className="review-v4-stats">
          <div><dt>今日到期</dt><dd>{dueTotal} <small>张</small></dd></div>
          <div><dt>今天已复习</dt><dd>{reviewedToday} <small>次</small></dd></div>
          <div><dt>连续学习</dt><dd>{streak} <small>天</small></dd></div>
        </dl>
        <p className="review-v4-caption">周日休息不算断签。</p>
      </header>

      <div className="study-row review-v4-modes" role="group" aria-label="复习队列">
        <button type="button" className="study-secondary" aria-pressed={queueMode === 'due'}
          onClick={() => void loadDueQueue()} disabled={grading}>
          到期复习
        </button>
        <button type="button" className="study-secondary" aria-pressed={queueMode === 'wrong'}
          onClick={() => void startWrongQueue()} disabled={grading}>
          错词复练（{wrongList.length}）
        </button>
        <button type="button" className="study-secondary" aria-pressed={queueMode === 'favorite'}
          onClick={() => void startFavoriteQueue()} disabled={grading}>
          收藏复习（{favoriteList.length}）
        </button>
      </div>
      {error && <GardenNotice tone="error">{error}</GardenNotice>}

      <section className="review-v4-session" aria-label="复习卡片">
        {current ? (
          <>
            <GardenProgress label="复习进度" max={queueTotal} value={doneCount}>
              {doneCount} / {queueTotal} 张
            </GardenProgress>
            <p className="review-v4-caption">
              {MODE_LABEL[queueMode]}：本轮第 {doneCount + 1} / {queueTotal} 张，还剩 {queue.length} 张。
            </p>

            <div className="review-v4-workbench">
              <PearlWordCard key={current.vocab.id} word={current.vocab} compact revealed={showZh}
                onReveal={() => setShowZh((value) => !value)}
                speaking={speakingId === current.vocab.id}
                onSpeak={() => handleSpeak(current.vocab)}
                onFavorite={() => void handleFavorite()}
                favoriteDisabled={current.vocab.id === undefined || savingFavoriteId !== null}>
                <div className="review-v4-card-footer">
                  <span>掌握度 <strong>{current.lastGrade ?? '未学'}</strong>{current.isNew && ' · 新卡'}</span>
                  <button type="button" className="study-secondary" onClick={handleSkip} disabled={grading || queue.length <= 1}>
                    跳过这张
                  </button>
                </div>
              </PearlWordCard>

              <div className="study-panel review-v4-rating">
                <h3>选择熟悉程度</h3>
                <p className="review-v4-caption">先回想，再打分。评分后按 FSRS 安排下次复习。</p>
                <div className="review-v4-grades" role="group" aria-label="FSRS 四档评分" aria-busy={grading}>
                  {GRADES.map((grade) => {
                    const nextDue = previewFor(grade)
                    return (
                      <button key={grade} type="button" data-grade={grade} aria-label={grade + ' · ' + nextDue}
                        disabled={grading} onClick={(event) => {
                          if (event.detail <= 1) void handleGrade(grade)
                        }} onKeyDown={(event) => {
                          if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault()
                        }}>
                        <strong>{grade}</strong>
                        <span>{nextDue}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="study-panel review-v4-empty">
            <p>
              本轮完成：{MODE_LABEL[queueMode]}共 {queueTotal} 张，已打分 {doneCount} 张。
              {queueMode === 'due' && dueTotal === 0
                ? '今日没有到期的卡了，明天再来。'
                : '可以重新加载到期列表，或选择错词、收藏和随机抽词。'}
            </p>
            <button type="button" className="study-primary" onClick={() => void loadDueQueue()}>
              重新加载到期列表
            </button>
          </div>
        )}
        <div aria-live="polite" className="review-v4-result">
          {lastResult && (
            <p>上一张「<span lang="ko">{lastResult.ko}</span>」已记为「{lastResult.grade}」，下次到期：
              <time dateTime={lastResult.dueAt.toISOString()}>{formatDateTime(lastResult.dueAt)}</time>
              （{formatDue(lastResult.dueAt)}）。</p>
          )}
        </div>
        {speakError && <GardenNotice tone="error">{speakError}</GardenNotice>}
        <details className="study-panel review-v4-speech">
          <summary>发音设置</summary>
          <label className="review-v4-rate">
            <span>语速</span>
            <input type="range" min={0.5} max={1.5} step={0.1} value={speechRate}
              onChange={(event) => handleRateChange(event.target.value)} />
            <span>{speechRate.toFixed(1)}x</span>
          </label>
          <p className="review-v4-caption">语音：{voiceNote}</p>
        </details>
      </section>

      <div className="review-v4-advanced">
        <section className="study-panel" aria-labelledby="review-v4-random-title">
          <h2 id="review-v4-random-title">随机抽词</h2>
          <p className="review-v4-caption">本轮已抽 <strong>{drawnIds.length}</strong> 张（不重复）。</p>
          <div className="study-row">
            <button type="button" className="study-primary" onClick={() => void handleDraw()} disabled={drawing}>
              {drawing ? '抽词中…' : '随机抽一张'}
            </button>
            <button type="button" className="study-secondary" onClick={() => {
              setDrawnIds([])
              setRandomWord(null)
            }}>
              重新抽
            </button>
          </div>
          {randomWord && (
            <div className="review-v4-drawn">
              <p className="review-v4-drawn-word" lang="ko">{randomWord.ko}</p>
              <p>中文：<strong>{randomWord.zh || '待补'}</strong></p>
              <p className="review-v4-caption">{[randomWord.source, randomWord.source_level, randomWord.yonsei_lesson].filter(Boolean).join(' · ')}</p>
              <div className="study-row">
                <button type="button" className="study-primary" onClick={() => void handleReviewRandom()} disabled={grading}>
                  用这张卡复习
                </button>
                <StudySpeak word={randomWord.ko} onClick={() => handleSpeak(randomWord)} speaking={speakingId === randomWord.id} />
              </div>
            </div>
          )}
        </section>

        <section className="study-panel" aria-labelledby="review-v4-favorite-title">
          <h2 id="review-v4-favorite-title">收藏</h2>
          {favoriteList.length === 0 ? (
            <p className="review-v4-caption">还没有收藏的词。可在词汇页或复习卡片上点爱心收藏。</p>
          ) : (
            <>
              <p>共收藏 <strong>{favoriteList.length}</strong> 个词。</p>
              <button type="button" className="study-secondary" onClick={() => void startFavoriteQueue()} disabled={grading}>
                开始复习收藏
              </button>
            </>
          )}
        </section>

        <section className="study-panel review-v4-wide" aria-labelledby="review-v4-wrong-title">
          <h2 id="review-v4-wrong-title">错词本</h2>
          {wrongList.length === 0 ? (
            <p className="review-v4-caption">暂无错词。打分为「不认识」或「模糊」的词会出现在这里。</p>
          ) : (
            <>
              <p>共 <strong>{wrongList.length}</strong> 个错词（最新一次打分为「不认识」或「模糊」）。</p>
              <button type="button" className="study-secondary" onClick={() => void startWrongQueue()} disabled={grading}>
                开始复习错词
              </button>
              <table>
                <thead>
                  <tr>
                    <th scope="col">韩文</th><th scope="col">中文</th>
                    <th scope="col">上次档位</th><th scope="col">上次复习</th>
                  </tr>
                </thead>
                <tbody>
                  {wrongList.slice(0, LIST_LIMIT).map((word) => (
                    <tr key={word.vocab.id}>
                      <td lang="ko">{word.vocab.ko}</td><td>{word.vocab.zh || '待补'}</td>
                      <td>{word.grade}</td>
                      <td><time dateTime={word.reviewedAt.toISOString()}>{formatDateTime(word.reviewedAt)}</time></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {wrongList.length > LIST_LIMIT && <p>仅显示前 {LIST_LIMIT} 个。</p>}
            </>
          )}
        </section>

        <section className="study-panel review-v4-wide" aria-labelledby="review-v4-mastery-title">
          <h2 id="review-v4-mastery-title">按掌握度查看</h2>
          <label className="review-v4-filter">
            掌握度
            <select value={masteryFilter} onChange={(event) => void handleMasteryFilter(event.target.value)}>
              <option value="">请选择</option>
              <option value="未学">未学（从未打过分）</option>
              {GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
            </select>
          </label>
          {masteryFilter && (
            <p>
              掌握度为「{masteryFilter}」的词共 <strong>{masteryCount}</strong> 个
              {masteryCount > LIST_LIMIT && '，仅显示前 ' + LIST_LIMIT + ' 个'}。
            </p>
          )}
          {masteryList.length > 0 && (
            <table>
              <thead>
                <tr><th scope="col">韩文</th><th scope="col">中文</th><th scope="col">来源</th><th scope="col">课次</th></tr>
              </thead>
              <tbody>
                {masteryList.map((word) => (
                  <tr key={word.id}>
                    <td lang="ko">{word.ko}</td><td>{word.zh || '待补'}</td>
                    <td>{[word.source, word.source_level].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{word.yonsei_lesson || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </section>
  )
}
