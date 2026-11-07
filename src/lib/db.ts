import Dexie, { type Table } from 'dexie'

// TOPIK MASTER 2027 — 数据层（T0）
// 本地优先：全部数据只存在浏览器 IndexedDB，不上传任何第三方。

export type VocabSource = 'NIKL' | 'TOPIK' | '课程参考' | '测试'
export type VocabStatus = '已核实' | '待核实' | '补充'

/**
 * 词汇分级铁律（2026-11-07 确认）：
 * 不许标“官方 TOPIK X 级”。只用三类来源标注：
 * - NIKL-A / NIKL-B / NIKL-C（国立国语院 2003 学习用词汇目录，A 初级 / B 中级 / C 高级）
 * - TOPIK-초급 / TOPIK-중급（TOPIK 2015 公开词汇目录，只分这两档）
 * - 课程-X级参考（2018 国际通用韩语教育标准课程词汇等级表，参考分级，非官方 TOPIK 等级）
 * 中文释义、例句不完整时 zh / example 留空并进待核实池，绝不编造。
 */
export interface VocabEntry {
  id?: number
  /** 韩文 */
  ko: string
  /** 词性，如 명사 / 동사；未知留空 */
  pos: string
  /** 中文释义；无可靠来源时留空并标“待补”，不编造 */
  zh: string
  /** 来源：NIKL / TOPIK / 课程参考 / 测试 */
  source: VocabSource
  /** 来源分级，如 NIKL-A、TOPIK-초급、课程-4级参考 */
  source_level: string
  /** 延世课次，如 1册1课；无对应留空 */
  yonsei_lesson: string
  /** 状态：已核实 / 待核实 / 补充 */
  status: VocabStatus
  /** 例句（韩文）；无来源时留空 */
  example_ko: string
  /** 例句中文翻译；无来源时留空 */
  example_zh: string
  favorite: boolean
  /** 仅 T0 测试数据为 true；真实词条一律 false */
  isTestData: boolean
}

export interface ReviewRecord {
  id?: number
  vocabId: number
  reviewedAt: Date
  /** 四档：不认识 / 模糊 / 认识 / 很熟 */
  grade: string
  dueAt: Date
  /** ts-fsrs 卡片 JSON（可序列化） */
  cardJson: string
}

export interface DailyStat {
  id?: number
  /** 日期 YYYY-MM-DD（本地） */
  date: string
  newWords: number
  reviewedWords: number
  correctCount: number
  minutes: number
}

class TopikDB extends Dexie {
  vocab!: Table<VocabEntry, number>
  reviews!: Table<ReviewRecord, number>
  daily_stats!: Table<DailyStat, number>

  constructor() {
    super('topik-master-2027')
    this.version(1).stores({
      vocab: '++id, ko, pos, source, source_level, yonsei_lesson, status, favorite',
      reviews: '++id, vocabId, reviewedAt, dueAt',
      daily_stats: '++id, date',
    })
  }
}

export const db = new TopikDB()

export async function addVocab(entry: Omit<VocabEntry, 'id'>): Promise<number> {
  return db.vocab.add(entry)
}

export async function getAllVocab(): Promise<VocabEntry[]> {
  return db.vocab.toArray()
}

export async function getVocabById(id: number): Promise<VocabEntry | undefined> {
  return db.vocab.get(id)
}

export async function searchVocab(keyword: string): Promise<VocabEntry[]> {
  const q = keyword.trim()
  if (!q) return getAllVocab()
  return db.vocab
    .filter((v) => v.ko.includes(q) || v.zh.includes(q))
    .toArray()
}

export async function addReview(rec: Omit<ReviewRecord, 'id'>): Promise<number> {
  return db.reviews.add(rec)
}

export async function getReviewsByVocab(vocabId: number): Promise<ReviewRecord[]> {
  return db.reviews.where('vocabId').equals(vocabId).toArray()
}

export async function upsertDailyStat(stat: Omit<DailyStat, 'id'>): Promise<number> {
  const existing = await db.daily_stats.where('date').equals(stat.date).first()
  if (existing?.id !== undefined) {
    await db.daily_stats.update(existing.id, stat)
    return existing.id
  }
  return db.daily_stats.add(stat)
}

export async function getDailyStat(date: string): Promise<DailyStat | undefined> {
  return db.daily_stats.where('date').equals(date).first()
}

export async function exportAllJSON(): Promise<string> {
  const [vocab, reviews, daily_stats] = await Promise.all([
    db.vocab.toArray(),
    db.reviews.toArray(),
    db.daily_stats.toArray(),
  ])
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), app: 'topik-master-2027', vocab, reviews, daily_stats },
    null,
    2,
  )
}

/** 导入 JSON（T0 只做结构校验与写入，不做去重合并；正式导入逻辑在后续任务）。 */
export async function importJSON(jsonText: string): Promise<{ vocab: number; reviews: number; daily_stats: number }> {
  const data = JSON.parse(jsonText) as {
    vocab?: VocabEntry[]
    reviews?: ReviewRecord[]
    daily_stats?: DailyStat[]
  }
  if (!Array.isArray(data.vocab) || !Array.isArray(data.reviews) || !Array.isArray(data.daily_stats)) {
    throw new Error('导入文件结构不对：需要 vocab / reviews / daily_stats 三个数组')
  }
  await db.vocab.bulkAdd(data.vocab)
  await db.reviews.bulkAdd(data.reviews)
  await db.daily_stats.bulkAdd(data.daily_stats)
  return { vocab: data.vocab.length, reviews: data.reviews.length, daily_stats: data.daily_stats.length }
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.vocab, db.reviews, db.daily_stats, async () => {
    await db.vocab.clear()
    await db.reviews.clear()
    await db.daily_stats.clear()
  })
}

/**
 * T0 测试数据：3 条合成测试词。
 * 明确标注：测试数据，非教材词汇。ko 用 “테스트”+编号，不对应任何延世课文词汇；
 * zh / 例句一律留空，不编造中文释义与例句；source_level 为“测试”，status 为“待核实”。
 * 仅用于验证 IndexedDB 读写，用完可一键清空。
 */
export const TEST_VOCAB: Omit<VocabEntry, 'id'>[] = [
  {
    ko: '테스트01', pos: '', zh: '', source: '测试', source_level: '测试',
    yonsei_lesson: '', status: '待核实', example_ko: '', example_zh: '',
    favorite: false, isTestData: true,
  },
  {
    ko: '테스트02', pos: '', zh: '', source: '测试', source_level: '测试',
    yonsei_lesson: '', status: '待核实', example_ko: '', example_zh: '',
    favorite: false, isTestData: true,
  },
  {
    ko: '테스트03', pos: '', zh: '', source: '测试', source_level: '测试',
    yonsei_lesson: '', status: '待核实', example_ko: '', example_zh: '',
    favorite: false, isTestData: true,
  },
]

export async function seedTestData(): Promise<number[]> {
  const ids: number[] = []
  for (const entry of TEST_VOCAB) {
    ids.push(await db.vocab.add(entry))
  }
  return ids
}

export async function deleteTestData(): Promise<void> {
  // 注意：vocab 表没有给 isTestData 建索引（建索引要升 Dexie 版本做迁移），
  // 所以不能用 where('isTestData')，改用 filter 全表筛出测试数据再删。
  // 之前用 where('isTestData') 会抛 "KeyPath isTestData ... is not indexed"，
  // 删失败后 seedTestData 的 add() 又因键已存在抛 "Key already exists"，
  // 两次真机自测的 IndexedDB FAIL 都是这么来的，库本身没坏。
  await db.vocab.filter((v) => v.isTestData).delete()
}
