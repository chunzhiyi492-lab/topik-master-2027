import { useEffect, useRef, useState } from 'react'
import { liveQuery } from 'dexie'
import { GardenBack, GardenNotice, GardenPageTitle, GardenProgress } from '../components/GardenUI'
import { PearlWordCard, StudyHeart, StudySpeak } from '../components/StudyCard'
import '../vocab-v4.css'
import {
  countVocab,
  countPendingBySource,
  getAllVocab,
  getFilterOptions,
  getUnlearnedVocab,
  getLatestGradeMap,
  searchVocab,
  toggleFavorite,
  type VocabEntry,
} from '../lib/db'
import { isSpeechSupported, listKoreanVoices, speakKorean } from '../lib/speech'
import type { GradeLabel } from '../lib/srs'
import { getDayStats } from '../lib/stats'
import { localDateKey } from '../lib/streak'
import { DAILY_TARGET_KEY, DAILY_TARGET_MAX, loadDailyTarget, saveDailyTarget } from '../lib/study-goals'
import {
  importVocabEntries,
  loadSeedVocabulary,
  parseVocabCSV,
  parseVocabJSON,
  type ImportEntriesResult,
  type LoadSeedResult,
} from '../lib/import'

// TOPIK MASTER 2027 — 词汇页（P1：#8 导入与核对、#4 搜索与筛选、#1 每日背词计划）
// 铁律：全部种子只进待核实池（加载器强制 status=待核实）；无中文释义的词显示“待补”，不编造。

const SPEECH_RATE_KEY = 'topik-master-speech-rate'
const PAGE_SIZE = 50

const MASTERY_GRADES: GradeLabel[] = ['不认识', '模糊', '认识', '很熟']

/** 语速 0.5–1.5，默认 0.9（与 speech.ts 一致），存在 localStorage。 */
function loadSpeechRate(): number {
  const raw = Number(window.localStorage.getItem(SPEECH_RATE_KEY) ?? '')
  return raw >= 0.5 && raw <= 1.5 ? raw : 0.9
}

export default function Vocab({ onBack, initialKeyword = '' }: { onBack: () => void; initialKeyword?: string }) {
  const [total, setTotal] = useState(0)
  const [pendingBySource, setPendingBySource] = useState<{ source: string; count: number }[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [matches, setMatches] = useState<VocabEntry[]>([])
  const [requestedPage, setPage] = useState(1)
  const [listError, setListError] = useState('')
  const [options, setOptions] = useState<{ lessons: string[]; levels: string[]; poses: string[] }>({
    lessons: [],
    levels: [],
    poses: [],
  })
  const [keyword, setKeyword] = useState(initialKeyword)
  const [lesson, setLesson] = useState('')
  const [level, setLevel] = useState('')
  const [pos, setPos] = useState('')
  const [status, setStatus] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [mastery, setMastery] = useState('')
  const [speechRate, setSpeechRate] = useState<number>(() => loadSpeechRate())
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  const [voiceNote, setVoiceNote] = useState('')
  const [speakError, setSpeakError] = useState('')
  const [pendingSource, setPendingSource] = useState('')
  const [target, setTarget] = useState<number>(() => loadDailyTarget())
  const [daily, setDaily] = useState<{ completed: number; words: VocabEntry[] }>()
  const [dailyError, setDailyError] = useState('')
  const [loadingSeeds, setLoadingSeeds] = useState(false)
  const [importing, setImporting] = useState(false)
  const [loadResult, setLoadResult] = useState<LoadSeedResult | null>(null)
  const [importResult, setImportResult] = useState<ImportEntriesResult | null>(null)
  const [importError, setImportError] = useState('')
  const [selectedId, setSelectedId] = useState<number>()
  const fileRef = useRef<HTMLInputElement>(null)
  const studyRef = useRef<HTMLHeadingElement>(null)

  const refreshCounts = async () => {
    const [t, bySource] = await Promise.all([countVocab(), countPendingBySource()])
    setTotal(t)
    setPendingBySource(bySource)
    setPendingTotal(bySource.reduce((s, x) => s + x.count, 0))
  }

  const refreshAll = async () => {
    await refreshCounts()
    setOptions(await getFilterOptions())
  }

  useEffect(() => {
    void refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const day = await getDayStats(localDateKey(new Date()))
      const words = await getUnlearnedVocab(target - day.newWords)
      return { completed: day.newWords, words }
    }).subscribe({
      next: setDaily,
      error: () => setDailyError('无法读取每日背词进度。'),
    })
    return () => subscription.unsubscribe()
  }, [target])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DAILY_TARGET_KEY || event.key === null) setTarget(loadDailyTarget())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    setPage(1)
    setSelectedId(undefined)
    setListError('')
    const subscription = liveQuery(async () => {
      const [base, grades] = await Promise.all([
        keyword.trim() ? searchVocab(keyword) : getAllVocab(),
        mastery ? getLatestGradeMap() : undefined,
      ])
      return base.filter(v => !v.isTestData &&
        (!lesson || v.yonsei_lesson === lesson) &&
        (!level || v.source_level === level) &&
        (!pos || v.pos === pos) &&
        (!status || v.status === status) &&
        (!favoriteOnly || v.favorite) &&
        (!mastery || (grades?.get(v.id ?? -1)?.grade ?? '未学') === mastery))
    }).subscribe({ next: setMatches, error: () => setListError('无法读取词汇列表，请重新打开页面。') })
    return () => subscription.unsubscribe()
  }, [keyword, lesson, level, pos, status, favoriteOnly, mastery])

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const offset = (page - 1) * PAGE_SIZE
  const list = matches.slice(offset, offset + PAGE_SIZE)
  useEffect(() => { setPage(current => Math.min(current, pageCount)) }, [pageCount])

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

  const handleLoadSeeds = async () => {
    setLoadingSeeds(true)
    setImportError('')
    try {
      const res = await loadSeedVocabulary()
      setLoadResult(res)
      await refreshAll()
    } catch (e) {
      setImportError(`加载种子失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoadingSeeds(false)
    }
  }

  const handleFile = async (file: File) => {
    setImporting(true)
    setImportError('')
    setImportResult(null)
    try {
      const text = await file.text()
      const raw = file.name.toLowerCase().endsWith('.csv') ? parseVocabCSV(text) : parseVocabJSON(text)
      const res = await importVocabEntries(raw)
      setImportResult(res)
      await refreshAll()
    } catch (e) {
      setImportError(`导入失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleTargetChange = (value: string) => {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1 || n > DAILY_TARGET_MAX) return
    try {
      saveDailyTarget(n)
      setTarget(n)
      setDailyError('')
    } catch {
      setDailyError('无法保存每日新词目标，请检查浏览器存储。')
    }
  }

  const handleFavorite = async (entry: VocabEntry) => {
    if (entry.id === undefined) return
    try {
      await toggleFavorite(entry.id, !entry.favorite)
    } catch {
      setListError('收藏未保存，请重试。')
    }
  }

  // 发音：调 speech.ts 的 speakKorean（ko-KR + 语速）；播完恢复按钮。
  // speechSynthesis.speaking 轮询判断播完，无语音时 speakKorean 仍会尝试，
  // 但 voiceNote 已提前把原因告诉用户。
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

  const pendingList = pendingSource
    ? pendingBySource.filter((x) => x.source === pendingSource)
    : pendingBySource

  const filtered = Boolean(keyword.trim() || lesson || level || pos || status || favoriteOnly || mastery)
  const todayWords = daily?.words ?? []
  const selected = list.find(word => word.id === selectedId) ??
    (filtered ? undefined : todayWords.find(word => word.id === selectedId))
  const word = selected ?? (filtered ? list[0] : todayWords[0] ?? list[0])
  const words = word && !filtered && todayWords.some(item => item.id === word.id) ? todayWords : list
  const index = words.findIndex(item => item.id === word?.id)

  function chooseWord(entry: VocabEntry) {
    setSelectedId(entry.id)
    studyRef.current?.focus({ preventScroll: true })
    studyRef.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <section className="v4-study vocab-v4">
      <header className="vocab-v4-header">
        <GardenBack onClick={onBack}>返回首页</GardenBack>
        <GardenPageTitle>词汇</GardenPageTitle>
      </header>

      <div className="vocab-v4-layout">
        <section className="vocab-v4-study" aria-labelledby="vocab-v4-title">
          <div className="vocab-v4-study-head">
            <h2 id="vocab-v4-title" tabIndex={-1} ref={studyRef}>每日单词</h2>
            <label>每日新词目标 <input type="number" min={1} max={DAILY_TARGET_MAX} value={target}
              onChange={event => handleTargetChange(event.target.value)} /></label>
          </div>
          {dailyError && <GardenNotice tone="error">{dailyError}</GardenNotice>}
          {!daily && !dailyError && <p role="status" className="study-muted">正在读取每日背词进度……</p>}
          {daily && <>
            <GardenProgress label="今日已学新词" max={target} value={Math.min(daily.completed, target)}>
              {daily.completed} / {target} 个
            </GardenProgress>
            {daily.completed >= target && <p className="study-muted">今日新词目标已完成。</p>}
            {daily.completed < target && daily.words.length === 0 && <p className="study-muted">词库里没有更多未学词，可先加载种子或导入词表。</p>}
          </>}
          {word ? <>
            <PearlWordCard key={word.id} word={word} speaking={speakingId === word.id}
              onSpeak={() => handleSpeak(word)} onFavorite={() => void handleFavorite(word)} />
            {words.length > 1 && <nav className="vocab-v4-word-nav" aria-label="单词卡顺序">
              <button type="button" className="study-secondary" disabled={index < 1}
                onClick={() => setSelectedId(words[index - 1].id)}>上一词</button>
              <label><span className="vocab-v4-sr">选择词条</span>
                <select value={word.id} onChange={event => setSelectedId(Number(event.target.value))}>
                  {words.map((entry, position) => <option key={entry.id} value={entry.id}>{position + 1} / {words.length} · {entry.ko}</option>)}
                </select>
              </label>
              <button type="button" className="study-secondary" disabled={index === words.length - 1}
                onClick={() => setSelectedId(words[index + 1].id)}>下一词</button>
            </nav>}
          </> : <div className="study-panel vocab-v4-empty">
            <p>{filtered ? '当前筛选没有可学习的词条。' : '从词库加载或导入单词后，就可以逐张学习。'}</p>
            {!filtered && <a href="#/vocab" onClick={event => {
              event.preventDefault()
              document.getElementById('vocab-v4-import')?.scrollIntoView({ block: 'start' })
            }}>前往词库导入</a>}
          </div>}
          {speakError && <GardenNotice tone="error">{speakError}</GardenNotice>}
          <details className="vocab-v4-speech study-panel">
            <summary>发音设置</summary>
            <label className="vocab-v4-rate">语速
              <input type="range" min={0.5} max={1.5} step={0.1} value={speechRate}
                onChange={event => handleRateChange(event.target.value)} /> {speechRate.toFixed(1)}x
            </label>
            <p className="study-muted">语音：{voiceNote}</p>
          </details>
        </section>

        <section className="vocab-v4-library study-panel" aria-labelledby="vocab-v4-library-title">
          <h2 id="vocab-v4-library-title">浏览词汇</h2>
          <label className="vocab-v4-search">搜索
            <input type="search" value={keyword} onChange={event => setKeyword(event.target.value)}
              placeholder="输入韩文或中文" />
          </label>
          <details className="vocab-v4-filter">
            <summary>筛选词汇{filtered && ' · 已筛选'}</summary>
            <div className="vocab-v4-filter-grid">
              <label>
                延世课次：
                <select value={lesson} onChange={(e) => setLesson(e.target.value)}>
                  <option value="">全部</option>
                  {options.lessons.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                来源分级：
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="">全部</option>
                  {options.levels.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                词性：
                <select value={pos} onChange={(e) => setPos(e.target.value)}>
                  <option value="">全部</option>
                  {options.poses.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                状态：
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">全部</option>
                  <option value="待核实">待核实</option>
                  <option value="已核实">已核实</option>
                  <option value="补充">补充</option>
                </select>
              </label>
              <label>
                掌握度：
                <select value={mastery} onChange={(e) => setMastery(e.target.value)}>
                  <option value="">全部</option>
                  <option value="未学">未学（从未打过分）</option>
                  {MASTERY_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={favoriteOnly}
                  onChange={(e) => setFavoriteOnly(e.target.checked)}
                />{' '}
                仅看收藏
              </label>
            </div>
          </details>
          {listError && <GardenNotice tone="error">{listError}</GardenNotice>}
          <p className="study-muted" aria-live="polite">
            共 <strong>{matches.length}</strong> 条{list.length > 0 && ('，显示第 ' + (offset + 1) + '–' + (offset + list.length) + ' 条')}。
          </p>
          {pageCount > 1 && <nav className="vocab-v4-pagination" aria-label="词汇分页">
            <button type="button" className="study-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</button>
            <label>页码 <select value={page} onChange={event => setPage(Number(event.target.value))}>
              {Array.from({ length: pageCount }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
            </select> / {pageCount}</label>
            <button type="button" className="study-secondary" disabled={page === pageCount} onClick={() => setPage(page + 1)}>下一页</button>
          </nav>}
          {list.length === 0 ? <p className="study-muted">没有符合条件的词。可换个搜索词或筛选条件。</p> : (
            <table className="vocab-v4-list">
              <thead><tr><th scope="col">词条</th><th scope="col">操作</th></tr></thead>
              <tbody>
                {list.map(entry => <tr key={entry.id} data-selected={word?.id === entry.id || undefined}>
                  <th scope="row">
                    <button className="vocab-v4-select-word" type="button" lang="ko"
                      aria-label={'学习此词 ' + entry.ko} aria-current={word?.id === entry.id ? 'true' : undefined}
                      onClick={() => chooseWord(entry)}>{entry.ko}</button>
                    {entry.id !== word?.id && <span className="vocab-v4-row-meaning">{entry.zh || '待补'}</span>}
                    <span className="vocab-v4-row-meta">{[entry.pos, entry.source, entry.source_level, entry.yonsei_lesson, entry.status].filter(Boolean).join(' · ')}</span>
                  </th>
                  <td>
                    <div className="vocab-v4-list-actions">
                      <StudyHeart saved={entry.favorite} onClick={() => void handleFavorite(entry)} />
                      <StudySpeak word={entry.ko} speaking={speakingId === entry.id} iconOnly onClick={() => handleSpeak(entry)} />
                    </div>
                  </td>
                </tr>)}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="study-panel vocab-v4-import" aria-labelledby="vocab-v4-import">
        <h2 id="vocab-v4-import">词库导入</h2>
        <p className="study-muted">库内共 {total} 条词，待核实 {pendingTotal} 条。内置词表按韩文词条去重。</p>
        <p className="study-muted">公开版提供韩国国立国语院《한국어 학습용 어휘 목록》（2003）A 档词形与词性，经筛选和去重，<a href="https://www.korean.go.kr/front/etcData/etcDataView.do?etc_seq=70" target="_blank" rel="noreferrer">原始资料</a>依 KOGL 第 1 类授权。延世教材词表未内置，可以导入你有权使用的本地词表。</p>
        <div className="study-row">
          <button type="button" className="study-primary" onClick={handleLoadSeeds} disabled={loadingSeeds}>
            {loadingSeeds ? '加载中…' : '加载种子'}
          </button>{' '}
          <button type="button" className="study-secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? '导入中…' : '导入 JSON / CSV 文件'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
            }}
          />
        </div>
        <p className="study-muted">
          文件导入格式：JSON 接受词条数组或 <code>{'{ vocab: [...] }'}</code>；
          CSV 首行必须是表头（含 ko 列，可选 pos / zh / source / source_level / yonsei_lesson / status）。
          来源不全或中文释义为空的条目进待核实池。
        </p>
        {loadResult && (
          <p>
            加载结果：新增 NIKL <strong>{loadResult.addedNikl}</strong> 条、
            已存在跳过 <strong>{loadResult.skippedExisting}</strong> 条；
            当前库内共 <strong>{loadResult.totalAfter}</strong> 条，待核实池{' '}
            <strong>{loadResult.pendingAfter}</strong> 条。
          </p>
        )}
        {importResult && (
          <p>
            导入结果：新增 <strong>{importResult.added}</strong> 条、库内已有跳过{' '}
            <strong>{importResult.skippedExisting}</strong> 条、文件内重复跳过{' '}
            <strong>{importResult.skippedDuplicate}</strong> 条、拒绝{' '}
            <strong>{importResult.rejected}</strong> 条；当前库内共 <strong>{importResult.totalAfter}</strong>{' '}
            条。
            {importResult.rejectReasons.length > 0 && (
              <>拒绝原因：{importResult.rejectReasons.join('；')}</>
            )}
          </p>
        )}
        {importError && <GardenNotice tone="error">{importError}</GardenNotice>}


        <details className="vocab-v4-filter">
          <summary>按来源查看待核实词条</summary>
          <label className="vocab-v4-search">按来源看：
            <select value={pendingSource} onChange={event => setPendingSource(event.target.value)}>
              <option value="">全部来源</option>
              {pendingBySource.map(item => <option key={item.source}>{item.source}</option>)}
            </select>
          </label>
          {pendingList.length === 0 ? <p className="study-muted">此来源暂无待核实词条。</p> : <dl className="vocab-v4-sources">
            {pendingList.map(item => <div key={item.source}><dt>{item.source}</dt><dd>{item.count} 条</dd></div>)}
          </dl>}
        </details>
      </section>
    </section>
  )
}
