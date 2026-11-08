import Dexie, { type Table } from 'dexie'
import type { GradeLabel } from './srs'

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

// ---- P5 新增：试题系统（#9 / #17 / #10）----
// 铁律：官方真题只做 topik.go.kr 下载链接 + 用户本地导入，绝不打包官方文件进仓库；
// 自编题一律标“自编练习题，非官方真题”，绝不把自编题标成官方真题；
// 本阶段题库出厂是空的——没有真题、没有自编题进库，只搭模型与导入器。

/** 题目核实状态：已核实 / 待核实（缺来源的条目不入库，见 importQuestionBank）。 */
export type QuestionStatus = '已核实' | '待核实'

/** 题型：听力 / 阅读 / 写作 / 词汇 / 语法 / 其他（P6 听力加 audio、写作加计时）。 */
export type QuestionType = '听力' | '阅读' | '写作' | '词汇' | '语法' | '其他'

export interface Question {
  id?: number
  /** 题干 */
  stem: string
  /** 选项（客观题）；主观题/写作题为空数组 */
  options: string[]
  /** 正确选项下标（客观题）；主观题为 null */
  answerIndex: number | null
  /** 参考答案 / 评分要点（主观题用；客观题可空） */
  answer: string
  /** 解析 */
  explanation: string
  /** 来源（必填）：如“TOPIK 84회 읽기”或“自编练习题”；缺来源不入库 */
  source: string
  /** 核实状态 */
  status: QuestionStatus
  /** 题型 */
  qtype: QuestionType
  /** 难度：易 / 中 / 难（导入时缺省为“中”） */
  difficulty: string
  /** 所属试卷 id（未分组的题留空，随机抽题可用） */
  paperId?: number
  /** 卷内题序（导入时缺省按导入顺序） */
  order: number
  /** P6：听力音频引用——音频文件名（如“84회 듣기 01.mp3”），只记引用，不存音频文件本身；
   * 音频文件由用户保存在本机，练习时重新选择文件播放；空字符串/缺省 = 未导入音频。 */
  audio?: string
  /** P6：限时（分钟，正整数）；缺省 = 本题未设限时。阅读题用；模拟考试用各环节时长，不读本题限时。 */
  timeLimit?: number
}

export interface Paper {
  id?: number
  /** 场次，如“TOPIK 84회” */
  title: string
  /** 级别：TOPIK I / TOPIK II */
  level: string
  /** 考试日期 YYYY-MM-DD（未知留空） */
  examDate: string
  /** 来源（必填） */
  source: string
  /** 核实状态 */
  status: QuestionStatus
  /** 备注 */
  note: string
}

export interface Attempt {
  id?: number
  questionId: number
  /** 答题时所在的试卷（随机抽题留空） */
  paperId?: number
  /** 选中的选项文本；写作题存所写全文 */
  selectedAnswer: string
  /** 是否答对（主观题不自动判分、不写 attempts） */
  correct: boolean
  answeredAt: Date
  /** P6：主观题（写作）标记——写作答案存 attempts 但不自动判分、不计入正确率、
   * 不进错题范围；客观题缺省 false。 */
  subjective?: boolean
  /** P6：写作所用秒数（仅主观题写）。 */
  writingSeconds?: number
}

class TopikDB extends Dexie {
  vocab!: Table<VocabEntry, number>
  reviews!: Table<ReviewRecord, number>
  daily_stats!: Table<DailyStat, number>
  questions!: Table<Question, number>
  papers!: Table<Paper, number>
  attempts!: Table<Attempt, number>

  constructor() {
    super('topik-master-2027')
    this.version(1).stores({
      vocab: '++id, ko, pos, source, source_level, yonsei_lesson, status, favorite',
      reviews: '++id, vocabId, reviewedAt, dueAt',
      daily_stats: '++id, date',
    })
    // P5：version 2 新增 questions / papers / attempts 三张表。
    // Dexie 要求每个版本都声明全部表；升级只加空表，旧数据（词汇/复习/统计）原样保留。
    this.version(2).stores({
      vocab: '++id, ko, pos, source, source_level, yonsei_lesson, status, favorite',
      reviews: '++id, vocabId, reviewedAt, dueAt',
      daily_stats: '++id, date',
      questions: '++id, paperId, qtype, difficulty, status, source',
      papers: '++id, level, status, title',
      attempts: '++id, questionId, paperId, answeredAt, correct',
    })
    // P6：version 3 只给 questions 表加 audio / timeLimit 两个非索引字段。
    // Dexie 存整条对象，非索引字段不用改索引声明；升级钩子只做归一化——
    // 旧记录缺 audio 的补空字符串（= 未导入音频），timeLimit 缺省即“未设限时”；
    // 旧数据（词汇/复习/统计/题目/答题）一条不丢，迁移实测见 ACCEPTANCE.md P6 一节。
    this.version(3)
      .stores({
        vocab: '++id, ko, pos, source, source_level, yonsei_lesson, status, favorite',
        reviews: '++id, vocabId, reviewedAt, dueAt',
        daily_stats: '++id, date',
        questions: '++id, paperId, qtype, difficulty, status, source',
        papers: '++id, level, status, title',
        attempts: '++id, questionId, paperId, answeredAt, correct',
      })
      .upgrade(async (tx) => {
        await tx
          .table('questions')
          .toCollection()
          .modify((q: Record<string, unknown>) => {
            if (q.audio === undefined || q.audio === null) q.audio = ''
          })
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

// ---- P1 新增查询函数（只加函数，不动表结构、不升 Dexie 版本）----

/** 库内词条总数。 */
export async function countVocab(): Promise<number> {
  return db.vocab.count()
}

/** 待核实池按来源分组的条数（source → count）。 */
export async function countPendingBySource(): Promise<{ source: string; count: number }[]> {
  const pending = await db.vocab.where('status').equals('待核实').toArray()
  const map = new Map<string, number>()
  for (const v of pending) {
    map.set(v.source, (map.get(v.source) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
}

/** 待核实池全部条目，可按来源过滤（不传则全部）。 */
export async function getPendingVocab(source?: string): Promise<VocabEntry[]> {
  const all = await db.vocab.where('status').equals('待核实').toArray()
  return source ? all.filter((v) => v.source === source) : all
}

/** 未学新词：没有任何复习记录的词条，按 id 升序取前 limit 条（今日新词列表用）。 */
export async function getUnlearnedVocab(limit: number): Promise<VocabEntry[]> {
  const reviewedIds = new Set((await db.reviews.toArray()).map((r) => r.vocabId))
  return db.vocab
    .filter((v) => v.id !== undefined && !reviewedIds.has(v.id))
    .limit(limit)
    .toArray()
}

/** 筛选下拉的可选值：延世课次 / 来源分级 / 词性（去重、排序，空值除外）。 */
export async function getFilterOptions(): Promise<{
  lessons: string[]
  levels: string[]
  poses: string[]
}> {
  const all = await db.vocab.toArray()
  const pick = (fn: (v: VocabEntry) => string) =>
    [...new Set(all.map(fn).filter((x) => x !== ''))].sort()
  return {
    lessons: pick((v) => v.yonsei_lesson),
    levels: pick((v) => v.source_level),
    poses: pick((v) => v.pos),
  }
}

/** 切换一条词的收藏状态。 */
export async function toggleFavorite(id: number, favorite: boolean): Promise<void> {
  await db.vocab.update(id, { favorite })
}

// ---- P2 新增查询函数（只加函数，不动表结构、不升 Dexie 版本）----

/** 全部复习记录（按 id 升序）。 */
export async function getAllReviews(): Promise<ReviewRecord[]> {
  return db.reviews.toArray()
}

/** 某条词的最新一条复习记录（按 reviewedAt、再按 id 取最大）；没复习过返回 undefined。 */
export async function getLatestReviewByVocab(vocabId: number): Promise<ReviewRecord | undefined> {
  const all = await db.reviews.where('vocabId').equals(vocabId).toArray()
  if (all.length === 0) return undefined
  return all.reduce((a, b) =>
    b.reviewedAt.getTime() > a.reviewedAt.getTime() ||
    (b.reviewedAt.getTime() === a.reviewedAt.getTime() && (b.id ?? 0) > (a.id ?? 0))
      ? b
      : a,
  )
}

/** 每条词的最新打分档位（vocabId → { grade, reviewedAt }）；没复习过的词不在 map 里。 */
export async function getLatestGradeMap(): Promise<
  Map<number, { grade: string; reviewedAt: Date }>
> {
  const all = await db.reviews.toArray()
  const map = new Map<number, { grade: string; reviewedAt: Date }>()
  for (const r of all) {
    const cur = map.get(r.vocabId)
    if (
      !cur ||
      r.reviewedAt.getTime() > cur.reviewedAt.getTime()
    ) {
      map.set(r.vocabId, { grade: r.grade, reviewedAt: r.reviewedAt })
    }
  }
  return map
}

/** 错词本：最新一次打分是“不认识”或“模糊”的词（按最新复习时间倒序）。 */
export async function getWrongVocab(): Promise<
  { vocab: VocabEntry; grade: string; reviewedAt: Date }[]
> {
  const gradeMap = await getLatestGradeMap()
  const wrongIds = [...gradeMap.entries()]
    .filter(([, g]) => g.grade === '不认识' || g.grade === '模糊')
    .sort((a, b) => b[1].reviewedAt.getTime() - a[1].reviewedAt.getTime())
  const out: { vocab: VocabEntry; grade: string; reviewedAt: Date }[] = []
  for (const [vocabId, g] of wrongIds) {
    const vocab = await db.vocab.get(vocabId)
    if (vocab) out.push({ vocab, grade: g.grade, reviewedAt: g.reviewedAt })
  }
  return out
}

/** 按掌握度筛选：最新一次打分等于指定档位的词（没复习过的词不算任何档位）。 */
export async function getVocabByMastery(grade: GradeLabel): Promise<VocabEntry[]> {
  const gradeMap = await getLatestGradeMap()
  const ids = [...gradeMap.entries()]
    .filter(([, g]) => g.grade === grade)
    .map(([vocabId]) => vocabId)
  const out: VocabEntry[] = []
  for (const id of ids) {
    const vocab = await db.vocab.get(id)
    if (vocab) out.push(vocab)
  }
  return out.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
}

export async function addReview(rec: Omit<ReviewRecord, 'id'>): Promise<number> {
  return db.reviews.add(rec)
}

// ---- P5 新增：试题查询函数与题库导入器 ----

export async function getAllPapers(): Promise<Paper[]> {
  return db.papers.toArray()
}

export async function getPaperById(id: number): Promise<Paper | undefined> {
  return db.papers.get(id)
}

export async function countPapers(): Promise<number> {
  return db.papers.count()
}

export async function getAllQuestions(): Promise<Question[]> {
  return db.questions.toArray()
}

export async function countQuestions(): Promise<number> {
  return db.questions.count()
}

/** 某场试卷的全部题目（按 order、再按 id 升序）。 */
export async function getQuestionsByPaper(paperId: number): Promise<Question[]> {
  const list = await db.questions.where('paperId').equals(paperId).toArray()
  return list.sort((a, b) => a.order - b.order || (a.id ?? 0) - (b.id ?? 0))
}

export async function getQuestionById(id: number): Promise<Question | undefined> {
  return db.questions.get(id)
}

/** P6：把用户本次选择的音频文件名记为该题的音频引用（只记文件名，不存音频文件本身）。 */
export async function updateQuestionAudio(id: number, fileName: string): Promise<void> {
  await db.questions.update(id, { audio: fileName })
}

/** 某道题的全部答题记录（按时间升序）。 */
export async function getAttemptsByQuestion(questionId: number): Promise<Attempt[]> {
  const list = await db.attempts.where('questionId').equals(questionId).toArray()
  return list.sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime())
}

/** 错题范围：最新一次答题答错的题目 id（主观题不写 attempts，不在错题范围里）。 */
export async function getWrongQuestionIds(): Promise<number[]> {
  const all = await db.attempts.toArray()
  const latest = new Map<number, Attempt>()
  for (const a of all) {
    // P6：写作等主观题答题（subjective）不自动判分，不进错题范围。
    if (a.subjective) continue
    const cur = latest.get(a.questionId)
    if (!cur || a.answeredAt.getTime() >= cur.answeredAt.getTime()) {
      latest.set(a.questionId, a)
    }
  }
  return [...latest.entries()].filter(([, a]) => !a.correct).map(([id]) => id)
}

/** 某道写作题最新一次保存的答案（主观题答题记录）；没写过返回 undefined。 */
export async function getLatestWritingAttempt(questionId: number): Promise<Attempt | undefined> {
  const list = await db.attempts
    .where('questionId')
    .equals(questionId)
    .filter((a) => a.subjective === true)
    .toArray()
  if (list.length === 0) return undefined
  return list.reduce((a, b) =>
    b.answeredAt.getTime() >= a.answeredAt.getTime() ? b : a,
  )
}

export async function addAttempt(rec: Omit<Attempt, 'id'>): Promise<number> {
  return db.attempts.add(rec)
}

/** 全部答题记录（按 id 升序）。 */
export async function getAllAttempts(): Promise<Attempt[]> {
  return db.attempts.toArray()
}

/** 答题记录总数。 */
export async function countAttempts(): Promise<number> {
  return db.attempts.count()
}

/** 某道题最新一次答题记录（按 answeredAt、再按 id 取最大）；没答过返回 undefined。 */
export async function getLatestAttemptByQuestion(questionId: number): Promise<Attempt | undefined> {
  const list = await db.attempts.where('questionId').equals(questionId).toArray()
  if (list.length === 0) return undefined
  return list.reduce((a, b) =>
    b.answeredAt.getTime() > a.answeredAt.getTime() ||
    (b.answeredAt.getTime() === a.answeredAt.getTime() && (b.id ?? 0) > (a.id ?? 0))
      ? b
      : a,
  )
}

// ---- P7 新增：本地备份与恢复（#23）----
// 备份格式（单个 JSON 文件，本地下载/导入，不上传任何地方）：
// { app: 'topik-master-2027', formatVersion: 1, dexieVersion: 3, exportedAt,
//   vocab, reviews, daily_stats, questions, papers, attempts }
// 口径（P7 定死）：
// - 导出 = 整库六类数据全量快照（含 Dexie 版本号与导出时间）；恢复 = 先校验、再一次性
//   覆盖本地全部数据（恢复前页面要求二次确认）；校验不过整份拒绝、不写半份数据。
// - JSON 里的日期是字符串，恢复时必须转回 Date，否则后续 getTime() 会坏；
//   日期无效的条目整份拒绝并报错，不静默跳过。
// - 备份文件只认本应用（app 字段）与 formatVersion 1；版本不符拒绝并报错。

export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_APP = 'topik-master-2027'

export interface BackupData {
  app: string
  formatVersion: number
  dexieVersion: number
  exportedAt: string
  vocab: VocabEntry[]
  reviews: ReviewRecord[]
  daily_stats: DailyStat[]
  questions: Question[]
  papers: Paper[]
  attempts: Attempt[]
}

export interface BackupPreview {
  exportedAt: string
  dexieVersion: number
  counts: {
    vocab: number
    reviews: number
    daily_stats: number
    questions: number
    papers: number
    attempts: number
  }
}

function asDate(value: unknown, label: string): Date {
  const d = value instanceof Date ? value : new Date(value as string)
  if (Number.isNaN(d.getTime())) throw new Error(`备份文件里${label}的日期无效`)
  return d
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 解析并校验备份文件：格式、应用名、版本号、六个数组、关键字段类型与日期。
 * 通过则返回规范化后的完整数据（日期已转回 Date）与预览计数；不过则抛错（写明原因）。
 * 本函数不写库，可先给用户看“备份含多少条”再确认恢复。
 */
export function parseBackupJSON(jsonText: string): { data: BackupData; preview: BackupPreview } {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new Error('不是有效的 JSON 文件')
  }
  if (!isRecord(raw)) {
    throw new Error('备份文件结构不对：顶层应为对象')
  }
  if (raw.app !== BACKUP_APP) {
    throw new Error('不是本应用的备份文件（app 字段不符），已拒绝')
  }
  if (raw.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(
      `备份格式版本不受支持：文件是 formatVersion ${String(raw.formatVersion)}，本应用只认 ${BACKUP_FORMAT_VERSION}，已拒绝`,
    )
  }
  const arrays: (keyof BackupData)[] = ['vocab', 'reviews', 'daily_stats', 'questions', 'papers', 'attempts']
  for (const key of arrays) {
    if (!Array.isArray(raw[key])) {
      throw new Error(`备份文件结构不对：缺少 ${key} 数组，已拒绝`)
    }
  }
  const vocab = (raw.vocab as unknown[]).map((v, i) => {
    if (!isRecord(v) || typeof v.ko !== 'string' || v.ko.trim() === '') {
      throw new Error(`备份文件里第 ${i + 1} 条词汇缺 ko（韩文），已拒绝`)
    }
    return v as unknown as VocabEntry
  })
  const reviews = (raw.reviews as unknown[]).map((r, i) => {
    if (!isRecord(r) || typeof r.vocabId !== 'number') {
      throw new Error(`备份文件里第 ${i + 1} 条复习记录缺 vocabId，已拒绝`)
    }
    return {
      ...(r as unknown as ReviewRecord),
      reviewedAt: asDate(r.reviewedAt, `第 ${i + 1} 条复习记录的 reviewedAt`),
      dueAt: asDate(r.dueAt, `第 ${i + 1} 条复习记录的 dueAt`),
    }
  })
  const daily_stats = (raw.daily_stats as unknown[]).map((s, i) => {
    if (!isRecord(s) || typeof s.date !== 'string') {
      throw new Error(`备份文件里第 ${i + 1} 条统计缺 date，已拒绝`)
    }
    return s as unknown as DailyStat
  })
  const questions = (raw.questions as unknown[]).map((q, i) => {
    if (!isRecord(q) || typeof q.stem !== 'string' || q.stem.trim() === '') {
      throw new Error(`备份文件里第 ${i + 1} 道题缺 stem（题干），已拒绝`)
    }
    if (typeof q.source !== 'string' || q.source.trim() === '') {
      throw new Error(`备份文件里第 ${i + 1} 道题缺 source（来源），已拒绝`)
    }
    if (!QUESTION_TYPES.includes(q.qtype as QuestionType)) {
      throw new Error(`备份文件里第 ${i + 1} 道题 qtype（题型）不在允许范围，已拒绝`)
    }
    return q as unknown as Question
  })
  const papers = (raw.papers as unknown[]).map((p, i) => {
    if (!isRecord(p) || typeof p.title !== 'string' || p.title.trim() === '') {
      throw new Error(`备份文件里第 ${i + 1} 张试卷缺 title，已拒绝`)
    }
    return p as unknown as Paper
  })
  const attempts = (raw.attempts as unknown[]).map((a, i) => {
    if (!isRecord(a) || typeof a.questionId !== 'number') {
      throw new Error(`备份文件里第 ${i + 1} 条答题记录缺 questionId，已拒绝`)
    }
    return {
      ...(a as unknown as Attempt),
      answeredAt: asDate(a.answeredAt, `第 ${i + 1} 条答题记录的 answeredAt`),
    }
  })
  const data: BackupData = {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    dexieVersion: typeof raw.dexieVersion === 'number' ? raw.dexieVersion : 3,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    vocab,
    reviews,
    daily_stats,
    questions,
    papers,
    attempts,
  }
  return {
    data,
    preview: {
      exportedAt: data.exportedAt,
      dexieVersion: data.dexieVersion,
      counts: {
        vocab: vocab.length,
        reviews: reviews.length,
        daily_stats: daily_stats.length,
        questions: questions.length,
        papers: papers.length,
        attempts: attempts.length,
      },
    },
  }
}

/** 整库导出为备份 JSON 字符串（六类数据全量 + 元数据）。 */
export async function exportBackupJSON(): Promise<string> {
  const [vocab, reviews, daily_stats, questions, papers, attempts] = await Promise.all([
    db.vocab.toArray(),
    db.reviews.toArray(),
    db.daily_stats.toArray(),
    db.questions.toArray(),
    db.papers.toArray(),
    db.attempts.toArray(),
  ])
  const data: BackupData = {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    dexieVersion: 3,
    exportedAt: new Date().toISOString(),
    vocab,
    reviews,
    daily_stats,
    questions,
    papers,
    attempts,
  }
  return JSON.stringify(data, null, 2)
}

/**
 * 恢复备份：先校验（parseBackupJSON），再在同一个事务里清空六张表并一次性写入。
 * 校验失败抛错、不动本地数据；写入失败时事务回滚（Dexie 事务内任一步失败整批不落库）。
 * 注意：恢复会覆盖本地全部数据，调用前必须在页面上向用户二次确认并展示预览计数。
 */
export async function importBackupJSON(jsonText: string): Promise<BackupPreview> {
  const { data, preview } = parseBackupJSON(jsonText)
  await db.transaction(
    'rw',
    [db.vocab, db.reviews, db.daily_stats, db.questions, db.papers, db.attempts],
    async () => {
      await db.vocab.clear()
      await db.reviews.clear()
      await db.daily_stats.clear()
      await db.questions.clear()
      await db.papers.clear()
      await db.attempts.clear()
      await db.vocab.bulkAdd(data.vocab)
      await db.reviews.bulkAdd(data.reviews)
      await db.daily_stats.bulkAdd(data.daily_stats)
      await db.questions.bulkAdd(data.questions)
      await db.papers.bulkAdd(data.papers)
      await db.attempts.bulkAdd(data.attempts)
    },
  )
  return preview
}

/** 只清空题库（questions / papers / attempts），不碰词汇、复习、统计数据。 */
export async function clearQuestionBank(): Promise<void> {
  await db.transaction('rw', db.questions, db.papers, db.attempts, async () => {
    await db.questions.clear()
    await db.papers.clear()
    await db.attempts.clear()
  })
}

export interface QuestionBankImportResult {
  papersAdded: number
  papersReused: number
  questionsAdded: number
  questionsSkipped: number
  /** 每条形如“第 3 题：缺来源字段，已拒绝”；成功导入时为空数组。 */
  errors: string[]
}

const QUESTION_TYPES: QuestionType[] = ['听力', '阅读', '写作', '词汇', '语法', '其他']

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

function asOptionalString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asStatus(v: unknown): QuestionStatus {
  return v === '已核实' ? '已核实' : '待核实'
}

/**
 * 题库导入（P5：#9 / #17）。
 * 格式：{ papers?: PaperInput[], questions?: QuestionInput[] }，字段见 ACCEPTANCE.md P5 一节。
 * 校验铁律：题干、来源、题型缺一不可，缺来源的条目拒绝入库并报错、不静默丢弃；
 * 客观题（options 非空）answerIndex 必须在选项范围内；主观题（options 为空）answerIndex 必须为空。
 * 同名试卷复用已有试卷（不重复建卷）；同一试卷内题干重复的题跳过（记入 questionsSkipped）。
 * 先全部校验、再一次性写入；写入失败时整批不落库。
 */
export async function importQuestionBank(jsonText: string): Promise<QuestionBankImportResult> {
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch {
    throw new Error('不是有效的 JSON 文件')
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('导入文件结构不对：顶层应为对象 { papers: [...], questions: [...] }')
  }
  const rawPapers: unknown[] = Array.isArray((data as { papers?: unknown }).papers)
    ? (data as { papers: unknown[] }).papers
    : []
  const rawQuestions: unknown[] = Array.isArray((data as { questions?: unknown }).questions)
    ? (data as { questions: unknown[] }).questions
    : []
  if (rawPapers.length === 0 && rawQuestions.length === 0) {
    throw new Error('导入文件里没有试卷也没有题目')
  }

  const errors: string[] = []
  // --- 校验试卷 ---
  const validPapers: Omit<Paper, 'id'>[] = []
  rawPapers.forEach((p, i) => {
    const label = `第 ${i + 1} 张试卷`
    if (typeof p !== 'object' || p === null || Array.isArray(p)) {
      errors.push(`${label}：不是对象，已拒绝`)
      return
    }
    const r = p as Record<string, unknown>
    if (!isNonEmptyString(r.title)) {
      errors.push(`${label}：缺 title（场次名称），已拒绝`)
      return
    }
    if (!isNonEmptyString(r.source)) {
      errors.push(`${label}：缺 source（来源），已拒绝`)
      return
    }
    validPapers.push({
      title: (r.title as string).trim(),
      level: asOptionalString(r.level),
      examDate: asOptionalString(r.examDate),
      source: (r.source as string).trim(),
      status: asStatus(r.status),
      note: asOptionalString(r.note),
    })
  })

  // --- 校验题目 ---
  interface ValidQuestion extends Omit<Question, 'id' | 'paperId'> {
    paperTitle: string
  }
  const validQuestions: ValidQuestion[] = []
  rawQuestions.forEach((q, i) => {
    const label = `第 ${i + 1} 道题`
    if (typeof q !== 'object' || q === null || Array.isArray(q)) {
      errors.push(`${label}：不是对象，已拒绝`)
      return
    }
    const r = q as Record<string, unknown>
    if (!isNonEmptyString(r.stem)) {
      errors.push(`${label}：缺 stem（题干），已拒绝`)
      return
    }
    if (!isNonEmptyString(r.source)) {
      errors.push(`${label}：缺 source（来源），已拒绝`)
      return
    }
    if (!isNonEmptyString(r.qtype) || !QUESTION_TYPES.includes(r.qtype as QuestionType)) {
      errors.push(`${label}：qtype（题型）缺失或不在允许范围（听力/阅读/写作/词汇/语法/其他），已拒绝`)
      return
    }
    const options: string[] = Array.isArray(r.options)
      ? (r.options as unknown[]).map((o) => (typeof o === 'string' ? o : ''))
      : []
    if (options.some((o) => o === '')) {
      errors.push(`${label}：options 里有空选项，已拒绝`)
      return
    }
    let answerIndex: number | null = null
    if (options.length > 0) {
      if (
        typeof r.answerIndex !== 'number' ||
        !Number.isInteger(r.answerIndex) ||
        r.answerIndex < 0 ||
        r.answerIndex >= options.length
      ) {
        errors.push(`${label}：answerIndex（正确选项下标）缺失或超出选项范围，已拒绝`)
        return
      }
      answerIndex = r.answerIndex
    } else if (r.answerIndex !== undefined && r.answerIndex !== null) {
      errors.push(`${label}：主观题（options 为空）不应填 answerIndex，已拒绝`)
      return
    }
    // P6：听力音频引用（audio，字符串文件名；可空）与限时（timeLimit，正整数分钟；可空）。
    // 只记引用，不存音频文件本身；timeLimit 非正整数拒绝入库。
    let audio = ''
    if (r.audio !== undefined && r.audio !== null) {
      if (typeof r.audio !== 'string') {
        errors.push(`${label}：audio（音频引用）不是字符串，已拒绝`)
        return
      }
      audio = (r.audio as string).trim()
    }
    let timeLimit: number | undefined
    if (r.timeLimit !== undefined && r.timeLimit !== null) {
      if (
        typeof r.timeLimit !== 'number' ||
        !Number.isInteger(r.timeLimit) ||
        r.timeLimit <= 0 ||
        r.timeLimit > 600
      ) {
        errors.push(`${label}：timeLimit（限时分钟）不是 1–600 的正整数，已拒绝`)
        return
      }
      timeLimit = r.timeLimit
    }
    validQuestions.push({
      stem: (r.stem as string).trim(),
      options,
      answerIndex,
      answer: asOptionalString(r.answer),
      explanation: asOptionalString(r.explanation),
      source: (r.source as string).trim(),
      status: asStatus(r.status),
      qtype: r.qtype as QuestionType,
      difficulty: isNonEmptyString(r.difficulty) ? (r.difficulty as string).trim() : '中',
      paperTitle: asOptionalString(r.paperTitle),
      order: typeof r.order === 'number' ? r.order : 0,
      audio,
      timeLimit,
    })
  })

  // --- 写入（先试卷、再题目；同名试卷复用） ---
  let papersAdded = 0
  let papersReused = 0
  let questionsAdded = 0
  let questionsSkipped = 0
  const paperIdByTitle = new Map<string, number>()
  await db.transaction('rw', db.papers, db.questions, async () => {
    const existingPapers = await db.papers.toArray()
    for (const p of existingPapers) paperIdByTitle.set(p.title, p.id as number)
    for (const p of validPapers) {
      const reused = paperIdByTitle.get(p.title)
      if (reused !== undefined) {
        papersReused += 1
        continue
      }
      const id = await db.papers.add(p)
      paperIdByTitle.set(p.title, id)
      papersAdded += 1
    }
    const existingQuestions = await db.questions.toArray()
    // 去重键：同一场内按题号（order）去重。P5 用 paperId::stem 会把同组题误判为重复——
    // 102 回 TOPIK I 听力转录实测：同组题题干相同（如“다음을 듣고…”），初版只进了 13/30。
    // order 缺失（默认 0）时退回按题干去重，避免两道无题号的题互相顶掉。
    const dedupeKey = (paperId: number | undefined, order: number, stem: string) =>
      order > 0 ? `${paperId ?? ''}::${order}` : `${paperId ?? ''}::stem::${stem}`
    const seen = new Set(existingQuestions.map((q) => dedupeKey(q.paperId, q.order, q.stem)))
    for (const q of validQuestions) {
      let paperId: number | undefined
      if (q.paperTitle) {
        paperId = paperIdByTitle.get(q.paperTitle)
        if (paperId === undefined) {
          errors.push(`题干“${q.stem.slice(0, 20)}”：paperTitle“${q.paperTitle}”找不到对应试卷，已拒绝`)
          continue
        }
      }
      const key = dedupeKey(paperId, q.order, q.stem)
      if (seen.has(key)) {
        questionsSkipped += 1
        continue
      }
      seen.add(key)
      const { paperTitle: _paperTitle, ...rest } = q
      await db.questions.add({ ...rest, paperId })
      questionsAdded += 1
    }
  })
  return { papersAdded, papersReused, questionsAdded, questionsSkipped, errors }
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
  // Dexie 的 transaction() 重载最多 7 个参数，6 张表 + mode + scope 共 8 个会报类型错；
  // 清空是幂等操作，逐表清即可（每张表的 clear() 本身是原子的）。
  await db.vocab.clear()
  await db.reviews.clear()
  await db.daily_stats.clear()
  await db.questions.clear()
  await db.papers.clear()
  await db.attempts.clear()
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
