import { useEffect, useRef, useState } from 'react'
import {
  countVocab,
  countPendingBySource,
  getAllVocab,
  getFilterOptions,
  getUnlearnedVocab,
  getVocabByMastery,
  searchVocab,
  toggleFavorite,
  type VocabEntry,
} from '../lib/db'
import { isSpeechSupported, listKoreanVoices, speakKorean } from '../lib/speech'
import type { GradeLabel } from '../lib/srs'
import {
  importVocabEntries,
  loadSeedVocabulary,
  parseVocabCSV,
  parseVocabJSON,
  type ImportEntriesResult,
  type LoadSeedResult,
} from '../lib/import'

// TOPIK MASTER 2027 — 词汇页（P1：#8 导入与核对、#4 搜索与筛选、#1 每日背词计划）
// 功能页先用朴素结构实现，主题样式等薯饼拍板后再接入。
// 铁律：全部种子只进待核实池（加载器强制 status=待核实）；无中文释义的词显示“待补”，不编造。

const DAILY_TARGET_KEY = 'topik-master-p1-daily-target'
const SPEECH_RATE_KEY = 'topik-master-speech-rate'
const LIST_LIMIT = 200

const MASTERY_GRADES: GradeLabel[] = ['不认识', '模糊', '认识', '很熟']

function loadDailyTarget(): number {
  const raw = Number(window.localStorage.getItem(DAILY_TARGET_KEY) ?? '')
  return Number.isInteger(raw) && raw >= 1 && raw <= 200 ? raw : 20
}

/** 语速 0.5–1.5，默认 0.9（与 speech.ts 一致），存在 localStorage。 */
function loadSpeechRate(): number {
  const raw = Number(window.localStorage.getItem(SPEECH_RATE_KEY) ?? '')
  return raw >= 0.5 && raw <= 1.5 ? raw : 0.9
}

export default function Vocab({ onBack }: { onBack: () => void }) {
  const [total, setTotal] = useState(0)
  const [pendingBySource, setPendingBySource] = useState<{ source: string; count: number }[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [list, setList] = useState<VocabEntry[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [options, setOptions] = useState<{ lessons: string[]; levels: string[]; poses: string[] }>({
    lessons: [],
    levels: [],
    poses: [],
  })
  const [keyword, setKeyword] = useState('')
  const [lesson, setLesson] = useState('')
  const [level, setLevel] = useState('')
  const [pos, setPos] = useState('')
  const [status, setStatus] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [mastery, setMastery] = useState('')
  const [masteryIds, setMasteryIds] = useState<Set<number>>(new Set())
  const [speechRate, setSpeechRate] = useState<number>(() => loadSpeechRate())
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  const [voiceNote, setVoiceNote] = useState('')
  const [speakError, setSpeakError] = useState('')
  const [pendingSource, setPendingSource] = useState('')
  const [target, setTarget] = useState<number>(() => loadDailyTarget())
  const [todayList, setTodayList] = useState<VocabEntry[]>([])
  const [loadingSeeds, setLoadingSeeds] = useState(false)
  const [importing, setImporting] = useState(false)
  const [loadResult, setLoadResult] = useState<LoadSeedResult | null>(null)
  const [importResult, setImportResult] = useState<ImportEntriesResult | null>(null)
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const refreshCounts = async () => {
    const [t, bySource] = await Promise.all([countVocab(), countPendingBySource()])
    setTotal(t)
    setPendingBySource(bySource)
    setPendingTotal(bySource.reduce((s, x) => s + x.count, 0))
  }

  const refreshList = async () => {
    const base = keyword.trim() ? await searchVocab(keyword) : await getAllVocab()
    const filtered = base.filter(
      (v) =>
        (!lesson || v.yonsei_lesson === lesson) &&
        (!level || v.source_level === level) &&
        (!pos || v.pos === pos) &&
        (!status || v.status === status) &&
        (!favoriteOnly || v.favorite) &&
        (!mastery || masteryIds.has(v.id ?? -1)),
    )
    setListTotal(filtered.length)
    setList(filtered.slice(0, LIST_LIMIT))
  }

  const refreshToday = async (n: number) => {
    setTodayList(await getUnlearnedVocab(n))
  }

  const refreshAll = async () => {
    await refreshCounts()
    await refreshList()
    await refreshToday(loadDailyTarget())
    setOptions(await getFilterOptions())
  }

  useEffect(() => {
    void refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 筛选条件变化时刷新列表（不重新读总数与今日列表）。
  useEffect(() => {
    void refreshList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, lesson, level, pos, status, favoriteOnly, masteryIds])

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
    if (!Number.isInteger(n) || n < 1 || n > 200) return
    setTarget(n)
    window.localStorage.setItem(DAILY_TARGET_KEY, String(n))
    void refreshToday(n)
  }

  const handleFavorite = async (entry: VocabEntry) => {
    if (entry.id === undefined) return
    await toggleFavorite(entry.id, !entry.favorite)
    await refreshList()
  }

  // 掌握度筛选（P2 留给 P3 的收尾）：按最新一次打分档位筛；“未学”= 从未打过分。
  const handleMasteryChange = async (value: string) => {
    setMastery(value)
    if (!value) {
      setMasteryIds(new Set())
      return
    }
    const list =
      value === '未学'
        ? await getUnlearnedVocab(10000)
        : await getVocabByMastery(value as GradeLabel)
    setMasteryIds(
      new Set(list.map((v) => v.id).filter((id): id is number => id !== undefined)),
    )
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

  return (
    <>
      <p>
        <button type="button" className="secondary" onClick={onBack}>
          ← 返回首页
        </button>
      </p>
      <h1>词汇</h1>
      <p>
        库内共 <strong>{total}</strong> 条词，其中待核实池 <strong>{pendingTotal}</strong> 条。
        全部种子只进待核实池；无中文释义的词显示“待补”，不编造。
      </p>

      <h2>导入与核对（#8）</h2>
      <div className="note">
        内置种子：NIKL A 级 925 条 + 延世 1–6 册 7,552 条（1–2 册 1,960、3 册 962、
        4 册 1,056、5 册 1,744、6 册 1,830，含文化页补入的 105 词）。六批之间有相同韩文词，
        加载时按词合并补全字段（后批的中文释义与课次补进已有条），去重后共 7,707 条。
        全部种子一律按“待核实”入库。重复点“加载种子”不会重复入库。
      </div>
      <p>
        <button type="button" onClick={handleLoadSeeds} disabled={loadingSeeds}>
          {loadingSeeds ? '加载中…' : '加载种子'}
        </button>{' '}
        <button type="button" className="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
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
      </p>
      <p>
        文件导入格式：JSON 接受词条数组或 <code>{'{ vocab: [...] }'}</code>；
        CSV 首行必须是表头（含 ko 列，可选 pos / zh / source / source_level / yonsei_lesson / status）。
        来源不全或中文释义为空的条目进待核实池。
      </p>
      {loadResult && (
        <p>
          加载结果：新增 NIKL <strong>{loadResult.addedNikl}</strong> 条、新增延世{' '}
          <strong>{loadResult.addedYonsei}</strong> 条、两批合并 <strong>{loadResult.merged}</strong> 条、
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
      {importError && <p className="fail">{importError}</p>}

      <h2>待核实池</h2>
      <p>
        <label>
          按来源看：
          <select value={pendingSource} onChange={(e) => setPendingSource(e.target.value)}>
            <option value="">全部来源</option>
            {pendingBySource.map((x) => (
              <option key={x.source} value={x.source}>
                {x.source}
              </option>
            ))}
          </select>
        </label>
      </p>
      {pendingList.length === 0 ? (
        <p>待核实池是空的。点“加载种子”把种子写进来。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>来源</th>
              <th>条数</th>
            </tr>
          </thead>
          <tbody>
            {pendingList.map((x) => (
              <tr key={x.source}>
                <td>{x.source}</td>
                <td>{x.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>每日背词计划（#1）</h2>
      <p>
        <label>
          每日新词目标：
          <input
            type="number"
            min={1}
            max={200}
            value={target}
            onChange={(e) => handleTargetChange(e.target.value)}
            style={{ width: 80, marginLeft: 8 }}
          />{' '}
          个（默认 20 个，改完自动保存）
        </label>
      </p>
      <p>
        今日新词 <strong>{todayList.length}</strong> 条（未学过的新词，按入库顺序取前 {target} 条；
        学过的词由复习页按 FSRS 安排，今日列表不再重复出现）。
      </p>
      {todayList.length === 0 ? (
        <p>今日新词是空的：库里没有未学的词了，先点“加载种子”。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>韩文</th>
              <th>中文</th>
              <th>来源</th>
            </tr>
          </thead>
          <tbody>
            {todayList.map((v) => (
              <tr key={v.id}>
                <td>{v.ko}</td>
                <td>{v.zh || '待补'}</td>
                <td>
                  {v.source} · {v.source_level}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>浏览与筛选（#4）</h2>
      <p>
        <label>
          搜索：
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="韩文或中文，如 안녕、问候"
            style={{ width: 220, marginLeft: 8 }}
          />
        </label>
      </p>
      <p>
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
        </label>{' '}
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
        </label>{' '}
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
        </label>{' '}
        <label>
          状态：
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部</option>
            <option value="待核实">待核实</option>
            <option value="已核实">已核实</option>
            <option value="补充">补充</option>
          </select>
        </label>{' '}
        <label>
          掌握度：
          <select value={mastery} onChange={(e) => void handleMasteryChange(e.target.value)}>
            <option value="">全部</option>
            <option value="未学">未学（从未打过分）</option>
            {MASTERY_GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          <input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(e) => setFavoriteOnly(e.target.checked)}
          />{' '}
          仅看收藏
        </label>
      </p>
      <h3>发音（#6）</h3>
      <p>
        <label>
          语速：
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.1}
            value={speechRate}
            onChange={(e) => handleRateChange(e.target.value)}
            style={{ verticalAlign: 'middle' }}
          />{' '}
          {speechRate.toFixed(1)}x（0.5 最慢，1.5 最快）
        </label>
      </p>
      <p>语音：{voiceNote}</p>
      {speakError && <p className="fail">{speakError}</p>}
      <p>
        共 <strong>{listTotal}</strong> 条
        {listTotal > LIST_LIMIT && `，仅显示前 ${LIST_LIMIT} 条（请缩小筛选范围）`}。
      </p>
      {list.length === 0 ? (
        <p>没有符合条件的词。库是空的先点“加载种子”；有词但筛不到，换个条件试试。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>韩文</th>
              <th>词性</th>
              <th>中文</th>
              <th>来源</th>
              <th>课次</th>
              <th>状态</th>
              <th>收藏</th>
              <th>发音</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id}>
                <td>{v.ko}</td>
                <td>{v.pos || '—'}</td>
                <td>{v.zh || '待补'}</td>
                <td>
                  {v.source} · {v.source_level}
                </td>
                <td>{v.yonsei_lesson || '—'}</td>
                <td>{v.status}</td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void handleFavorite(v)}
                    aria-label={v.favorite ? '取消收藏' : '收藏'}
                  >
                    {v.favorite ? '★' : '☆'}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleSpeak(v)}
                    aria-label={`朗读 ${v.ko}`}
                  >
                    {speakingId === v.id ? '朗读中…' : '🔊 发音'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
