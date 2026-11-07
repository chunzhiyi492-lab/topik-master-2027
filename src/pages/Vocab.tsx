import { useEffect, useRef, useState } from 'react'
import {
  countVocab,
  countPendingBySource,
  getAllVocab,
  getFilterOptions,
  getUnlearnedVocab,
  searchVocab,
  toggleFavorite,
  type VocabEntry,
} from '../lib/db'
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
const LIST_LIMIT = 200

function loadDailyTarget(): number {
  const raw = Number(window.localStorage.getItem(DAILY_TARGET_KEY) ?? '')
  return Number.isInteger(raw) && raw >= 1 && raw <= 200 ? raw : 20
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
        (!favoriteOnly || v.favorite),
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
  }, [keyword, lesson, level, pos, status, favoriteOnly])

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
        内置种子：NIKL A 级 925 条 + 延世《听力与阅读 1-1》1–10 课 375 条。
        两批之间有 128 个相同韩文词，加载时按词合并补全字段（延世的中文释义与课次补进 NIKL 条），
        去重后共 1172 条。延世文件里 371 条写的是“已核实”，因三项决定未定，
        本次加载一律按“待核实”入库。重复点“加载种子”不会重复入库。
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
          <input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(e) => setFavoriteOnly(e.target.checked)}
          />{' '}
          仅看收藏
        </label>
      </p>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
