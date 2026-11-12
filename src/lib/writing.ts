import { db, type Question, type TopikDB } from './db.ts'
import { compareDrafts, WRITING_CRITERIA, type WritingDraft } from './writing-model.ts'

const journalKey = (id: number) => `topik-master-writing-journal-${id}`

const signature = (question: Question) => JSON.stringify([question.stem, question.source, question.order, question.paperId])

export function readWritingJournal(question: Question): WritingDraft | undefined {
  try {
    const entry = JSON.parse(localStorage.getItem(journalKey(question.id!)) ?? 'null')
    const row = entry?.draft
    if (entry?.signature === signature(question) && row?.questionId === question.id && typeof row.text === 'string' && Number.isSafeInteger(row.revision) &&
      typeof row.token === 'string' && Number.isSafeInteger(row.seconds) && !isNaN(Date.parse(row.updatedAt))) return row
  } catch { /* IndexedDB remains available when localStorage is restricted. */ }
}

export function journalWritingDraft(draft: WritingDraft, question: Question) {
  try {
    const current = readWritingJournal(question)
    if (!current || compareDrafts(draft, current) > 0) localStorage.setItem(journalKey(draft.questionId), JSON.stringify({ signature: signature(question), draft }))
  } catch { /* The application still attempts the IndexedDB write. */ }
}

export function clearWritingJournal(question: Question, through: WritingDraft) {
  try {
    const current = readWritingJournal(question)
    if (current && compareDrafts(current, through) <= 0) localStorage.removeItem(journalKey(question.id!))
  } catch { /* A recovered journal is compared against the saved version again. */ }
}

export function saveWritingDraft(incoming: WritingDraft, database: TopikDB = db): Promise<WritingDraft> {
  return database.transaction('rw', [database.writingDrafts, database.questions], async () => {
    const question = await database.questions.get(incoming.questionId)
    if (question?.qtype !== '写作' || question.options.length) throw new Error('找不到对应的写作题')
    const current = await database.writingDrafts.get(incoming.questionId)
    if (current && compareDrafts(incoming, current) <= 0) return current
    const draft = { ...incoming, lastAttemptId: current?.lastAttemptId }
    await database.writingDrafts.put(draft)
    return draft
  })
}

export function clearAllWritingJournals() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('topik-master-writing-journal-')) localStorage.removeItem(key)
    }
  } catch { /* No journal is readable when browser storage is unavailable. */ }
}

export async function loadWritingDraft(question: Question) {
  const stored = await db.writingDrafts.get(question.id!)
  const journal = readWritingJournal(question)
  if (!journal) return stored
  const saved = !stored || compareDrafts(journal, stored) > 0 ? await saveWritingDraft(journal) : stored
  clearWritingJournal(question, saved)
  return saved
}

export function completeWritingDraft(incoming: WritingDraft, paperId?: number, database: TopikDB = db) {
  return database.transaction('rw', [database.writingDrafts, database.questions, database.attempts], async () => {
    const saved = await saveWritingDraft(incoming, database)
    if (saved.token !== incoming.token) throw new Error('草稿已有更新，请重新打开并核对内容')
    if (!saved.text.trim()) throw new Error('请先输入答案')
    const previous = saved.lastAttemptId === undefined ? undefined : await database.attempts.get(saved.lastAttemptId)
    if (previous?.selectedAnswer === saved.text) return previous.id!
    const id = await database.attempts.add({ questionId: saved.questionId, paperId, selectedAnswer: saved.text,
      correct: false, subjective: true, writingSeconds: saved.seconds, answeredAt: new Date() })
    await database.writingDrafts.update(saved.questionId, { lastAttemptId: id })
    return id
  })
}

export function saveWritingAssessment(attemptId: number, checks: string[], note: string, database: TopikDB = db) {
  return database.transaction('rw', [database.attempts, database.questions], async () => {
    const attempt = await database.attempts.get(attemptId)
    const question = attempt && await database.questions.get(attempt.questionId)
    if (!attempt?.subjective || question?.qtype !== '写作') throw new Error('找不到可自评的写作版本')
    const criteria = WRITING_CRITERIA.filter(([key]) => checks.includes(key)).map(([key]) => key)
    await database.attempts.update(attemptId, { writingAssessment: { checks: criteria, note: note.trim().slice(0, 4000), updatedAt: new Date().toISOString() } })
  })
}
