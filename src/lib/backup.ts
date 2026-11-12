import type { Attempt, DailyStat, Paper, Question, ReviewRecord, VocabEntry } from './db.ts'
import { EXAM_PROFILES, SECTION_TYPES, type ExamSession, type SectionKey } from './exam-model.ts'
import { isTextbookLessonId, type TextbookProgress } from './textbook-model.ts'
import { normalizeResource, type LearningResource } from './resource-model.ts'
import { isStudyStage, STAGE_MAX_QUESTIONS, type StageRun } from './stage-model.ts'
import { isGrammarPointId, type GrammarStudy } from './grammar-model.ts'
import { isReadingId, isScoredReadingQuestion, readArticle, readingBodyKey, type ReadingPassage } from './reading-model.ts'
import { WRITING_CRITERIA, type WritingDraft } from './writing-model.ts'

export const BACKUP_APP = 'topik-master-2027'
export const BACKUP_FORMAT_VERSION = 11
export const QUESTION_TYPES = ['听力', '阅读', '写作', '词汇', '语法', '其他'] as const

type Rows = {
  vocab: VocabEntry[]
  reviews: ReviewRecord[]
  archivedReviews: ReviewRecord[]
  daily_stats: DailyStat[]
  questions: Question[]
  papers: Paper[]
  attempts: Attempt[]
  examSessions: ExamSession[]
  textbookProgress: TextbookProgress[]
  learningResources: LearningResource[]
  stageRuns: StageRun[]
  grammarStudy: GrammarStudy[]
  grammarFavorites: string[]
  readingPassages: ReadingPassage[]
  writingDrafts: WritingDraft[]
}

export interface BackupData extends Rows {
  app: typeof BACKUP_APP
  formatVersion: number
  dexieVersion: number
  exportedAt: string
}

export interface BackupPreview {
  formatVersion: number
  dexieVersion: number
  exportedAt: string
  includesTextbookProgress: boolean
  includesLearningResources: boolean
  includesStageRuns: boolean
  includesGrammarStudy: boolean
  includesArchivedReviews: boolean
  includesGrammarFavorites: boolean
  includesReadingPassages: boolean
  includesWritingDrafts: boolean
  counts: Record<keyof Rows, number>
}

type Row = Record<string, unknown>
const fail = (path: string): never => { throw new Error(`${path} 无效，已拒绝恢复`) }
const record = (x: unknown, path: string): Row =>
  x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Row : fail(path)
const array = (x: unknown, path: string): unknown[] => Array.isArray(x) ? x : fail(path)
const string = (x: unknown): x is string => typeof x === 'string'
const nonempty = (x: unknown): x is string => string(x) && x.trim().length > 0
const bool = (x: unknown) => typeof x === 'boolean'
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0
const int = (x: unknown): x is number => num(x) && Number.isSafeInteger(x)
const id = (x: unknown): x is number => int(x) && x > 0
const oneOf = (x: unknown, values: readonly unknown[]) => values.includes(x)
const check = (ok: unknown, path: string) => { if (!ok) fail(path) }
const date = (x: unknown, path: string): Date => {
  if (!string(x)) return fail(path)
  const d = new Date(x)
  return Number.isFinite(d.getTime()) && d.toISOString() === x ? d : fail(path)
}
const dateKey = (x: unknown) => {
  if (!string(x) || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false
  const d = new Date(x + 'T00:00:00.000Z')
  return Number.isFinite(d.getTime()) && d.toISOString().startsWith(x + 'T')
}
const fields = (r: Row, keys: string[], predicate: (x: unknown) => boolean, path: string) => {
  for (const k of keys) check(predicate(r[k]), `${path}.${k}`)
}
const optional = (x: unknown, predicate: (x: unknown) => boolean) => x === undefined || predicate(x)
const status = (x: unknown) => oneOf(x, ['已核实', '待核实'])

function validateCard(json: unknown, reviewed: Date, due: Date, path: string) {
  if (!nonempty(json)) return fail(path)
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { return fail(path) }
  const card = record(parsed, path)
  const states = new Map([[1, 'learning'], [2, 'review'], [3, 'learning']])
  check(states.has(card.state as number) && states.get(card.state as number) === card.scheduleStatus, path + '.state')
  fields(card, ['stability', 'stabilityFast', 'scheduledDays'], num, path)
  fields(card, ['lapses', 'learningStep'], int, path)
  check(id(card.reps) && int(card.lapses) && card.lapses <= card.reps, path + '.reps/lapses')
  check(num(card.difficulty) && card.difficulty >= 1 && card.difficulty <= 10, path + '.difficulty')
  check(nonempty(card.cardId), path + '.cardId')
  check(date(card.dueAt, path + '.dueAt').getTime() === due.getTime() && due >= reviewed, path + '.dueAt')
  check(date(card.lastReviewAt, path + '.lastReviewAt').getTime() === reviewed.getTime(), path + '.lastReviewAt')
}

function parseRows<T extends { id?: number }>(
  raw: Row, table: string, read: (r: Row, path: string) => T,
): T[] {
  const seen = new Set<unknown>()
  return array(raw[table], table).map((x, i) => {
    const path = `${table}[${i}]`
    const r = record(x, path)
    check(id(r.id) && !seen.has(r.id), path + '.id')
    seen.add(r.id)
    return read(r, path)
  })
}

function readReview(r: Row, path: string): ReviewRecord {
  check(id(r.vocabId), path + '.vocabId')
  check(oneOf(r.grade, ['不认识', '模糊', '认识', '很熟']), path + '.grade')
  const reviewedAt = date(r.reviewedAt, path + '.reviewedAt')
  const dueAt = date(r.dueAt, path + '.dueAt')
  validateCard(r.cardJson, reviewedAt, dueAt, path + '.cardJson')
  return { ...r, reviewedAt, dueAt } as unknown as ReviewRecord
}

export function parseBackupJSON(json: string): { data: BackupData; preview: BackupPreview } {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error('不是有效的 JSON 文件') }
  const raw = record(parsed, '备份')
  check(raw.app === BACKUP_APP, 'app')
  const firstFormat = raw.formatVersion === 1 && raw.dexieVersion === 3
  const secondFormat = raw.formatVersion === 2 && raw.dexieVersion === 4
  const thirdFormat = raw.formatVersion === 3 && raw.dexieVersion === 5
  const fourthFormat = raw.formatVersion === 4 && raw.dexieVersion === 6
  const fifthFormat = raw.formatVersion === 5 && raw.dexieVersion === 7
  const includesWritingDrafts = (raw.formatVersion === BACKUP_FORMAT_VERSION || raw.formatVersion === 10) &&
    raw.dexieVersion === 12
  const includesReadingPassages = includesWritingDrafts || (raw.formatVersion === 9 && raw.dexieVersion === 11)
  const includesGrammarFavorites = includesReadingPassages || (raw.formatVersion === 8 && raw.dexieVersion === 10)
  const includesArchivedReviews = includesGrammarFavorites || (raw.formatVersion === 7 && raw.dexieVersion === 9)
  const includesGrammarStudy = includesArchivedReviews || (raw.formatVersion === 6 && raw.dexieVersion === 8)
  const includesStageRuns = fifthFormat || includesGrammarStudy
  const includesLearningResources = fourthFormat || includesStageRuns
  const includesTextbookProgress = thirdFormat || includesLearningResources
  check(firstFormat || secondFormat || includesTextbookProgress, '备份版本')
  date(raw.exportedAt, 'exportedAt')
  const vocab = parseRows<VocabEntry>(raw, 'vocab', (r, p) => {
    fields(r, ['ko'], nonempty, p)
    fields(r, ['pos', 'zh', 'source_level', 'yonsei_lesson', 'example_ko', 'example_zh'], string, p)
    fields(r, ['favorite', 'isTestData'], bool, p)
    check(oneOf(r.source, ['NIKL', 'TOPIK', '课程参考', '测试']), p + '.source')
    check(status(r.status) || r.status === '补充', p + '.status')
    return r as unknown as VocabEntry
  })
  const vocabIds = new Set(vocab.map(v => v.id))
  const archivedReviews = includesArchivedReviews ? array(raw.archivedReviews, 'archivedReviews').map((value, i) => {
    const path = `archivedReviews[${i}]`
    const row = record(value, path)
    check(id(row.id), path + '.id')
    return readReview(row, path)
  }) : []
  const reviews = parseRows(raw, 'reviews', (r, p) => {
    check(firstFormat || vocabIds.has(r.vocabId as number), p + '.vocabId')
    return readReview(r, p)
  }).filter(review => {
    if (vocabIds.has(review.vocabId)) return true
    // Historical v1 exports wrote dangling rows into the main review list.
    archivedReviews.push(review)
    return false
  })
  const daily_stats = parseRows<DailyStat>(raw, 'daily_stats', (r, p) => {
    check(dateKey(r.date), p + '.date')
    fields(r, ['newWords', 'reviewedWords', 'correctCount', 'minutes'], int, p)
    check((r.correctCount as number) <= (r.reviewedWords as number), p + '.correctCount')
    if (r.focusSessionIds !== undefined) {
      const sessions = array(r.focusSessionIds, p + '.focusSessionIds')
      check(sessions.every(value => string(value) && /^[a-z0-9-]{1,100}$/.test(value)) &&
        new Set(sessions).size === sessions.length, p + '.focusSessionIds')
    }
    // v3 日期索引不唯一；旧版并发可能产生重复日统计，保留原记录。
    return r as unknown as DailyStat
  })
  const papers = parseRows<Paper>(raw, 'papers', (r, p) => {
    fields(r, ['title', 'source'], nonempty, p)
    fields(r, ['level', 'examDate', 'note'], string, p)
    check(status(r.status), p + '.status')
    // 旧版将 examDate 作为来源文本导入，保留它，不用它调度或计时。
    return r as unknown as Paper
  })
  const paperIds = new Set(papers.map(p => p.id))
  const questions = parseRows<Question>(raw, 'questions', (r, p) => {
    fields(r, ['stem', 'source', 'difficulty'], nonempty, p)
    fields(r, ['answer', 'explanation'], string, p)
    check(status(r.status), p + '.status')
    check(oneOf(r.qtype, QUESTION_TYPES), p + '.qtype')
    check(int(r.order), p + '.order')
    check(optional(r.paperId, x => id(x) && paperIds.has(x)), p + '.paperId')
    check(optional(r.favorite, bool), p + '.favorite')
    check(optional(r.audio, string), p + '.audio')
    check(optional(r.timeLimit, x => id(x) && x <= 600), p + '.timeLimit')
    const options = array(r.options, p + '.options')
    check(options.every(nonempty), p + '.options')
    if (r.readingId !== undefined) {
      check(includesReadingPassages && isReadingId(r.readingId) && r.qtype === '阅读' && r.paperId === undefined &&
        options.length >= 2 && new Set(options).size === options.length, p + '.readingId')
      check(r.status === '待核实' ? r.answerIndex === null && r.explanation === '' :
        isScoredReadingQuestion(r as unknown as Question), p + '.answerIndex')
    } else {
      check(options.length ? int(r.answerIndex) && r.answerIndex < options.length : r.answerIndex === null, p + '.answerIndex')
    }
    return r as unknown as Question
  })
  const questionById = new Map(questions.map(q => [q.id, q]))
  const attempts = parseRows<Attempt>(raw, 'attempts', (r, p) => {
    const q = id(r.questionId) ? questionById.get(r.questionId) : undefined
    check(q, p + '.questionId')
    check(optional(r.paperId, x => id(x) && paperIds.has(x) && q?.paperId === x), p + '.paperId')
    check(bool(r.correct) && string(r.selectedAnswer), p + '.answer')
    check(optional(r.subjective, bool) && optional(r.writingSeconds, int), p + '.subjective')
    if (r.writingAssessment !== undefined) {
      const path = p + '.writingAssessment'
      check(includesWritingDrafts && r.subjective === true && q?.qtype === '写作', path)
      const assessment = record(r.writingAssessment, path)
      const checks = array(assessment.checks, path + '.checks')
      check(new Set(checks).size === checks.length && checks.every(key => WRITING_CRITERIA.some(([value]) => key === value)), path + '.checks')
      check(string(assessment.note) && assessment.note.length <= 4000, path + '.note')
      date(assessment.updatedAt, path + '.updatedAt')
    }
    if (q?.readingId) check(isScoredReadingQuestion(q) && r.correct === (r.selectedAnswer === q.options[q.answerIndex!]), p + '.correct')
    check(r.subjective === true
      ? q?.options.length === 0 && r.correct === false
      : q?.options.includes(r.selectedAnswer as string) && r.writingSeconds === undefined, p + '.selectedAnswer')
    return { ...r, answeredAt: date(r.answeredAt, p + '.answeredAt') } as unknown as Attempt
  })
  const examSessions = firstFormat ? [] : parseSessions(raw.examSessions, paperIds, questionById)
  const textbookProgress = includesTextbookProgress ? parseTextbookProgress(raw.textbookProgress) : []
  const learningResources = includesLearningResources ? parseRows<LearningResource>(raw, 'learningResources', (r, p) => {
    if (!string(r.title) || !string(r.url) || !string(r.note)) return fail(p)
    let normalized
    try { normalized = normalizeResource({ title: r.title, url: r.url, note: r.note }) } catch { return fail(p) }
    return { id: r.id as number, ...normalized, updatedAt: date(r.updatedAt, p + '.updatedAt').toISOString() }
  }) : []
  const stageRuns = includesStageRuns ? parseStageRuns(raw.stageRuns) : []
  const grammarStudy = includesGrammarStudy ? parseGrammarStudy(raw.grammarStudy) : []
  const readingPassages = includesReadingPassages ? parseReadingPassages(raw.readingPassages, questionById, attempts) : []
  const writingDrafts = includesWritingDrafts ? parseWritingDrafts(raw.writingDrafts, questionById, attempts) : []
  const grammarFavorites: string[] = []
  if (includesGrammarFavorites) {
    const seen = new Set<string>()
    for (const [i, value] of array(raw.grammarFavorites, 'grammarFavorites').entries()) {
      if (!isGrammarPointId(value) || seen.has(value)) return fail(`grammarFavorites[${i}]`)
      seen.add(value)
      grammarFavorites.push(value)
    }
  }
  const data: BackupData = {
    app: BACKUP_APP, formatVersion: raw.formatVersion as number, dexieVersion: raw.dexieVersion as number,
    exportedAt: raw.exportedAt as string, vocab, reviews, daily_stats, questions, papers, attempts, examSessions, textbookProgress,
    learningResources, stageRuns, grammarStudy, archivedReviews, grammarFavorites, readingPassages, writingDrafts,
  }
  return { data, preview: {
    exportedAt: data.exportedAt, formatVersion: data.formatVersion, dexieVersion: data.dexieVersion, includesTextbookProgress,
    includesLearningResources, includesStageRuns, includesGrammarStudy, includesArchivedReviews, includesGrammarFavorites, includesReadingPassages,
    includesWritingDrafts,
    counts: { vocab: vocab.length, reviews: reviews.length, daily_stats: daily_stats.length,
      questions: questions.length, papers: papers.length, attempts: attempts.length, examSessions: examSessions.length,
      textbookProgress: textbookProgress.length, learningResources: learningResources.length, stageRuns: stageRuns.length,
      grammarStudy: grammarStudy.length, archivedReviews: archivedReviews.length, grammarFavorites: grammarFavorites.length,
      readingPassages: readingPassages.length, writingDrafts: writingDrafts.filter(draft => draft.text.trim()).length },
  } }
}

function parseWritingDrafts(raw: unknown, questions: Map<number | undefined, Question>, attempts: Attempt[]): WritingDraft[] {
  const seen = new Set<number>()
  const attemptsById = new Map(attempts.map(attempt => [attempt.id, attempt]))
  return array(raw, 'writingDrafts').map((value, index) => {
    const path = `writingDrafts[${index}]`
    const row = record(value, path)
    if (!id(row.questionId) || seen.has(row.questionId)) return fail(path + '.questionId')
    const question = questions.get(row.questionId)
    check(question?.qtype === '写作' && !question.options.length, path + '.questionId')
    check(string(row.text) && int(row.seconds) && int(row.revision) &&
      string(row.token) && /^[a-z0-9-]{1,80}$/u.test(row.token), path + '.state')
    date(row.updatedAt, path + '.updatedAt')
    if (row.lastAttemptId !== undefined) {
      const attempt = id(row.lastAttemptId) ? attemptsById.get(row.lastAttemptId) : undefined
      check(attempt?.subjective && attempt.questionId === row.questionId, path + '.lastAttemptId')
    }
    seen.add(row.questionId)
    return row as unknown as WritingDraft
  })
}

function parseReadingPassages(raw: unknown, questions: Map<number | undefined, Question>, attempts: Attempt[]): ReadingPassage[] {
  const ids = new Set<string>()
  const bodies = new Set<string>()
  const linked = new Set<number>()
  const saved = new Set(attempts.map(a => JSON.stringify([a.questionId, a.answeredAt.toISOString(), a.selectedAnswer])))
  const passages = array(raw, 'readingPassages').map((value, index) => {
    const path = `readingPassages[${index}]`
    const row = record(value, path)
    const article = readArticle(row, path)
    const body = readingBodyKey(article.paragraphs)
    check(!ids.has(article.id) && !bodies.has(body), path + '.id')
    ids.add(article.id)
    bodies.add(body)
    const questionIds = array(row.questionIds, path + '.questionIds')
    check(questionIds.length > 0, path + '.questionIds')
    const members = new Map<string, Question>()
    for (const [i, key] of questionIds.entries()) {
      const q = id(key) ? questions.get(key) : undefined
      if (!q || q.readingId !== article.id || q.order !== i + 1 || linked.has(key as number)) return fail(path + '.questionIds')
      linked.add(key as number)
      members.set(String(key), q)
    }
    check(bool(row.favorite) && int(row.paragraph) && (row.paragraph as number) < article.paragraphs.length, path + '.progress')
    const choices = record(row.choices, path + '.choices')
    for (const [key, selected] of Object.entries(choices)) {
      const q = members.get(key)
      check(q && int(selected) && (selected as number) < q.options.length, path + '.choices')
    }
    if (row.finishedAt !== null) {
      date(row.finishedAt, path + '.finishedAt')
      const scored = [...members.values()].filter(isScoredReadingQuestion)
      check(scored.length && scored.every(q => saved.has(JSON.stringify([
        q.id, row.finishedAt, q.options[choices[String(q.id)] as number],
      ]))), path + '.finishedAt')
    }
    return { ...article, questionIds: questionIds as number[], choices: choices as Record<string, number>,
      paragraph: row.paragraph as number, favorite: row.favorite as boolean, finishedAt: row.finishedAt as string | null }
  })
  for (const q of questions.values()) if (q.readingId && !linked.has(q.id!)) fail('questions.readingId')
  return passages
}

function parseGrammarStudy(raw: unknown): GrammarStudy[] {
  const seen = new Set<string>()
  return array(raw, 'grammarStudy').map((value, index) => {
    const p = `grammarStudy[${index}]`
    const row = record(value, p)
    if (!isGrammarPointId(row.id) || seen.has(row.id)) return fail(p + '.id')
    if (typeof row.learned !== 'boolean' || !int(row.attempts) || !int(row.correct) || row.correct > row.attempts) {
      return fail(p + '.state')
    }
    seen.add(row.id)
    return { id: row.id, learned: row.learned, attempts: row.attempts, correct: row.correct,
      updatedAt: date(row.updatedAt, p + '.updatedAt').toISOString() }
  })
}

function parseStageRuns(raw: unknown): StageRun[] {
  const seen = new Set<string>()
  let hasActive = false
  return array(raw, 'stageRuns').map((value, index) => {
    const p = `stageRuns[${index}]`
    const run = record(value, p)
    if (!nonempty(run.id) || seen.has(run.id)) return fail(p + '.id')
    seen.add(run.id)
    check(isStudyStage(run.stage), p + '.stage')
    check(nonempty(run.paperTitle), p + '.paperTitle')
    const start = date(run.startedAt, p + '.startedAt')
    if (run.finishedAt === undefined) {
      check(!hasActive, p + '.finishedAt')
      hasActive = true
    } else {
      check(date(run.finishedAt, p + '.finishedAt') >= start, p + '.finishedAt')
    }
    const questions = array(run.questions, p + '.questions')
    const answers = array(run.answers, p + '.answers')
    check(questions.length > 0 && questions.length <= STAGE_MAX_QUESTIONS, p + '.questions')
    check(int(run.cursor) && run.cursor < questions.length, p + '.cursor')
    check(answers.length === questions.length, p + '.answers')
    const questionIds = new Set<number>()
    questions.forEach((value, index) => {
      const qPath = `${p}.questions[${index}]`
      const q = record(value, qPath)
      if (!id(q.questionId) || questionIds.has(q.questionId)) return fail(qPath + '.questionId')
      questionIds.add(q.questionId)
      fields(q, ['stem', 'source'], nonempty, qPath)
      check(oneOf(q.qtype, QUESTION_TYPES), qPath + '.qtype')
      check(string(q.explanation) && optional(q.audio, string), qPath + '.explanation/audio')
      const options = array(q.options, qPath + '.options')
      check(options.every(nonempty) && int(q.answerIndex) && q.answerIndex < options.length, qPath + '.answerIndex')
      const answer = answers[index]
      check(answer === null || int(answer) && answer < options.length, `${p}.answers[${index}]`)
    })
    return run as unknown as StageRun
  })
}

function parseTextbookProgress(raw: unknown): TextbookProgress[] {
  const seen = new Set<string>()
  return array(raw, 'textbookProgress').map((value, index) => {
    const p = `textbookProgress[${index}]`
    const row = record(value, p)
    if (!isTextbookLessonId(row.id) || seen.has(row.id)) return fail(p + '.id')
    if (row.status !== 'in-progress' && row.status !== 'completed') return fail(p + '.status')
    seen.add(row.id)
    return { id: row.id, status: row.status, updatedAt: date(row.updatedAt, p + '.updatedAt').toISOString() }
  })
}

function parseSessions(raw: unknown, papers: Set<number | undefined>, questions: Map<number | undefined, Question>): ExamSession[] {
  const sessionIds = new Set<unknown>()
  let running = false
  return array(raw, 'examSessions').map((value, i) => {
    const p = `examSessions[${i}]`
    const s = record(value, p)
    check(nonempty(s.id) && !sessionIds.has(s.id), p + '.id')
    sessionIds.add(s.id)
    check(id(s.paperId) && papers.has(s.paperId), p + '.paperId')
    check(s.status === 'done' || s.status === 'running' && !running, p + '.status')
    if (s.status === 'running') running = true
    fields(s, ['sectionIdx', 'questionIdx', 'sectionStartedAt', 'sectionEndAt', 'updatedAt', 'otherCount'], int, p)
    const all = new Set<number>()
    const profileKeys = Object.keys(EXAM_PROFILES)
    check(s.mode === undefined || s.mode === 'practice' || profileKeys.includes(s.mode as string), p + '.mode')
    const preset = s.mode === undefined || s.mode === 'practice'
      ? undefined : EXAM_PROFILES[s.mode as keyof typeof EXAM_PROFILES]
    const sectionKeys = preset?.sections.map(sec => sec.key) ?? Object.keys(SECTION_TYPES)
    check(s.scope === undefined || s.mode === 'practice' && sectionKeys.includes(s.scope as SectionKey), p + '.scope')
    const sections = array(s.sections, p + '.sections').map(value => {
      const sec = record(value, p + '.sections')
      check(sectionKeys.includes(sec.key as string) && id(sec.minutes) && sec.minutes <= 600, p + '.sections')
      const questionIds = array(sec.questionIds, p + '.questionIds')
      check(questionIds.length > 0, p + '.questionIds')
      for (const qid of questionIds) {
        if (!id(qid)) fail(p + '.questionIds')
        const q = questions.get(qid as number)
        check(q && q.paperId === s.paperId && q.qtype === SECTION_TYPES[sec.key as SectionKey] && !all.has(qid as number), p + '.questionIds')
        all.add(qid as number)
      }
      return { key: sec.key as SectionKey, minutes: sec.minutes as number, questionIds: questionIds as number[] }
    })
    const idx = s.sectionIdx as number
    check(sections.length > 0 && sections.every((sec, j) => j === 0 ||
      sectionKeys.indexOf(sections[j - 1].key as string) < sectionKeys.indexOf(sec.key as string)), p + '.sections')
    if (preset) check(sections.length === preset.sections.length && sections.every((sec, j) =>
      sec.key === preset.sections[j].key && sec.minutes === preset.sections[j].minutes), p + '.sections')
    if (s.scope !== undefined) check(sections.length === 1 && sections[0].key === s.scope, p + '.scope')
    check(s.pausedAt === undefined || s.status === 'running' && s.scope !== undefined &&
      int(s.pausedAt) && s.pausedAt >= (s.sectionStartedAt as number) &&
      s.pausedAt < (s.sectionEndAt as number) && s.pausedAt <= (s.updatedAt as number), p + '.pausedAt')
    const current = sections[idx]
    check(current && (s.questionIdx as number) < current.questionIds.length, p + '.questionIdx')
    check((s.sectionEndAt as number) - (s.sectionStartedAt as number) === (current.minutes as number) * 60000, p + '.sectionEndAt')
    const answers = record(s.answers, p + '.answers')
    const permittedIds = new Set(sections.slice(0, idx + 1).flatMap(sec => sec.questionIds))
    for (const [key, value] of Object.entries(answers)) {
      const qid = Number(key)
      check(String(qid) === key && permittedIds.has(qid), p + '.answers')
      const a = record(value, p + '.answers')
      check(a.enteredAt === undefined || int(a.enteredAt) && a.enteredAt <= (s.updatedAt as number), p + '.enteredAt')
      const q = questions.get(qid)!
      check(q.options.length > 0
        ? int(a.selected) && a.selected < q.options.length && a.text === undefined && a.seconds === undefined
        : q.qtype === '写作' && string(a.text) && int(a.seconds) && a.selected === undefined, p + '.answers')
    }
    const summaries = array(s.summaries, p + '.summaries')
    check(summaries.length === (s.status === 'done' ? sections.length : idx), p + '.summaries')
    check(s.status !== 'done' || idx === sections.length - 1, p + '.sectionIdx')
    summaries.forEach((value, j) => {
      const sum = record(value, p + '.summaries')
      const sec = sections[j]
      const answered = sec.questionIds.filter(qid => {
        const a = answers[String(qid)] as Row | undefined
        return a && (a.selected !== undefined || nonempty(a.text))
      }).length
      check(sum.key === sec.key && sum.label === SECTION_TYPES[sec.key as SectionKey] &&
        sum.answered === answered && sum.unanswered === sec.questionIds.length - answered &&
        int(sum.seconds) && sum.seconds <= (sec.minutes as number) * 60, p + '.summaries')
    })
    if (s.mode !== undefined || s.grades !== undefined) {
      const grades = record(s.grades, p + '.grades')
      const gradedIds = sections.slice(0, summaries.length).flatMap(sec => sec.questionIds)
      check(Object.keys(grades).every(key => String(Number(key)) === key && gradedIds.includes(Number(key))), p + '.grades')
      if (s.mode !== undefined) check(Object.keys(grades).length === gradedIds.length, p + '.grades')
      for (const qid of gradedIds) {
        const q = questions.get(qid)!
        const a = answers[String(qid)] as Row | undefined
        const grade = grades[qid]
        if (s.mode === undefined && grade === undefined) continue
        check(q.qtype === '写作' && !q.options.length
          ? grade === (nonempty(a?.text) ? 'written' : 'unwritten')
          : grade === 'excluded' || (a?.selected === undefined ? grade === 'unanswered' :
            grade === 'correct' || grade === 'wrong'), p + '.grades')
      }
    }
    return s as unknown as ExamSession
  })
}
