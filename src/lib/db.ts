import { studyEventDate } from './streak.ts'
import Dexie, { type Table } from 'dexie'
import type { ReadingPassage } from './reading-model.ts'
import type { WritingAssessment, WritingDraft } from './writing-model.ts'
import type { GradeLabel } from './srs'
import type { ExamSession } from './exam-model.ts'
import { isVerifiedObjective } from './scoring.ts'
import { parseBackupJSON, BACKUP_APP, BACKUP_FORMAT_VERSION, type BackupData, type BackupPreview } from './backup.ts'
import { isTextbookLessonId, type TextbookProgress, type TextbookStatus } from './textbook-model.ts'
import { normalizeResource, type LearningResource, type ResourceFields } from './resource-model.ts'
import type { StageRun } from './stage-model.ts'
import { isGrammarPointId, type GrammarStudy } from './grammar-model.ts'

export { parseBackupJSON, type BackupPreview } from './backup.ts'

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
  focusSessionIds?: string[]
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
  /** 个人收藏，缺省表示未收藏。题库文件不能设置此字段。 */
  favorite?: boolean
  readingId?: string
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
  writingAssessment?: WritingAssessment
}

interface RecoverySnapshot {
  id: 'latest'
  createdAt: string
  json: string
}

export class TopikDB extends Dexie {
  vocab!: Table<VocabEntry, number>
  reviews!: Table<ReviewRecord, number>
  archivedReviews!: Table<{ archiveId?: number; review: ReviewRecord }, number>
  daily_stats!: Table<DailyStat, number>
  questions!: Table<Question, number>
  papers!: Table<Paper, number>
  attempts!: Table<Attempt, number>
  examSessions!: Table<ExamSession, string>
  textbookProgress!: Table<TextbookProgress, string>
  learningResources!: Table<LearningResource, number>
  stageRuns!: Table<StageRun, string>
  grammarStudy!: Table<GrammarStudy, string>
  grammarFavorites!: Table<{ id: string }, string>
  readingPassages!: Table<ReadingPassage, string>
  writingDrafts!: Table<WritingDraft, number>
  recoverySnapshots!: Table<RecoverySnapshot, string>

  constructor(name = 'topik-master-2027') {
    super(name)
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
    // 只新增表和非唯一索引；保留 v3 题目 ID、题号和作答关联。
    this.version(4).stores({
      questions: '++id, paperId, qtype, difficulty, status, source, [paperId+qtype+order]',
      examSessions: 'id, status, updatedAt',
      recoverySnapshots: 'id',
    })
      .upgrade(async (tx) => {
        await tx
          .table('questions')
          .toCollection()
          .modify((q: Record<string, unknown>) => {
            if (q.audio === undefined || q.audio === null) q.audio = ''
          })
      })
    this.version(5).stores({ textbookProgress: 'id' })
    this.version(6).stores({ learningResources: '++id' })
    this.version(7).stores({ stageRuns: 'id, startedAt' })
    this.version(8).stores({ grammarStudy: 'id, updatedAt' })
    this.version(9).stores({ archivedReviews: '++archiveId' }).upgrade(async tx => {
      const vocabIds = new Set(await tx.table('vocab').toCollection().primaryKeys())
      const reviews = tx.table<ReviewRecord, number>('reviews')
      const orphaned = await reviews.filter(review => !vocabIds.has(review.vocabId)).toArray()
      if (!orphaned.length) return
      await tx.table('archivedReviews').bulkAdd(orphaned.map(review => ({ review })))
      await reviews.bulkDelete(orphaned.map(review => review.id!))
    })
    this.version(10).stores({ grammarFavorites: 'id' })
    this.version(11).stores({ readingPassages: 'id, finishedAt' })
    this.version(12).stores({ writingDrafts: 'questionId' })
  }
}

export const db = new TopikDB()

export function getGrammarStudy(database: TopikDB = db): Promise<GrammarStudy[]> {
  return database.grammarStudy.toArray()
}

export function getGrammarFavorites(database: TopikDB = db): Promise<string[]> {
  return database.grammarFavorites.toCollection().primaryKeys()
}

export async function setGrammarFavorite(id: string, favorite: boolean, database: TopikDB = db): Promise<void> {
  if (!isGrammarPointId(id)) throw new Error('无法识别这个语法点')
  if (favorite) await database.grammarFavorites.put({ id })
  else await database.grammarFavorites.delete(id)
}

export function setGrammarLearned(id: string, learned: boolean, database: TopikDB = db): Promise<void> {
  return updateGrammarStudy(id, row => { row.learned = learned }, database)
}

export function recordGrammarAnswer(id: string, correct: boolean, database: TopikDB = db): Promise<void> {
  return updateGrammarStudy(id, row => {
    row.attempts += 1
    if (correct) row.correct += 1
  }, database)
}

async function updateGrammarStudy(id: string, update: (row: GrammarStudy) => void, database: TopikDB): Promise<void> {
  if (!isGrammarPointId(id)) throw new Error('无法识别这个语法点')
  await database.transaction('rw', database.grammarStudy, async () => {
    const row = await database.grammarStudy.get(id) ?? { id, learned: false, attempts: 0, correct: 0, updatedAt: '' }
    update(row)
    if (!row.learned && row.attempts === 0) {
      await database.grammarStudy.delete(id)
      return
    }
    row.updatedAt = new Date().toISOString()
    await database.grammarStudy.put(row)
  })
}

export async function getLearningResources(database: TopikDB = db): Promise<LearningResource[]> {
  const rows = await database.learningResources.toArray()
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id! - a.id!)
}

export async function saveLearningResource(fields: ResourceFields, id?: number, database: TopikDB = db): Promise<void> {
  const record = { ...normalizeResource(fields), updatedAt: new Date().toISOString() }
  if (id === undefined) {
    await database.learningResources.add(record)
  } else if (await database.learningResources.update(id, record) === 0) {
    throw new Error('这条资料已不存在')
  }
}

export function deleteLearningResource(id: number, database: TopikDB = db): Promise<void> {
  return database.learningResources.delete(id)
}

export function getTextbookProgress(database: TopikDB = db): Promise<TextbookProgress[]> {
  return database.textbookProgress.toArray()
}

export async function setTextbookProgress(id: string, status: TextbookStatus, database: TopikDB = db): Promise<void> {
  if (!isTextbookLessonId(id)) throw new Error('无法识别这节课')
  if (status === 'not-started') {
    await database.textbookProgress.delete(id)
  } else if (status === 'in-progress' || status === 'completed') {
    await database.textbookProgress.put({ id, status, updatedAt: new Date().toISOString() })
  } else {
    throw new Error('无法识别学习状态')
  }
}

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
  if (limit <= 0) return []
  const reviewedIds = new Set((await db.reviews.toArray()).map((r) => r.vocabId))
  return db.vocab
    .filter((v) => v.id !== undefined && !v.isTestData && !reviewedIds.has(v.id))
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
export async function getLatestReviewByVocab(vocabId: number, database: TopikDB = db): Promise<ReviewRecord | undefined> {
  const all = await database.reviews.where('vocabId').equals(vocabId).toArray()
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

export function getFavoriteQuestions(database: TopikDB = db): Promise<Question[]> {
  return database.questions.filter(question => question.favorite === true).toArray()
}

export async function setQuestionFavorite(id: number, favorite: boolean, database: TopikDB = db): Promise<void> {
  if (await database.questions.update(id, { favorite }) === 0) {
    throw new Error('这道题已不在题库中')
  }
}

/** P6：把用户本次选择的音频文件名记为该题的音频引用（只记文件名，不存音频文件本身）。 */
export async function updateQuestionAudio(id: number, fileName: string): Promise<void> {
  if (await db.questions.update(id, { audio: fileName }) === 0) throw new Error('这道题已不在题库中')
}

/** 某道题的全部答题记录（按时间升序）。 */
export async function getAttemptsByQuestion(questionId: number): Promise<Attempt[]> {
  const list = await db.attempts.where('questionId').equals(questionId).toArray()
  return list.sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime())
}

async function getLatestWrongAttempts(database: TopikDB) {
  const latest = new Map<number, { attempt: Attempt; at: Date }>()
  for (const attempt of await database.attempts.toArray()) {
    const at = studyEventDate(attempt.answeredAt)
    if (!at || attempt.subjective || !Number.isSafeInteger(attempt.questionId)) continue
    const previous = latest.get(attempt.questionId)
    if (!previous || at >= previous.at) latest.set(attempt.questionId, { attempt, at })
  }
  const wrong = [...latest.values()].filter(({ attempt }) => !attempt.correct)
  const questions = await database.questions.bulkGet(wrong.map(({ attempt }) => attempt.questionId))
  return wrong.flatMap((entry, index) => {
    const question = questions[index]
    return question && isVerifiedObjective(question) ? [{ ...entry, question }] : []
  })
}

/** 错题范围：最新一次可评分客观作答答错的题目 ID。 */
export function getWrongQuestionIds(): Promise<number[]> {
  return db.transaction('r', [db.attempts, db.questions], async () =>
    (await getLatestWrongAttempts(db)).map(({ attempt }) => attempt.questionId))
}

export function getWrongQuestions(database: TopikDB = db) {
  return database.transaction('r', [database.attempts, database.questions, database.readingPassages], async () => {
    const wrong = await getLatestWrongAttempts(database)
    const readingIds = [...new Set(wrong.flatMap(({ question }) => question.readingId ? [question.readingId] : []))]
    const passages = new Map((await database.readingPassages.bulkGet(readingIds)).flatMap(passage => passage ? [[passage.id, passage]] : []))
    return wrong.map(({ attempt, at, question }) => ({
      question, lastSelected: attempt.selectedAnswer, lastWrongAt: at,
      passage: question.readingId ? passages.get(question.readingId) : undefined,
    })).sort((a, b) => +b.lastWrongAt - +a.lastWrongAt)
  })
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

export function getWritingHistory(database: TopikDB = db) {
  return database.transaction('r', database.attempts, database.questions, async () => {
    const attempts = await database.attempts.orderBy('answeredAt').reverse()
      .filter(attempt => attempt.subjective === true).toArray()
    const questions = await database.questions.bulkGet(attempts.map(attempt => attempt.questionId))
    return attempts.flatMap((attempt, index) => {
      const question = questions[index]
      return question?.qtype === '写作' ? [{ attempt, question }] : []
    })
  })
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

// A backup is read under one transaction so its references describe one consistent state.
function learningTables(database: TopikDB) {
  return [database.vocab, database.reviews, database.daily_stats, database.questions,
    database.papers, database.attempts, database.examSessions, database.textbookProgress, database.learningResources,
    database.stageRuns, database.grammarStudy, database.archivedReviews, database.grammarFavorites, database.readingPassages, database.writingDrafts]
}

async function readBackup(database: TopikDB): Promise<string> {
  const [vocab, reviews, daily_stats, questions, papers, attempts, examSessions, textbookProgress, learningResources, stageRuns, grammarStudy, archive, grammarFavorites, readingPassages, writingDrafts] = await Promise.all([
    database.vocab.toArray(), database.reviews.toArray(), database.daily_stats.toArray(),
    database.questions.toArray(), database.papers.toArray(), database.attempts.toArray(), database.examSessions.toArray(),
    database.textbookProgress.toArray(), database.learningResources.toArray(), database.stageRuns.toArray(), database.grammarStudy.toArray(),
    database.archivedReviews.toArray(), getGrammarFavorites(database), database.readingPassages.toArray(), database.writingDrafts.toArray(),
  ])
  const data: BackupData = {
    app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, dexieVersion: database.verno, exportedAt: new Date().toISOString(),
    vocab, reviews, daily_stats, questions, papers, attempts, examSessions, textbookProgress, learningResources, stageRuns, grammarStudy,
    archivedReviews: archive.map(row => row.review), grammarFavorites, readingPassages, writingDrafts,
  }
  const json = JSON.stringify(data, null, 2)
  parseBackupJSON(json)
  return json
}

export async function exportBackupJSON(database: TopikDB = db): Promise<string> {
  return database.transaction('r', learningTables(database), () => readBackup(database))
}

export async function exportRecoverySnapshot(database: TopikDB = db): Promise<RecoverySnapshot | undefined> {
  const snapshot = await database.recoverySnapshots.get('latest')
  if (snapshot) parseBackupJSON(snapshot.json)
  return snapshot
}

function archivedReviewKey(review: ReviewRecord): string {
  return JSON.stringify([review.id, review.vocabId, review.reviewedAt, review.dueAt, review.grade, review.cardJson])
}

export async function importBackupJSON(jsonText: string, database: TopikDB = db): Promise<BackupPreview> {
  const { data, preview } = parseBackupJSON(jsonText)
  const tables = learningTables(database)
  await database.transaction('rw', [...tables, database.recoverySnapshots], async () => {
    // Validate the current state too; if a recovery snapshot cannot be verified, do not overwrite it.
    const json = await readBackup(database)
    const snapshot: RecoverySnapshot = { id: 'latest', createdAt: new Date().toISOString(), json }
    await database.recoverySnapshots.put(snapshot)
    const readBack = await database.recoverySnapshots.get('latest')
    if (readBack?.json !== json) throw new Error('恢复前快照校验失败')
    parseBackupJSON(readBack.json)

    // Keep the snapshot and the replacement atomic. Abort preserves all previous records and any older snapshot.
    for (const table of tables) {
      if (table === database.textbookProgress && !preview.includesTextbookProgress) continue
      if (table === database.learningResources && !preview.includesLearningResources) continue
      if (table === database.stageRuns && !preview.includesStageRuns) continue
      if (table === database.grammarStudy && !preview.includesGrammarStudy) continue
      if (table === database.archivedReviews && !preview.includesArchivedReviews) continue
      if (table === database.grammarFavorites && !preview.includesGrammarFavorites) continue
      await table.clear()
    }
    await database.vocab.bulkAdd(data.vocab)
    await database.reviews.bulkAdd(data.reviews)
    await database.daily_stats.bulkAdd(data.daily_stats)
    await database.questions.bulkAdd(data.questions)
    await database.papers.bulkAdd(data.papers)
    await database.attempts.bulkAdd(data.attempts)
    await database.examSessions.bulkAdd(data.examSessions)
    if (preview.includesTextbookProgress) await database.textbookProgress.bulkAdd(data.textbookProgress)
    if (preview.includesLearningResources) await database.learningResources.bulkAdd(data.learningResources)
    if (preview.includesStageRuns) await database.stageRuns.bulkAdd(data.stageRuns)
    if (preview.includesGrammarStudy) await database.grammarStudy.bulkAdd(data.grammarStudy)
    if (preview.includesGrammarFavorites) await database.grammarFavorites.bulkAdd(data.grammarFavorites.map(id => ({ id })))
    await database.readingPassages.bulkAdd(data.readingPassages)
    await database.writingDrafts.bulkAdd(data.writingDrafts)
    if (data.archivedReviews.length) {
      // A legacy file has no archive of its own. Keep the local archive and add only new detached rows.
      const existing = preview.includesArchivedReviews ? [] : await database.archivedReviews.toArray()
      const existingKeys = new Set(existing.map(row => archivedReviewKey(row.review)))
      const additions = data.archivedReviews.filter(review => !existingKeys.has(archivedReviewKey(review)))
      await database.archivedReviews.bulkAdd(additions.map(review => ({ review })))
    }
  })
  return preview
}

/** 只清空题库及依赖它的答题与考试会话。 */
export async function clearQuestionBank(): Promise<void> {
  await db.transaction('rw', [db.questions, db.papers, db.attempts, db.examSessions, db.writingDrafts], async () => {
    const readingIds = new Set(await db.questions.filter(question => !!question.readingId).primaryKeys())
    await db.questions.filter(question => !question.readingId).delete()
    await db.papers.clear()
    await db.attempts.filter(attempt => !readingIds.has(attempt.questionId)).delete()
    await db.examSessions.clear()
    await db.writingDrafts.clear()
  })
}

export interface QuestionBankImportResult {
  papersAdded: number
  papersReused: number
  questionsAdded: number
  /** 重复和冲突跳过的题目总数，保留给既有调用方。 */
  questionsSkipped: number
  errors: string[]
}

interface QuestionBankImportIssue {
  collection: 'papers' | 'questions'
  row: number
  field?: string
  kind: 'invalid' | 'conflict' | 'empty-paper'
  message: string
}

export interface QuestionBankImportPreview extends QuestionBankImportResult {
  duplicateQuestionRows: number[]
  issues: QuestionBankImportIssue[]
}

export class QuestionBankPreviewChanged extends Error {
  readonly preview: QuestionBankImportPreview

  constructor(preview: QuestionBankImportPreview) {
    super('题库在预览后发生变化，请重新核对导入结果。')
    this.preview = preview
  }
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
 * 同名试卷复用已有试卷（不重复建卷）；同一试卷内按科目和题号去重；冲突不覆盖已有题目。
 * 先全部校验、再一次性写入；写入失败时整批不落库。
 */
function parseQuestionBank(jsonText: string) {
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch {
    throw new Error('不是有效的 JSON 文件')
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('导入文件结构不对：顶层应为对象 { papers: [...], questions: [...] }')
  }
  const input = data as Record<string, unknown>
  for (const key of ['papers', 'questions']) {
    if (input[key] !== undefined && !Array.isArray(input[key])) throw new Error(`${key} 必须是数组`)
  }
  const rawPapers = (input.papers ?? []) as unknown[]
  const rawQuestions = (input.questions ?? []) as unknown[]
  if (rawPapers.length === 0 && rawQuestions.length === 0) {
    throw new Error('导入文件里没有试卷也没有题目')
  }

  const issues: QuestionBankImportIssue[] = []
  // --- 校验试卷 ---
  const validPapers: { row: number; paper: Omit<Paper, 'id'> }[] = []
  rawPapers.forEach((p, i) => {
    const label = `第 ${i + 1} 张试卷`
    const reject = (message: string, field?: string) => {
      issues.push({ collection: 'papers', row: i + 1, field, kind: 'invalid', message: `${label}：${message}` })
    }
    if (typeof p !== 'object' || p === null || Array.isArray(p)) {
      reject('不是对象，已拒绝')
      return
    }
    const r = p as Record<string, unknown>
    if (!isNonEmptyString(r.title)) {
      reject('缺 title（场次名称），已拒绝', 'title')
      return
    }
    if (!isNonEmptyString(r.source)) {
      reject('缺 source（来源），已拒绝', 'source')
      return
    }
    validPapers.push({ row: i + 1, paper: {
      title: (r.title as string).trim(),
      level: asOptionalString(r.level),
      examDate: asOptionalString(r.examDate),
      source: (r.source as string).trim(),
      status: asStatus(r.status),
      note: asOptionalString(r.note),
    } })
  })

  // --- 校验题目 ---
  interface ValidQuestion extends Omit<Question, 'id' | 'paperId'> {
    row: number
    paperTitle: string
  }
  const validQuestions: ValidQuestion[] = []
  rawQuestions.forEach((q, i) => {
    const label = `第 ${i + 1} 道题`
    const reject = (message: string, field?: string) => {
      issues.push({ collection: 'questions', row: i + 1, field, kind: 'invalid', message: `${label}：${message}` })
    }
    if (typeof q !== 'object' || q === null || Array.isArray(q)) {
      reject('不是对象，已拒绝')
      return
    }
    const r = q as Record<string, unknown>
    if (!isNonEmptyString(r.stem)) {
      reject('缺 stem（题干），已拒绝', 'stem')
      return
    }
    if (!isNonEmptyString(r.source)) {
      reject('缺 source（来源），已拒绝', 'source')
      return
    }
    if (!isNonEmptyString(r.qtype) || !QUESTION_TYPES.includes(r.qtype as QuestionType)) {
      reject('qtype（题型）缺失或不在允许范围（听力/阅读/写作/词汇/语法/其他），已拒绝', 'qtype')
      return
    }
    if (!Array.isArray(r.options) || !r.options.every(isNonEmptyString)) {
      reject('options 必须是非空字符串组成的数组；主观题请填 []', 'options')
      return
    }
    const options = r.options as string[]
    if (r.paperTitle !== undefined && !isNonEmptyString(r.paperTitle)) {
      reject('paperTitle 必须是非空字符串', 'paperTitle')
      return
    }
    if ((r.paperTitle !== undefined || r.order !== undefined) &&
        (typeof r.order !== 'number' || !Number.isSafeInteger(r.order) || r.order < 1)) {
      reject('试卷题目必须提供正整数题号 order；散题可省略题号', 'order')
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
        reject('answerIndex（正确选项下标）缺失或超出选项范围，已拒绝', 'answerIndex')
        return
      }
      answerIndex = r.answerIndex
    } else if (r.answerIndex !== undefined && r.answerIndex !== null) {
      reject('主观题（options 为空）不应填 answerIndex，已拒绝', 'answerIndex')
      return
    }
    // P6：听力音频引用（audio，字符串文件名；可空）与限时（timeLimit，正整数分钟；可空）。
    // 只记引用，不存音频文件本身；timeLimit 非正整数拒绝入库。
    let audio = ''
    if (r.audio !== undefined && r.audio !== null) {
      if (typeof r.audio !== 'string') {
        reject('audio（音频引用）不是字符串，已拒绝', 'audio')
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
        reject('timeLimit（限时分钟）不是 1–600 的正整数，已拒绝', 'timeLimit')
        return
      }
      timeLimit = r.timeLimit
    }
    validQuestions.push({
      row: i + 1,
      stem: (r.stem as string).trim(),
      options,
      answerIndex,
      answer: asOptionalString(r.answer),
      explanation: asOptionalString(r.explanation),
      source: (r.source as string).trim(),
      status: asStatus(r.status),
      qtype: r.qtype as QuestionType,
      difficulty: isNonEmptyString(r.difficulty) ? (r.difficulty as string).trim() : '中',
      paperTitle: asOptionalString(r.paperTitle).trim(),
      order: typeof r.order === 'number' ? r.order : 0,
      audio,
      timeLimit,
    })
  })

  return { validPapers, validQuestions, issues, hasQuestions: rawQuestions.length > 0 }
}

// Preview and import use the same plan. Negative IDs identify papers that do
// not exist yet and are replaced with real IDs before questions are written.
async function planQuestionBank(parsed: ReturnType<typeof parseQuestionBank>, database: TopikDB) {
  const issues = [...parsed.issues]
  let papersReused = 0
  const paperIdByTitle = new Map<string, number>()
  const ambiguousTitles = new Set<string>()
  const newPapers = new Map<number, { paper: Omit<Paper, 'id'>; row: number; repeats: number }>()
  const [existingPapers, existingQuestions] = await Promise.all([database.papers.toArray(), database.questions.toArray()])
  for (const paper of existingPapers) {
    if (paperIdByTitle.has(paper.title)) ambiguousTitles.add(paper.title)
    paperIdByTitle.set(paper.title, paper.id!)
  }
  for (const { row, paper } of parsed.validPapers) {
    const knownId = paperIdByTitle.get(paper.title)
    if (ambiguousTitles.has(paper.title)) {
      issues.push({ collection: 'papers', row, field: 'title', kind: 'conflict',
        message: `第 ${row} 张试卷：“${paper.title}”有多个旧记录，无法确定应关联哪一张` })
    } else if (knownId === undefined) {
      const id = -(newPapers.size + 1)
      newPapers.set(id, { paper, row, repeats: 0 })
      paperIdByTitle.set(paper.title, id)
    } else if (knownId < 0) {
      newPapers.get(knownId)!.repeats += 1
    } else {
      papersReused += 1
    }
  }

  const dedupeKey = (q: Question) => JSON.stringify(q.paperId !== undefined && q.order > 0
    ? [q.paperId, q.qtype, q.order]
    : [q.paperId ?? null, q.qtype, q.order, q.stem, q.paperId === undefined ? q.source : ''])
  const seen = new Map<string, Question>()
  const ambiguousKeys = new Set<string>()
  for (const q of existingQuestions) {
    const key = dedupeKey(q)
    if (seen.has(key)) ambiguousKeys.add(key)
    seen.set(key, q)
  }
  const questions: Question[] = []
  const duplicateQuestionRows: number[] = []
  let conflicts = 0
  for (const { row, paperTitle, ...question } of parsed.validQuestions) {
    const paperId = paperTitle ? paperIdByTitle.get(paperTitle) : undefined
    if (paperTitle && (paperId === undefined || ambiguousTitles.has(paperTitle))) {
      issues.push({ collection: 'questions', row, field: 'paperTitle', kind: 'invalid',
        message: `第 ${row} 道题：找不到唯一对应试卷“${paperTitle}”，已拒绝` })
      continue
    }
    const candidate: Question = { ...question, paperId }
    const key = dedupeKey(candidate)
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, candidate)
      questions.push(candidate)
    } else if (ambiguousKeys.has(key) || existing.stem !== candidate.stem ||
      existing.answerIndex !== candidate.answerIndex || JSON.stringify(existing.options) !== JSON.stringify(candidate.options)) {
      conflicts += 1
      issues.push({ collection: 'questions', row, field: 'order', kind: 'conflict',
        message: `第 ${row} 道题：“${paperTitle}” ${question.qtype} 第 ${question.order} 题编号冲突，保留已有题目和答题记录` })
    } else {
      duplicateQuestionRows.push(row)
    }
  }

  const papersWithQuestions = new Set(questions.map(q => q.paperId))
  const papers = new Map<number, Omit<Paper, 'id'>>()
  for (const [id, { paper, row, repeats }] of newPapers) {
    // Keep explicit papers-only files valid. In mixed files, avoid leaving
    // empty papers behind when none of their questions can be imported.
    if (parsed.hasQuestions && !papersWithQuestions.has(id)) {
      issues.push({ collection: 'papers', row, kind: 'empty-paper',
        message: `第 ${row} 张试卷：“${paper.title}”没有可导入的题目，已跳过空试卷` })
      continue
    }
    papers.set(id, paper)
    papersReused += repeats
  }
  const preview: QuestionBankImportPreview = {
    papersAdded: papers.size, papersReused, questionsAdded: questions.length,
    questionsSkipped: duplicateQuestionRows.length + conflicts,
    duplicateQuestionRows, issues,
    errors: issues.filter(issue => issue.kind !== 'empty-paper').map(issue => issue.message),
  }
  return { preview, papers, questions }
}

export async function previewQuestionBankImport(jsonText: string, database: TopikDB = db): Promise<QuestionBankImportPreview> {
  const parsed = parseQuestionBank(jsonText)
  return database.transaction('r', database.papers, database.questions, async () =>
    (await planQuestionBank(parsed, database)).preview,
  )
}

export async function importQuestionBank(
  jsonText: string, database: TopikDB = db, expectedPreview?: QuestionBankImportPreview,
): Promise<QuestionBankImportPreview> {
  const parsed = parseQuestionBank(jsonText)
  return database.transaction('rw', database.papers, database.questions, async () => {
    const { preview, papers, questions } = await planQuestionBank(parsed, database)
    if (expectedPreview && JSON.stringify(preview) !== JSON.stringify(expectedPreview)) {
      throw new QuestionBankPreviewChanged(preview)
    }
    const assignedIds = new Map<number, number>()
    for (const [id, paper] of papers) assignedIds.set(id, await database.papers.add(paper))
    await database.questions.bulkAdd(questions.map(q => {
      if (q.paperId === undefined || q.paperId > 0) return q
      const paperId = assignedIds.get(q.paperId)
      if (paperId === undefined) throw new Error('题目无法关联到已导入的试卷')
      return { ...q, paperId }
    }))
    return preview
  })
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

export async function incrementDailyStat(
  date: string, change: { reviewedWords?: number; correctCount?: number; minutes?: number; focusSessionId?: string },
  database: TopikDB = db,
): Promise<DailyStat> {
  return database.transaction('rw', database.daily_stats, async () => {
    const existing = await database.daily_stats.where('date').equals(date).first()
    if (change.focusSessionId) {
      const credited = await database.daily_stats.filter(row => row.focusSessionIds?.includes(change.focusSessionId!) === true).first()
      if (credited) return credited
    }
    const next: DailyStat = {
      ...existing,
      date,
      newWords: existing?.newWords ?? 0,
      reviewedWords: (existing?.reviewedWords ?? 0) + (change.reviewedWords ?? 0),
      correctCount: (existing?.correctCount ?? 0) + (change.correctCount ?? 0),
      minutes: (existing?.minutes ?? 0) + (change.minutes ?? 0),
    }
    if (change.focusSessionId) next.focusSessionIds = [...(existing?.focusSessionIds ?? []), change.focusSessionId]
    await database.daily_stats.put(next)
    return next
  })
}

export async function clearAllData(): Promise<void> {
  const tables = [...learningTables(db), db.recoverySnapshots]
  await db.transaction('rw', tables, async () => {
    for (const table of tables) await table.clear()
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
