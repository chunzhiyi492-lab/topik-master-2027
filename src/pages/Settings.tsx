import { useEffect, useRef, useState } from 'react'
import {
  clearAllData,
  countAttempts,
  countPapers,
  countQuestions,
  countVocab,
  db,
  exportBackupJSON,
  importBackupJSON,
  parseBackupJSON,
  type BackupPreview,
} from '../lib/db'

import SelfTest from './SelfTest'

// TOPIK MASTER 2027 — 设置页（P7：#23 本地备份与恢复、#24 离线使用与安装）
// 口径（P7 定死）：
// - 备份 = 整库六类数据（词汇 / 复习记录 / 统计 / 题目 / 试卷 / 答题记录）
//   全量导出为一个 JSON 文件，只存本机，不上传任何地方。
// - 恢复 = 先校验格式与版本、给用户看备份里各有多少条、再二次确认，才一次性覆盖
//   本地全部数据；校验不过整份拒绝、不写半份数据，失败明确报错。
// - 离线：应用外壳（Service Worker 缓存）+ 已导入的数据断网可练；听力音频文件
//   本身不进缓存，断网后需本机仍有该音频文件才能播。
// - 安装：本应用不做应用商店上架；只写浏览器自带的安装路径，不编造不支持的能力
//   （iOS Safari 没有安装弹窗，只能手动“添加到主屏幕”）。

interface LocalCounts {
  vocab: number
  reviews: number
  daily_stats: number
  questions: number
  papers: number
  attempts: number
}

export default function Settings({ onBack }: { onBack: () => void }) {
  const [counts, setCounts] = useState<LocalCounts | null>(null)
  const [error, setError] = useState('')
  const [exportNote, setExportNote] = useState('')
  const [exporting, setExporting] = useState(false)
  const [importPreview, setImportPreview] = useState<BackupPreview | null>(null)
  const [importFileName, setImportFileName] = useState('')
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [clearArmed, setClearArmed] = useState(false)
  const [clearing, setClearing] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const refreshCounts = async () => {
    const [vocab, reviews, daily_stats, questions, papers, attempts] = await Promise.all([
      countVocab(),
      db.reviews.count(),
      db.daily_stats.count(),
      countQuestions(),
      countPapers(),
      countAttempts(),
    ])
    setCounts({ vocab, reviews, daily_stats, questions, papers, attempts })
  }

  useEffect(() => {
    void refreshCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleExport = async () => {
    setError('')
    setExportNote('')
    setExporting(true)
    try {
      const text = await exportBackupJSON()
      const now = new Date()
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `topik-master-2027-backup-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      const parsed: unknown = JSON.parse(text)
      const n = (parsed as { vocab?: unknown[] }).vocab?.length ?? 0
      setExportNote(
        `已导出备份文件（${a.download}）：词汇 ${counts?.vocab ?? n} 条等六类数据都在，文件是标准 JSON，可用文本编辑器打开检查。`,
      )
    } catch (e) {
      setError(`导出失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setImportNote('')
    setImportPreview(null)
    setImportText('')
    setImportFileName(file.name)
    try {
      const text = await file.text()
      // 只解析校验、不写库；通过才给用户看预览、等确认后再恢复。
      const { preview } = parseBackupJSON(text)
      setImportText(text)
      setImportPreview(preview)
    } catch (e) {
      setError(`备份文件校验失败（未写入任何数据）：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleConfirmImport = async () => {
    if (!importPreview || !importText) return
    if (
      !window.confirm(
        '确认恢复这份备份吗？会覆盖本地全部数据（词汇、复习记录、统计、题目、试卷、答题记录），当前数据将被替换，无法撤销。',
      )
    ) {
      return
    }
    setImporting(true)
    setError('')
    setImportNote('')
    try {
      const preview = await importBackupJSON(importText)
      setImportPreview(null)
      setImportText('')
      setImportFileName('')
      setImportNote(
        `恢复完成：词汇 ${preview.counts.vocab} 条、复习 ${preview.counts.reviews} 条、统计 ${preview.counts.daily_stats} 条、题目 ${preview.counts.questions} 道、试卷 ${preview.counts.papers} 场、答题 ${preview.counts.attempts} 条（备份导出于 ${preview.exportedAt || '未知时间'}）。`,
      )
      await refreshCounts()
    } catch (e) {
      setError(`恢复失败：${e instanceof Error ? e.message : String(e)}（本地数据未被覆盖）`)
    } finally {
      setImporting(false)
    }
  }

  const handleClear = async () => {
    if (!clearArmed) {
      setClearArmed(true)
      return
    }
    if (
      !window.confirm(
        '最后确认：清空本地全部数据吗？词汇、复习记录、统计、题目、试卷、答题记录都会删除，无法撤销（没有备份的话请先导出）。',
      )
    ) {
      setClearArmed(false)
      return
    }
    setClearing(true)
    try {
      await clearAllData()
      setClearArmed(false)
      await refreshCounts()
    } catch (e) {
      setError(`清空失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setClearing(false)
    }
  }

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true)
  const swControlling =
    typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller

  return (
    <>
      <button type="button" className="secondary" onClick={onBack}>
        ← 返回首页
      </button>
      <h1>设置</h1>

      {error && <p className="fail">{error}</p>}

      <h2>本地数据（#23）</h2>
      {counts ? (
        <p>
          词汇 {counts.vocab} 条 · 复习记录 {counts.reviews} 条 · 统计 {counts.daily_stats} 天 ·
          题目 {counts.questions} 道 · 试卷 {counts.papers} 场 · 答题记录 {counts.attempts} 条
        </p>
      ) : (
        <p>正在读取本地数据……</p>
      )}

      <h2>备份与恢复（#23）</h2>
      <div className="note">
        <p>
          备份文件是单个 JSON，含整库六类数据（词汇、复习记录、统计、题目、试卷、答题记录）
          与导出时间、格式版本。只下载到本机，不上传任何地方。
        </p>
        <p>
          <button type="button" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? '正在导出……' : '导出备份（下载 JSON 文件）'}
          </button>
        </p>
        {exportNote && <p>{exportNote}</p>}
        <p>
          恢复备份：
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleImportFile(e.target.files?.[0])}
          />
        </p>
        {importPreview && (
          <>
            <p>
              备份文件“{importFileName}”校验通过：导出于 {importPreview.exportedAt || '未知时间'}，
              格式版本 {importPreview.dexieVersion}（Dexie 版本号，仅供核对）。
            </p>
            <table>
              <thead>
                <tr>
                  <th>数据</th>
                  <th>备份里</th>
                  <th>本地现在</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>词汇</td>
                  <td>{importPreview.counts.vocab} 条</td>
                  <td>{counts?.vocab ?? '—'} 条</td>
                </tr>
                <tr>
                  <td>复习记录</td>
                  <td>{importPreview.counts.reviews} 条</td>
                  <td>{counts?.reviews ?? '—'} 条</td>
                </tr>
                <tr>
                  <td>统计</td>
                  <td>{importPreview.counts.daily_stats} 天</td>
                  <td>{counts?.daily_stats ?? '—'} 天</td>
                </tr>
                <tr>
                  <td>题目</td>
                  <td>{importPreview.counts.questions} 道</td>
                  <td>{counts?.questions ?? '—'} 道</td>
                </tr>
                <tr>
                  <td>试卷</td>
                  <td>{importPreview.counts.papers} 场</td>
                  <td>{counts?.papers ?? '—'} 场</td>
                </tr>
                <tr>
                  <td>答题记录</td>
                  <td>{importPreview.counts.attempts} 条</td>
                  <td>{counts?.attempts ?? '—'} 条</td>
                </tr>
              </tbody>
            </table>
            <p>
              <button type="button" onClick={() => void handleConfirmImport()} disabled={importing}>
                {importing ? '正在恢复……' : '确认恢复并覆盖本地数据'}
              </button>{' '}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setImportPreview(null)
                  setImportText('')
                  setImportFileName('')
                }}
              >
                取消
              </button>
            </p>
          </>
        )}
        {importNote && <p>{importNote}</p>}
      </div>

      <h2>离线使用与安装（#24）</h2>
      <div className="note">
        <p>
          当前状态：{isStandalone ? '已作为独立应用打开（添加到主屏幕 / 已安装）' : '在浏览器里打开'}
          · Service Worker {swControlling ? '已接管本页（离线可用）' : '尚未接管本页（刚打开时可能需要刷新一次）'}。
        </p>
        <p>
          <b>离线使用：</b>首次打开后，应用页面与已导入的数据（词汇、题目、答题记录）缓存在本机；
          断网后重新打开仍可练已导入的内容。听力音频文件本身不进缓存——断网后想听音频，
          需本机仍有该音频文件，练习时重新选择文件即可。
        </p>
        <p>
          <b>iPhone（Safari）：</b>点底部分享按钮 → “添加到主屏幕” → 添加。之后从主屏幕图标打开，
          像 App 一样全屏使用、离线可用。iOS Safari 没有“安装应用”弹窗，只能手动添加到主屏幕，
          这是苹果的限制，不是本应用的问题。
        </p>
        <p>
          <b>电脑（Chrome / Edge）：</b>地址栏右侧出现安装图标时点它，或点浏览器菜单 → “安装应用” /
          “保存并分享” → 安装。装好后从桌面或开始菜单打开，离线可用。没有出现安装图标时，
          直接收藏网址同样能用（Service Worker 缓存不依赖安装）。
        </p>
        <p>注意：本应用不上架任何应用商店；换设备后数据不会自动同步，请用上方“导出备份”把 JSON 文件带过去再恢复。</p>
      </div>

      <h2>清空全部数据</h2>
      <p>
        <button type="button" className="secondary" onClick={() => void handleClear()} disabled={clearing}>
          {clearing ? '正在清空……' : clearArmed ? '确认清空全部数据' : '清空全部数据'}
        </button>{' '}
        {clearArmed && (
          <span className="fail">
            点一次只是“准备清空”，再点一次并确认后才会真的删。没有备份的话请先导出备份。
          </span>
        )}
      </p>

      <h2>自测（开发期自检）</h2>
      <SelfTest />
    </>
  )
}
