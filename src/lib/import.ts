// TOPIK MASTER 2027 — 词汇导入（P1，#8）
// 种子加载器 + 用户文件导入（JSON / CSV），去重合并，待核实池分流。
//
// 铁律（2026-11-07 定，见分期建议 §4）：
// - 延世种子的三个决定未定（4 个对话词是否补入、4 个无释义词的中文释义、实书版权页/ISBN），
//   NIKL 官方复核也没做——全部种子只写进待核实池（status=待核实），绝不标“已核实”。
//   注意：data/yonsei-1-seed.json 文件里 371 条写的是“已核实”，加载器在这里强制改成“待核实”。
// - 无中文释义的词显示“待补”，不编造任何释义、例句或词条。
// - data/ 下的种子文件本身不动；不升 Dexie 版本、不动表结构。

import { db, type VocabEntry, type VocabSource, type VocabStatus } from './db'
import niklSeedJson from '../../data/vocab-seed.json'
import yonseiSeedJson from '../../data/yonsei-1-seed.json'
import yonsei3SeedJson from '../../data/yonsei-3-seed.json'
import yonsei4SeedJson from '../../data/yonsei-4-seed.json'
import yonsei5SeedJson from '../../data/yonsei-5-seed.json'
import yonsei6SeedJson from '../../data/yonsei-6-seed.json'

export interface LoadSeedResult {
  /** NIKL 种子新入库条数 */
  addedNikl: number
  /** 延世种子新入库条数（不含与 NIKL 合并的） */
  addedYonsei: number
  /** 两批种子间按 ko 重叠、合并补全字段的条数 */
  merged: number
  /** 库里已有（按 ko 判重）而跳过的条数 */
  skippedExisting: number
  /** 本次加载后库内词条总数 */
  totalAfter: number
  /** 本次加载后待核实池总数 */
  pendingAfter: number
}

export interface ImportEntriesResult {
  /** 新入库条数 */
  added: number
  /** 与库内已有 ko 重复而跳过的条数 */
  skippedExisting: number
  /** 文件内重复 ko 而跳过的条数 */
  skippedDuplicate: number
  /** 字段不合法而拒绝的条数 */
  rejected: number
  /** 拒绝原因（前 5 条） */
  rejectReasons: string[]
  /** 本次导入后库内词条总数 */
  totalAfter: number
}

const VALID_SOURCES: VocabSource[] = ['NIKL', 'TOPIK', '课程参考', '测试']
const VALID_STATUSES: VocabStatus[] = ['已核实', '待核实', '补充']

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * 规范化一条原始词条。返回 null 表示字段不合法（ko 为空，或 source 不在允许范围）。
 * status 规则：zh 为空或 source_level 为空 → 强制“待核实”；
 * 否则保留原 status（只接受 已核实/待核实/补充 三种，其他值一律改成“待核实”）。
 */
function normalizeEntry(raw: unknown): { entry: Omit<VocabEntry, 'id'> } | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: '不是对象' }
  const r = raw as Record<string, unknown>
  const ko = asString(r.ko)
  if (!ko) return { error: 'ko 为空' }
  const sourceRaw = asString(r.source)
  if (!VALID_SOURCES.includes(sourceRaw as VocabSource)) {
    return { error: `ko=${ko} 的 source 不合法：${sourceRaw || '（空）'}（只接受 NIKL / TOPIK / 课程参考 / 测试）`}
  }
  const zh = asString(r.zh)
  const sourceLevel = asString(r.source_level)
  const statusRaw = asString(r.status) as VocabStatus
  const status: VocabStatus =
    !zh || !sourceLevel
      ? '待核实'
      : VALID_STATUSES.includes(statusRaw)
        ? statusRaw
        : '待核实'
  return {
    entry: {
      ko,
      pos: asString(r.pos),
      zh,
      source: sourceRaw as VocabSource,
      source_level: sourceLevel,
      yonsei_lesson: asString(r.yonsei_lesson),
      status,
      example_ko: asString(r.example_ko),
      example_zh: asString(r.example_zh),
      favorite: r.favorite === true,
      isTestData: false,
    },
  }
}

/**
 * 加载六批内置种子进 IndexedDB。
 * 顺序：先 NIKL（925 条），后延世 1–2 册（1,960 条）、3 册（962 条）、4 册（1,045 条）、
 * 5 册（1,699 条）、6 册（1,781 条），六批去重后共 7,605 条。
 * - 按 ko 判重：库里已有的跳过；延世各批之间重叠的 ko，把后批条的 zh / yonsei_lesson /
 *   pos（后批 pos 为空时不覆盖）补进已入库的条，不另建新条。
 * - 全部强制 status=待核实（见本文件顶部铁律）。
 * 重复点“加载种子”不会重复入库（ko 已存在即跳过）。
 */
export async function loadSeedVocabulary(): Promise<LoadSeedResult> {
  const existing = await db.vocab.toArray()
  const existingByKo = new Map(existing.map((v) => [v.ko, v]))
  // 本次新入库的条目（尚无 id），按 ko 索引，供延世批合并补字段用。
  const pendingByKo = new Map<string, Omit<VocabEntry, 'id'>>()
  // 待执行的已有条目补字段更新（延世批与库内已有条重叠时）。
  const pendingUpdates: Promise<unknown>[] = []

  const toAdd: Omit<VocabEntry, 'id'>[] = []
  let addedNikl = 0
  let addedYonsei = 0
  let merged = 0
  let skippedExisting = 0

  const niklRaw = niklSeedJson as unknown[]
  const yonseiRaw = [
    ...(yonseiSeedJson as unknown[]),
    ...(yonsei3SeedJson as unknown[]),
    ...(yonsei4SeedJson as unknown[]),
    ...(yonsei5SeedJson as unknown[]),
    ...(yonsei6SeedJson as unknown[]),
  ]

  // 工具：把一条种子条目按“新增 / 合并 / 跳过”处理，sourceLabel 仅用于区分两批的计数。
  const handleOne = (raw: unknown, batch: 'nikl' | 'yonsei') => {
    const norm = normalizeEntry(raw)
    if ('error' in norm) {
      // 内置种子文件是已校验过的，不应出现非法条；真出现了就跳过并计入 skippedExisting，
      // 不抛错中断整批加载（加载结果里看不到它，属异常情况）。
      skippedExisting += 1
      return
    }
    // 种子一律进待核实池（铁律），不管文件里写的是什么状态。
    const entry: Omit<VocabEntry, 'id'> = { ...norm.entry, status: '待核实' }
    const inDb = existingByKo.get(entry.ko)
    const inBatch = pendingByKo.get(entry.ko)
    if (batch === 'yonsei' && (inDb || inBatch)) {
      // 与 NIKL 条重叠：把延世条的 zh / yonsei_lesson / pos（为空时不覆盖）补进已有条，不另建新条。
      const target = inBatch ?? inDb
      if (!target) {
        skippedExisting += 1
        return
      }
      const patch: Partial<VocabEntry> = {}
      if (!target.zh && entry.zh) patch.zh = entry.zh
      if (!target.pos && entry.pos) patch.pos = entry.pos
      if (!target.yonsei_lesson && entry.yonsei_lesson) patch.yonsei_lesson = entry.yonsei_lesson
      if (Object.keys(patch).length > 0) {
        if (inBatch) {
          Object.assign(inBatch, patch)
        } else if (inDb?.id !== undefined) {
          pendingUpdates.push(db.vocab.update(inDb.id, patch))
          Object.assign(inDb, patch)
        }
        merged += 1
      } else {
        skippedExisting += 1
      }
      return
    }
    if (inDb || inBatch) {
      skippedExisting += 1
      return
    }
    toAdd.push(entry)
    pendingByKo.set(entry.ko, entry)
    if (batch === 'nikl') addedNikl += 1
    else addedYonsei += 1
  }

  for (const raw of niklRaw) handleOne(raw, 'nikl')
  for (const raw of yonseiRaw) handleOne(raw, 'yonsei')

  if (toAdd.length > 0) {
    await db.vocab.bulkAdd(toAdd)
  }
  if (pendingUpdates.length > 0) {
    await Promise.all(pendingUpdates)
  }

  const totalAfter = await db.vocab.count()
  const pendingAfter = await db.vocab.where('status').equals('待核实').count()
  return { addedNikl, addedYonsei, merged, skippedExisting, totalAfter, pendingAfter }
}

/** 把用户提供的原始条目数组导入库内（去重合并 + 待核实池分流），字段规则同 normalizeEntry。 */
export async function importVocabEntries(rawEntries: unknown[]): Promise<ImportEntriesResult> {
  const existingKo = new Set((await db.vocab.toArray()).map((v) => v.ko))
  const seenInFile = new Set<string>()
  const toAdd: Omit<VocabEntry, 'id'>[] = []
  let skippedExisting = 0
  let skippedDuplicate = 0
  let rejected = 0
  const rejectReasons: string[] = []

  for (const raw of rawEntries) {
    const norm = normalizeEntry(raw)
    if ('error' in norm) {
      rejected += 1
      if (rejectReasons.length < 5) rejectReasons.push(norm.error)
      continue
    }
    const { entry } = norm
    if (existingKo.has(entry.ko)) {
      skippedExisting += 1
      continue
    }
    if (seenInFile.has(entry.ko)) {
      skippedDuplicate += 1
      continue
    }
    seenInFile.add(entry.ko)
    toAdd.push(entry)
  }

  if (toAdd.length > 0) {
    await db.vocab.bulkAdd(toAdd)
  }

  const totalAfter = await db.vocab.count()
  return {
    added: toAdd.length,
    skippedExisting,
    skippedDuplicate,
    rejected,
    rejectReasons,
    totalAfter,
  }
}

/** 解析 JSON 文本：接受 VocabEntry 数组，或 { vocab: [...] } 结构。 */
export function parseVocabJSON(text: string): unknown[] {
  const data: unknown = JSON.parse(text)
  if (Array.isArray(data)) return data
  if (typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>).vocab)) {
    return (data as Record<string, unknown>).vocab as unknown[]
  }
  throw new Error('JSON 结构不对：需要词条数组，或 { vocab: [...] }')
}

const CSV_HEADERS: Record<string, string> = {
  ko: 'ko',
  韩文: 'ko',
  pos: 'pos',
  词性: 'pos',
  zh: 'zh',
  中文: 'zh',
  中文释义: 'zh',
  source: 'source',
  来源: 'source',
  source_level: 'source_level',
  分级: 'source_level',
  来源分级: 'source_level',
  yonsei_lesson: 'yonsei_lesson',
  课次: 'yonsei_lesson',
  延世课次: 'yonsei_lesson',
  status: 'status',
  状态: 'status',
  example_ko: 'example_ko',
  例句: 'example_ko',
  example_zh: 'example_zh',
  例句翻译: 'example_zh',
}

/** 简易 CSV 解析：支持双引号字段（内含逗号与 "" 转义），首行为表头。 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((c) => c.trim() !== '')) rows.push(row)
  }
  return rows
}

/** 解析 CSV 文本为原始条目数组（表头必须含 ko 列）。 */
export function parseVocabCSV(text: string): unknown[] {
  const rows = parseCsvRows(text)
  if (rows.length < 2) throw new Error('CSV 至少需要表头 + 1 行数据')
  const header = rows[0].map((h) => h.trim())
  const keyByCol = header.map((h) => CSV_HEADERS[h])
  if (!keyByCol.includes('ko')) {
    throw new Error('CSV 表头缺少 ko（韩文）列')
  }
  const entries: Record<string, unknown>[] = []
  for (const row of rows.slice(1)) {
    const entry: Record<string, unknown> = {}
    row.forEach((cell, i) => {
      const key = keyByCol[i]
      if (key) entry[key] = cell.trim()
    })
    entries.push(entry)
  }
  return entries
}
