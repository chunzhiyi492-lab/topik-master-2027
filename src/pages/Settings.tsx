import { useEffect, useRef, useState } from 'react'
import {
  clearAllData,
  countAttempts,
  countPapers,
  countQuestions,
  countVocab,
  db,
  exportBackupJSON,
  exportRecoverySnapshot,
  importBackupJSON,
  parseBackupJSON,
  type BackupPreview,
} from '../lib/db'

import SelfTest from './SelfTest'
import { clearAllWritingJournals } from '../lib/writing'
import { ReminderSettings } from '../components/StudyReminder'

// 备份包含此设备的学习数据库和考试进度；浏览器偏好与音频文件不在其中。
function downloadJSON(json: string, name: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

interface LocalCounts {
  vocab: number
  reviews: number
  archivedReviews: number
  daily_stats: number
  questions: number
  papers: number
  attempts: number
  textbookProgress: number
  learningResources: number
  stageRuns: number
  grammarStudy: number
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
  const restoring = useRef(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const refreshCounts = async () => {
    const [vocab, reviews, daily_stats, questions, papers, attempts, textbookProgress, learningResources, stageRuns, grammarStudy, archivedReviews] = await Promise.all([
      countVocab(),
      db.reviews.count(),
      db.daily_stats.count(),
      countQuestions(),
      countPapers(),
      countAttempts(),
      db.textbookProgress.count(),
      db.learningResources.count(),
      db.stageRuns.count(),
      db.grammarStudy.count(),
      db.archivedReviews.count(),
    ])
    setCounts({ vocab, reviews, daily_stats, questions, papers, attempts, textbookProgress, learningResources, stageRuns, grammarStudy, archivedReviews })
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
      const name = `topik-master-2027-backup-${stamp}.json`
      downloadJSON(text, name)
      setExportNote(`备份已通过校验并请求下载（${name}）。请在设备的下载目录确认文件已保存。`)
    } catch (e) {
      setError(`导出失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
    }
  }

  const handleExportSnapshot = async () => {
    setError('')
    setExportNote('')
    try {
      const snapshot = await exportRecoverySnapshot()
      if (!snapshot) {
        setExportNote('此设备还没有恢复前快照。')
        return
      }
      downloadJSON(snapshot.json, `topik-before-restore-${snapshot.createdAt.replace(/[:.]/g, '-')}.json`)
      setExportNote('已请求下载恢复前快照，请确认文件已保存。')
    } catch (e) {
      setError(`无法导出快照：${e instanceof Error ? e.message : String(e)}`)
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
    if (!importPreview || !importText || restoring.current) return
    if (
      !window.confirm(
        '确认恢复这份备份吗？验证并保存恢复前快照后，将替换此设备的学习数据库。' +
        (importPreview.includesTextbookProgress ? '备份中的教材进度也会恢复。' : '旧备份不含教材进度，本机教材进度会保留。') +
        (importPreview.includesLearningResources ? '个人资料也会恢复。' : '旧备份不含个人资料，本机个人资料会保留。') +
        (importPreview.includesStageRuns ? '阶段测试也会恢复。' : '旧备份不含阶段测试，本机阶段测试会保留。') +
        (importPreview.includesGrammarStudy ? '语法学习记录也会恢复。' : '旧备份不含语法学习记录，本机语法记录会保留。') +
        (importPreview.includesGrammarFavorites ? '语法收藏也会恢复。' : '本机语法收藏会保留。') +
        (importPreview.includesReadingPassages ? `阅读篇章 ${importPreview.counts.readingPassages} 篇。` : '旧备份不含阅读篇章，恢复会替换本机篇章及其作答；可从恢复前快照取回。') +
        (importPreview.includesWritingDrafts ? `写作草稿 ${importPreview.counts.writingDrafts} 份。` : '旧备份不含写作草稿或自评，已存数据可从恢复前快照取回。') +
        (importPreview.includesArchivedReviews ? '归档复习记录也会恢复。' : '本机已归档的复习记录会保留。') +
        '不会同步到另一台设备。',
      )
    ) {
      return
    }
    restoring.current = true
    setImporting(true)
    setError('')
    setImportNote('')
    try {
      const preview = await importBackupJSON(importText)
      clearAllWritingJournals()
      setImportPreview(null)
      setImportText('')
      setImportFileName('')
      setImportNote(
        `恢复完成：词汇 ${preview.counts.vocab} 条、复习 ${preview.counts.reviews} 条、统计 ${preview.counts.daily_stats} 条、题目 ${preview.counts.questions} 道、试卷 ${preview.counts.papers} 场、答题 ${preview.counts.attempts} 条、模考会话 ${preview.counts.examSessions} 场。` +
        (preview.includesTextbookProgress ? `教材进度 ${preview.counts.textbookProgress} 课。` : '已保留本机教材进度。') +
        (preview.includesLearningResources ? `个人资料 ${preview.counts.learningResources} 条。` : '已保留本机个人资料。') +
        (preview.includesStageRuns ? `阶段测试 ${preview.counts.stageRuns} 次。` : '已保留本机阶段测试。') +
        (preview.includesGrammarStudy ? `语法学习记录 ${preview.counts.grammarStudy} 条。` : '已保留本机语法记录。') +
        (preview.includesGrammarFavorites ? `语法收藏 ${preview.counts.grammarFavorites} 条。` : '已保留本机语法收藏。') +
        (preview.counts.archivedReviews ? `文件内归档复习记录 ${preview.counts.archivedReviews} 条。` : '') +
        '可下载恢复前快照。',
      )
      void refreshCounts().catch(() => setError('恢复已完成，但未能刷新本地计数。'))
    } catch (e) {
      setError(`恢复失败：${e instanceof Error ? e.message : String(e)}（本地数据未被覆盖）`)
    } finally {
      restoring.current = false
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
        '最后确认：清空本地全部数据吗？词汇、复习记录、统计、题目、试卷、答题记录、模考会话、教材进度、个人资料、阶段测试、语法学习记录和恢复前快照都会删除，无法撤销（没有备份的话请先导出）。',
      )
    ) {
      setClearArmed(false)
      return
    }
    setClearing(true)
    try {
      await clearAllData()
      clearAllWritingJournals()
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
      <button type="button" className="secondary garden-back" onClick={onBack}>
        ← 返回首页
      </button>
      <h1>设置</h1>

      {error && <p className="fail">{error}</p>}

      <ReminderSettings />
      <h2>本地数据（#23）</h2>
      {counts ? (
        <p className="garden-band">
          词汇 {counts.vocab} 条 · 复习记录 {counts.reviews} 条 · 统计 {counts.daily_stats} 天 ·
          题目 {counts.questions} 道 · 试卷 {counts.papers} 场 · 答题记录 {counts.attempts} 条
        </p>
      ) : (
        <p>正在读取本地数据……</p>
      )}

      <h2 id="garden-backup-title">备份与恢复（#23）</h2>
      {!!counts?.archivedReviews && (
        <p>已归档 {counts.archivedReviews} 条找不到原词的历史复习记录。它们随备份保留，仍可继续复习有效词卡。</p>
      )}
      <section className="note garden-backup" aria-labelledby="garden-backup-title">
        <p>
          备份含本机学习记录、模考、教材进度、个人资料、阶段测试和语法进度。课表等浏览器偏好、听力音频文件不包含在内。
          Windows 与 iPhone 各自保存数据，请分别导出备份。
        </p>
        <p className="garden-actions">
          <button type="button" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? '正在导出……' : '导出备份（下载 JSON 文件）'}
          </button>
          <button type="button" className="secondary" onClick={() => void handleExportSnapshot()} disabled={importing}>
            下载最近一次恢复前快照
          </button>
        </p>
        <p>恢复前会保存并校验本机快照；只保留最近一次，请及时下载留存。</p>
        {exportNote && <p>{exportNote}</p>}
        <p className="garden-backup-picker">
          <label className="garden-field">
            恢复备份：
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleImportFile(e.target.files?.[0])}
            />
          </label>
        </p>
        {importPreview && (
          <>
            <p>
              备份文件“{importFileName}”校验通过：导出于 {importPreview.exportedAt || '未知时间'}，
              备份格式 v{importPreview.formatVersion}。
            </p>
            <table className="garden-metrics">
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
                {(importPreview.counts.archivedReviews > 0 || !!counts?.archivedReviews) && (
                  <tr>
                    <td>归档复习记录</td>
                    <td>{importPreview.counts.archivedReviews} 条</td>
                    <td>{counts?.archivedReviews ?? '—'} 条</td>
                  </tr>
                )}
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
                <tr>
                  <td>模考会话</td>
                  <td>{importPreview.counts.examSessions} 场</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>教材进度</td>
                  <td>{importPreview.includesTextbookProgress ? `${importPreview.counts.textbookProgress} 课` : '旧备份不含此项，保留本机进度'}</td>
                  <td>{counts?.textbookProgress ?? '—'} 课</td>
                </tr>
                <tr>
                  <td>个人资料</td>
                  <td>{importPreview.includesLearningResources ? `${importPreview.counts.learningResources} 条` : '旧备份不含此项，保留本机资料'}</td>
                  <td>{counts?.learningResources ?? '—'} 条</td>
                </tr>
                <tr>
                  <td>阶段测试</td>
                  <td>{importPreview.includesStageRuns ? `${importPreview.counts.stageRuns} 次` : '旧备份不含此项，保留本机记录'}</td>
                  <td>{counts?.stageRuns ?? '—'} 次</td>
                </tr>
                <tr>
                  <td>语法学习记录</td>
                  <td>{importPreview.includesGrammarStudy ? `${importPreview.counts.grammarStudy} 条` : '旧备份不含此项，保留本机语法记录'}</td>
                  <td>{counts?.grammarStudy ?? '—'} 条</td>
                </tr>
              </tbody>
            </table>
            <p className="garden-actions">
              <button type="button" className="garden-destructive" onClick={() => void handleConfirmImport()} disabled={importing}>
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
      </section>

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

      <h2 id="garden-clear-title">清空全部数据</h2>
      <section className="note garden-clear" aria-labelledby="garden-clear-title">
        <p className="garden-actions">
          <button type="button" className="secondary garden-destructive" onClick={() => void handleClear()} disabled={clearing}>
            {clearing ? '正在清空……' : clearArmed ? '确认清空全部数据' : '清空全部数据'}
          </button>{' '}
          {clearArmed && (
            <span className="fail">
              点一次只是“准备清空”，再点一次并确认后才会真的删。没有备份的话请先导出备份。
            </span>
          )}
        </p>
      </section>

      <h2>自测（开发期自检）</h2>
      <SelfTest />
    </>
  )
}
