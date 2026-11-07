import { useEffect, useState } from 'react'
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

// TOPIK MASTER 2027 — 复习页（P2：#2 FSRS 间隔复习卡片、#3 随机抽词、
// #7 词汇掌握度标记、#5 收藏与错词本）
// 功能页先用朴素结构实现，主题样式等薯饼拍板后再接入。
// 铁律：打分只按 FSRS 改下次到期日；掌握度 = 最新一次打分档位；
// 错词 = 最新一次打分是“不认识/模糊”的词，打“认识/很熟”后自动离开错词本。

type QueueMode = 'due' | 'wrong' | 'favorite' | 'random'

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
  const [preview, setPreview] = useState<{ grade: string; dueAt: Date; scheduledDays: number }[]>([])
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
  const [drawing, setDrawing] = useState(false)
  const [error, setError] = useState('')

  const current = queue.length > 0 ? queue[0] : null

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
    void refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 当前卡变化时，刷新四档下次到期预览。
  useEffect(() => {
    if (!current || current.vocab.id === undefined) {
      setPreview([])
      return
    }
    let cancelled = false
    void previewGrades(current.vocab.id).then((p) => {
      if (!cancelled) setPreview(p)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.vocab.id])

  const handleGrade = async (grade: GradeLabel) => {
    if (!current || current.vocab.id === undefined || grading) return
    setGrading(true)
    setError('')
    try {
      const res = await gradeCard(current.vocab.id, grade)
      setLastResult({ ko: current.vocab.ko, grade, dueAt: res.dueAt })
      // 打完分的卡离开本轮队列（下次到期日已按 FSRS 延后，不再是到期卡）。
      setQueue((q) => q.slice(1))
      setShowZh(false)
      await refreshCounts()
    } catch (e) {
      setError(`打分失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGrading(false)
    }
  }

  const handleSkip = () => {
    if (queue.length <= 1) return
    setQueue((q) => [...q.slice(1), q[0]])
    setShowZh(false)
  }

  const handleFavorite = async () => {
    if (!current || current.vocab.id === undefined) return
    await toggleFavorite(current.vocab.id, !current.vocab.favorite)
    setQueue((q) =>
      q.map((item, i) =>
        i === 0 ? { ...item, vocab: { ...item.vocab, favorite: !item.vocab.favorite } } : item,
      ),
    )
    setFavoriteList(await getAllVocab().then((all) => all.filter((v) => v.favorite)))
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

  const previewFor = (grade: GradeLabel): string => {
    const p = preview.find((x) => x.grade === grade)
    if (!p) return ''
    return ` · 下次${formatDue(p.dueAt)}`
  }

  const doneCount = queueTotal - queue.length

  return (
    <>
      <p>
        <button type="button" className="secondary" onClick={onBack}>
          ← 返回首页
        </button>
      </p>
      <h1>复习</h1>
      <p>
        今日到期 <strong>{dueTotal}</strong> 张 · 今天已复习 <strong>{reviewedToday}</strong> 张 ·
        连续学习 <strong>{streak}</strong> 天（周日休息不算断签）。
      </p>
      <p>
        <button type="button" onClick={() => void loadDueQueue()}>
          到期复习
        </button>{' '}
        <button type="button" className="secondary" onClick={() => void startWrongQueue()}>
          错词复练（{wrongList.length}）
        </button>{' '}
        <button type="button" className="secondary" onClick={() => void startFavoriteQueue()}>
          收藏复习（{favoriteList.length}）
        </button>
      </p>
      {error && <p className="fail">{error}</p>}

      <h2>复习卡片（#2）</h2>
      {queue.length === 0 ? (
        <div className="note">
          <p>
            本轮完成：{MODE_LABEL[queueMode]}共 {queueTotal} 张，已打分 {doneCount} 张。
            {queueMode === 'due' && dueTotal === 0
              ? '今日没有到期的卡了，明天再来。'
              : '想继续就点“到期复习”重新加载，或去抽词、错词本看看。'}
          </p>
          <p>
            <button type="button" onClick={() => void loadDueQueue()}>
              重新加载到期列表
            </button>
          </p>
        </div>
      ) : (
        current && (
          <>
            <p>
              {MODE_LABEL[queueMode]}：本轮第 {doneCount + 1} / {queueTotal} 张，还剩{' '}
              {queue.length} 张。
            </p>
            <div className="note">
              <p style={{ fontSize: 30, margin: '8px 0' }}>{current.vocab.ko}</p>
              <p>
                {current.vocab.source} · {current.vocab.source_level}
                {current.vocab.yonsei_lesson ? ` · ${current.vocab.yonsei_lesson}` : ''}
                {current.vocab.pos ? ` · ${current.vocab.pos}` : ''}
              </p>
              <p>
                掌握度：
                <strong>{current.lastGrade ?? '未学'}</strong>
                {current.isNew ? '（新卡，第一次复习）' : ''}
              </p>
              <p>
                {showZh ? (
                  <>
                    中文：<strong>{current.vocab.zh || '待补'}</strong>
                    {current.vocab.example_ko && (
                      <>
                        <br />
                        例句：{current.vocab.example_ko}
                        {current.vocab.example_zh ? `（${current.vocab.example_zh}）` : ''}
                      </>
                    )}
                  </>
                ) : (
                  '中文释义已遮住，先回想，再点“显示释义”核对。'
                )}
              </p>
              <p>
                <button type="button" className="secondary" onClick={() => setShowZh((v) => !v)}>
                  {showZh ? '隐藏释义' : '显示释义'}
                </button>{' '}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void handleFavorite()}
                  aria-label={current.vocab.favorite ? '取消收藏' : '收藏'}
                >
                  {current.vocab.favorite ? '★ 已收藏' : '☆ 收藏'}
                </button>{' '}
                <button type="button" className="secondary" onClick={handleSkip} disabled={queue.length <= 1}>
                  跳过这张
                </button>
              </p>
            </div>
            <p>先回想，再打分（打分后间隔按 FSRS 变化）：</p>
            <p>
              {GRADES.map((g) => (
                <span key={g}>
                  <button type="button" onClick={() => void handleGrade(g)} disabled={grading}>
                    {g}
                    {previewFor(g)}
                  </button>{' '}
                </span>
              ))}
            </p>
            {lastResult && (
              <p>
                上一张「{lastResult.ko}」已记为「{lastResult.grade}」，下次到期：
                {formatDateTime(lastResult.dueAt)}（{formatDue(lastResult.dueAt)}）。
              </p>
            )}
          </>
        )
      )}

      <h2>随机抽词（#3）</h2>
      <p>
        <button type="button" onClick={() => void handleDraw()} disabled={drawing}>
          {drawing ? '抽词中…' : '随机抽一张'}
        </button>{' '}
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setDrawnIds([])
            setRandomWord(null)
          }}
        >
          重新抽
        </button>{' '}
        本轮已抽 <strong>{drawnIds.length}</strong> 张（不重复）。
      </p>
      {randomWord && (
        <div className="note">
          <p style={{ fontSize: 24, margin: '8px 0' }}>{randomWord.ko}</p>
          <p>
            中文：<strong>{randomWord.zh || '待补'}</strong> · {randomWord.source} ·{' '}
            {randomWord.source_level}
            {randomWord.yonsei_lesson ? ` · ${randomWord.yonsei_lesson}` : ''}
          </p>
          <p>
            <button type="button" onClick={() => void handleReviewRandom()}>
              用这张卡复习
            </button>
          </p>
        </div>
      )}

      <h2>错词本（#5）</h2>
      {wrongList.length === 0 ? (
        <p>错词本是空的：没有打过“不认识 / 模糊”的词。打“认识 / 很熟”后，词会自动离开错词本。</p>
      ) : (
        <>
          <p>
            共 <strong>{wrongList.length}</strong> 个错词（最新一次打分是“不认识”或“模糊”）。
            <button type="button" onClick={() => void startWrongQueue()}>
              开始复习错词
            </button>
          </p>
          <table>
            <thead>
              <tr>
                <th>韩文</th>
                <th>中文</th>
                <th>上次档位</th>
                <th>上次复习</th>
              </tr>
            </thead>
            <tbody>
              {wrongList.slice(0, LIST_LIMIT).map((w) => (
                <tr key={w.vocab.id}>
                  <td>{w.vocab.ko}</td>
                  <td>{w.vocab.zh || '待补'}</td>
                  <td>{w.grade}</td>
                  <td>{formatDateTime(w.reviewedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {wrongList.length > LIST_LIMIT && <p>仅显示前 {LIST_LIMIT} 个。</p>}
        </>
      )}

      <h2>收藏（#5）</h2>
      {favoriteList.length === 0 ? (
        <p>还没有收藏的词。在词汇页或复习卡片上点 ☆ 收藏。</p>
      ) : (
        <p>
          共收藏 <strong>{favoriteList.length}</strong> 个词。
          <button type="button" onClick={() => void startFavoriteQueue()}>
            开始复习收藏
          </button>
        </p>
      )}

      <h2>按掌握度看（#7）</h2>
      <p>
        <label>
          掌握度：
          <select value={masteryFilter} onChange={(e) => void handleMasteryFilter(e.target.value)}>
            <option value="">请选择</option>
            <option value="未学">未学（从未打过分）</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </p>
      {masteryFilter && (
        <p>
          掌握度为「{masteryFilter}」的词共 <strong>{masteryCount}</strong> 个
          {masteryCount > LIST_LIMIT && `，仅显示前 ${LIST_LIMIT} 个`}。
        </p>
      )}
      {masteryList.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>韩文</th>
              <th>中文</th>
              <th>来源</th>
              <th>课次</th>
            </tr>
          </thead>
          <tbody>
            {masteryList.map((v) => (
              <tr key={v.id}>
                <td>{v.ko}</td>
                <td>{v.zh || '待补'}</td>
                <td>
                  {v.source} · {v.source_level}
                </td>
                <td>{v.yonsei_lesson || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
