import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import Dexie from 'dexie'
import { TopikDB, exportBackupJSON, exportRecoverySnapshot, importBackupJSON, importQuestionBank, parseBackupJSON,
  deleteLearningResource, getFavoriteQuestions, getGrammarFavorites, getGrammarStudy, getLearningResources, getTextbookProgress,
  incrementDailyStat, previewQuestionBankImport, QuestionBankPreviewChanged, recordGrammarAnswer, saveLearningResource,
  setGrammarFavorite, setGrammarLearned, setQuestionFavorite, setTextbookProgress } from '../src/lib/db.ts'
import { checkpointExam, getExamHistory, loadExam, moveExamCursor, saveExamAnswer, setExamPaused, startExam, submitExamSection, submitExpiredExam } from '../src/lib/exam.ts'
import { createExamClock } from '../src/lib/exam-model.ts'
import { newSrsCard, reviewSrsCard, serializeCard } from '../src/lib/srs.ts'
import { isReminderTime, validReminderPreferences } from '../src/lib/reminders.ts'
import { discardStageRun, getStageRuns, moveStageCursor, saveStageAnswer, scoreStageRun, startStageRun, submitStageRun } from '../src/lib/stage.ts'
import { buildGrammarQuiz } from '../src/lib/grammar-model.ts'
import { countDue, DueCardChanged, getDueList, gradeCard } from '../src/lib/review.ts'
import { localDateKey } from '../src/lib/streak.ts'
import { buildDailyExport, getDayActivity, getDayStats, getMonthCells, getStatsOverview, getStudyGoalActivity, getStudyOverview } from '../src/lib/stats.ts'
import { loadSeedVocabulary } from '../src/lib/import.ts'
import { importReadingPassages, readPassage, saveReadingChoice, saveReadingPosition, submitReading } from '../src/lib/reading.ts'
import { completeWritingDraft, saveWritingAssessment, saveWritingDraft } from '../src/lib/writing.ts'

const when = new Date('2026-11-09T04:00:00.000Z')
const duration = { listening: 1, reading: 1, writing: 1 }
const paper = { title: '隔离测试卷', source: '自动化测试', level: 'TOPIK II', examDate: '', status: '待核实', note: '' }
const question = (qtype, order = 1) => ({
  paperTitle: paper.title, qtype, order, stem: qtype + ' 测试题 ' + order,
  source: '自动化测试', status: '已核实', options: qtype === '写作' ? [] : ['选项一', '选项二'],
  answerIndex: qtype === '写作' ? null : 0,
})
const importBank = (db, questions) => importQuestionBank(JSON.stringify({ papers: [paper], questions }), db)
const vocab = { id: 4, ko: '공부', zh: '学习', pos: '', source: '课程参考', source_level: '', yonsei_lesson: '',
  status: '待核实', example_ko: '', example_zh: '', favorite: true, isTestData: false }

function isolated(t, name = 'test-topik-' + randomUUID()) {
  const db = new TopikDB(name)
  t.after(() => db.close())
  return db
}
async function seeded(t) {
  const db = isolated(t)
  await db.vocab.add(vocab)
  const card = (await reviewSrsCard(await newSrsCard(when), '认识', when)).card
  await db.reviews.add({ id: 7, vocabId: vocab.id, grade: '认识', reviewedAt: when, dueAt: card.dueAt, cardJson: serializeCard(card) })
  await db.daily_stats.add({ id: 5, date: '2026-11-09', newWords: 1, reviewedWords: 1, correctCount: 1, minutes: 3 })
  await importBank(db, [question('阅读'), question('写作')])
  const q = await db.questions.orderBy('id').first()
  await db.attempts.add({ id: 9, questionId: q.id, paperId: q.paperId, correct: true,
    selectedAnswer: q.options[0], answeredAt: when })
  return db
}
const withoutTime = async db => {
  const { exportedAt: _exportedAt, ...rows } = JSON.parse(await exportBackupJSON(db))
  return rows
}

test('writing draft ordering, independent questions and submission are transactional', async t => {
  const db = isolated(t)
  await importBank(db, [question('写作', 51), question('写作', 53)])
  const [first, second] = await db.questions.toArray()
  const initial = { questionId: first.id, text: '처음 작성한 문장입니다.', seconds: 2, token: 'draft-1', revision: 1, updatedAt: when.toISOString() }
  const latest = { ...initial, text: '고친 문장입니다.', revision: 2, token: 'draft-2' }
  await saveWritingDraft(latest, db)
  await saveWritingDraft(initial, db)
  await saveWritingDraft({ ...initial, questionId: second.id }, db)
  assert.equal((await db.writingDrafts.get(first.id)).text, latest.text)
  assert.equal((await db.writingDrafts.get(second.id)).text, initial.text)
  await assert.rejects(completeWritingDraft(initial, first.paperId, db), /草稿已有更新/)
  const fail = () => { throw new Error('injected writing commit failure') }
  db.attempts.hook('creating', fail)
  await assert.rejects(completeWritingDraft(latest, first.paperId, db), /writing commit failure/)
  assert.equal((await db.writingDrafts.get(first.id)).lastAttemptId, undefined)
  db.attempts.hook('creating').unsubscribe(fail)
  const [id, duplicate] = await Promise.all([completeWritingDraft(latest, first.paperId, db), completeWritingDraft(latest, first.paperId, db)])
  assert.equal(id, duplicate)
  assert.equal(await db.attempts.count(), 1)
  await saveWritingAssessment(id, ['structure', 'grammar', 'grammar'], '下一版补过渡句', db)
  const next = { ...latest, text: '다음 문장입니다.', revision: 3, token: 'draft-3' }
  assert.notEqual(await completeWritingDraft(next, first.paperId, db), id)
  const activity = await getDayActivity(localDateKey(new Date()), db)
  assert.equal(activity.writingAnswers, 2)
  assert.equal(activity.writingQuestionsCompleted, 1)
  const { data } = parseBackupJSON(await exportBackupJSON(db))
  assert.deepEqual(data.attempts[0].writingAssessment.checks, ['structure', 'grammar'])
  assert.equal(data.attempts[1].writingAssessment, undefined)
})

test('writing backups restore drafts and assessments, reject bad links, and preserve v9 records in recovery', async t => {
  const db = isolated(t)
  await importBank(db, [question('写作', 54)])
  const [q] = await db.questions.toArray()
  const legacy = JSON.parse(await exportBackupJSON(db))
  delete legacy.writingDrafts
  Object.assign(legacy, { formatVersion: 9, dexieVersion: 11 })
  const draft = { questionId: q.id, text: '수정할 글입니다.', seconds: 2, token: 'writing-restore', revision: 1, updatedAt: when.toISOString() }
  const id = await completeWritingDraft(draft, q.paperId, db)
  await saveWritingAssessment(id, ['content'], '检查例子', db)
  const backup = JSON.parse(await exportBackupJSON(db))
  const damaged = structuredClone(backup)
  damaged.writingDrafts[0].lastAttemptId = 9000
  await assert.rejects(importBackupJSON(JSON.stringify(damaged), db), /lastAttemptId/)
  const fresh = isolated(t)
  const fail = () => { throw new Error('injected writing restore failure') }
  fresh.writingDrafts.hook('creating', fail)
  await assert.rejects(importBackupJSON(JSON.stringify(backup), fresh), /writing restore failure/)
  assert.equal(await fresh.questions.count(), 0)
  fresh.writingDrafts.hook('creating').unsubscribe(fail)
  await importBackupJSON(JSON.stringify(backup), fresh)
  assert.equal((await fresh.writingDrafts.get(q.id)).text, draft.text)
  assert.equal((await fresh.attempts.get(id)).writingAssessment.note, '检查例子')
  await importBackupJSON(JSON.stringify(legacy), db)
  assert.equal(await db.writingDrafts.count(), 0)
  assert.equal((await db.questions.get(q.id)).stem, q.stem)
  const snapshot = await exportRecoverySnapshot(db)
  await importBackupJSON(snapshot.json, db)
  assert.equal((await db.writingDrafts.get(q.id)).lastAttemptId, id)
})

test('public grammar has only the sourced original explanations and examples', async () => {
  const notes = JSON.parse(await readFile(new URL('../data/grammar-notes.json', import.meta.url), 'utf8'))
  assert.equal(Object.keys(notes).length, 8)
  for (const note of Object.values(notes)) {
    assert.ok(note.pattern.trim())
    assert.ok(['初级', '中级', '高级'].includes(note.stage))
    assert.equal(new URL(note.sourceUrl).origin, 'https://krdict.korean.go.kr')
    assert.ok(note.meaningZh.trim() && note.usageZh.trim() && note.exampleZh.trim())
    assert.match(note.exampleKo, /[가-힣]/u)
    assert.equal('page' in note, false)
  }
})

test('grammar favorites remain separate from activity and survive v9 and v7 restore', async t => {
  const db = isolated(t)
  const id = 'g6-1-03-02'
  await setGrammarFavorite(id, true, db)
  await setGrammarFavorite(id, true, db)
  assert.deepEqual(await getGrammarStudy(db), [])
  assert.deepEqual(await getGrammarFavorites(db), [id])
  const backup = JSON.parse(await exportBackupJSON(db))
  assert.equal(backup.formatVersion, 11)
  const fresh = isolated(t)
  await importBackupJSON(JSON.stringify(backup), fresh)
  assert.deepEqual(await getGrammarFavorites(fresh), [id])
  const { grammarFavorites: _favorites, ...previous } = backup
  await importBackupJSON(JSON.stringify({ ...previous, formatVersion: 7, dexieVersion: 9 }), fresh)
  assert.deepEqual(await getGrammarFavorites(fresh), [id])
  const invalid = { ...backup, grammarFavorites: [id, id] }
  await assert.rejects(importBackupJSON(JSON.stringify(invalid), fresh), /grammarFavorites\[1\]/)
  assert.deepEqual(await getGrammarFavorites(fresh), [id])
  await setGrammarFavorite(id, false, fresh)
  assert.deepEqual(await getGrammarFavorites(fresh), [])
})

test('reading imports link one article to its questions and block unverified scoring and duplicates', async t => {
  const db = isolated(t)
  const source = JSON.parse(await readFile(new URL('../data/reading-original.json', import.meta.url), 'utf8'))
  const [article] = source
  article.questions.push({ ...article.questions[0], order: 3, stem: '未核实的题', explanation: '' })
  const input = JSON.stringify(source)
  assert.equal(await importReadingPassages(input, db), 2)
  const { passage, questions } = await readPassage(article.id, db)
  assert.deepEqual(passage.questionIds, questions.map(q => q.id))
  assert.equal(questions[2].status, '待核实')
  assert.equal(questions[2].answerIndex, null)
  await assert.rejects(importReadingPassages(JSON.stringify([{ ...article, id: 'other-id' }]), db), /重复/)
  await assert.rejects(importReadingPassages(JSON.stringify([{ ...article, questions: [{ ...article.questions[0], order: 2 }] }]), db), /题号/)
  await assert.rejects(saveReadingChoice(article.id, 9999, 0, db), /无法保存/)
  await assert.rejects(submitReading(article.id, db), /全部/)
  for (const q of questions) await saveReadingChoice(article.id, q.id, 0, db)
  await saveReadingPosition(article.id, 1, db)
  await Promise.all([submitReading(article.id, db, when), submitReading(article.id, db, when)])
  assert.equal(await db.attempts.count(), 2)
  assert.equal((await readPassage(article.id, db)).passage.paragraph, 1)
  const activity = await getDayActivity(localDateKey(when), db)
  assert.equal(activity.objectiveAnswers, 2)
  assert.equal(activity.readingPassages, 1)
  await assert.rejects(saveReadingChoice(article.id, questions[0].id, 1, db), /无法保存/)
})

test('reading restores linked results atomically and a v8 restore saves the replaced library in its snapshot', async t => {
  const db = await seeded(t)
  const base = JSON.parse(await exportBackupJSON(db))
  const { readingPassages: _passages, ...old } = base
  const legacy = JSON.stringify({ ...old, formatVersion: 8, dexieVersion: 10 })
  const source = await readFile(new URL('../data/reading-original.json', import.meta.url), 'utf8')
  await importReadingPassages(source, db)
  const { passage, questions } = await readPassage('original-library-umbrella', db)
  await db.readingPassages.update(passage.id, { favorite: true })
  for (const q of questions) await saveReadingChoice(passage.id, q.id, q.answerIndex, db)
  const fail = () => { throw new Error('injected reading attempt failure') }
  db.attempts.hook('creating', fail)
  await assert.rejects(submitReading(passage.id, db, when), /reading attempt failure/)
  assert.equal((await readPassage(passage.id, db)).passage.finishedAt, null)
  assert.equal(await db.attempts.count(), 1)
  db.attempts.hook('creating').unsubscribe(fail)
  await submitReading(passage.id, db, when)
  const verified = JSON.parse(await exportBackupJSON(db))
  const damaged = structuredClone(verified)
  damaged.readingPassages[0].questionIds.reverse()
  await assert.rejects(importBackupJSON(JSON.stringify(damaged), db), /questionIds/)
  const fresh = isolated(t)
  fresh.readingPassages.hook('creating', fail)
  await assert.rejects(importBackupJSON(JSON.stringify(verified), fresh), /reading attempt failure/)
  assert.equal(await fresh.questions.count(), 0)
  assert.equal(await exportRecoverySnapshot(fresh), undefined)
  await importBackupJSON(legacy, db)
  assert.equal(await db.readingPassages.count(), 0)
  assert.equal(await db.attempts.count(), 1)
  const snapshot = await exportRecoverySnapshot(db)
  await importBackupJSON(snapshot.json, db)
  const { exportedAt: _exportedAt, ...expected } = verified
  assert.deepEqual(await withoutTime(db), expected)
})

test('FSRS uses the exact due instant across local midnight and rejects stale duplicate ratings', async t => {
  const db = isolated(t)
  await db.vocab.add(vocab)
  const beforeMidnight = new Date(2026, 10, 9, 23, 59, 55)
  const [fresh] = await getDueList(beforeMidnight, db)
  const first = await gradeCard(vocab.id, '不认识', beforeMidnight, db, { reviewId: fresh.reviewId })
  assert.notEqual(localDateKey(beforeMidnight), localDateKey(first.dueAt))
  assert.deepEqual(await getDueList(new Date(first.dueAt.getTime() - 1), db), [])
  const [due] = await getDueList(first.dueAt, db)
  const sameView = { reviewId: due.reviewId }
  const ratings = await Promise.allSettled([
    gradeCard(vocab.id, '认识', first.dueAt, db, sameView),
    gradeCard(vocab.id, '认识', first.dueAt, db, sameView),
  ])
  assert.equal(ratings.filter(rating => rating.status === 'fulfilled').length, 1)
  assert.ok(ratings.find(rating => rating.status === 'rejected').reason instanceof DueCardChanged)
  assert.deepEqual(await getDueList(first.dueAt, db), [])
  assert.equal(await db.reviews.count(), 2)
  const day1 = await getDayActivity(localDateKey(beforeMidnight), db)
  const day2 = await getDayActivity(localDateKey(first.dueAt), db)
  assert.deepEqual([day1.summary.newWords, day1.summary.reviewedWords, day2.summary.newWords, day2.summary.reviewedWords], [1, 1, 0, 1])
  assert.deepEqual((await db.daily_stats.toArray()).map(day => day.correctCount), [0, 1])
})

test('A: reject invalid rows, relationships, dates, and real FSRS card tampering before writing', async t => {
  const db = await seeded(t)
  const before = await withoutTime(db)
  const valid = JSON.parse(await exportBackupJSON(db))
  const mutations = [
    [r => { delete r.vocab[0].zh }, /vocab.*zh/],
    [r => { r.vocab.push(r.vocab[0]) }, /vocab.*id/],
    [r => { r.reviews[0].vocabId = 1000 }, /reviews.*vocabId/],
    [r => { r.reviews[0].cardJson = 'not-json' }, /cardJson/],
    [r => { const c = JSON.parse(r.reviews[0].cardJson); c.state = 99; r.reviews[0].cardJson = JSON.stringify(c) }, /cardJson.*state/],
    [r => { const c = JSON.parse(r.reviews[0].cardJson); c.stabilityFast = 'bad'; r.reviews[0].cardJson = JSON.stringify(c) }, /stabilityFast/],
    [r => { r.reviews[0].dueAt = '2028-11-09T04:00:00.000Z' }, /cardJson.*dueAt/],
    [r => { r.questions[0].options = 'bad' }, /questions.*options/],
    [r => { r.questions[0].answerIndex = 9 }, /questions.*answerIndex/],
    [r => { r.attempts[0].questionId = 1000 }, /attempts.*questionId/],
    [r => { r.attempts[0].answeredAt = 'invalid' }, /attempts.*answeredAt/],
    [r => { r.daily_stats[0].date = '2026-02-30' }, /daily_stats.*date/],
    [r => { r.examSessions = [{}] }, /examSessions/],
  ]
  for (const [mutate, expected] of mutations) {
    const invalid = structuredClone(valid)
    mutate(invalid)
    await assert.rejects(importBackupJSON(JSON.stringify(invalid), db), expected)
  }
  assert.deepEqual(await withoutTime(db), before)
  assert.equal(await exportRecoverySnapshot(db), undefined)
})

test('A: restore v1, retain a verified pre-restore snapshot, and roll back a failed write', async t => {
  const db = await seeded(t)
  const before = await withoutTime(db)
  const input = JSON.parse(await exportBackupJSON(db))
  input.vocab[0].zh = '新备份内容'
  input.formatVersion = 1
  input.dexieVersion = 3
  delete input.examSessions
  delete input.textbookProgress
  const text = JSON.stringify(input)
  const preview = await importBackupJSON(text, db)
  assert.equal(preview.counts.examSessions, 0)
  assert.equal((await db.vocab.get(4)).zh, '新备份内容')
  assert.ok((await db.reviews.get(7)).reviewedAt instanceof Date)
  const snapshot = await exportRecoverySnapshot(db)
  const { exportedAt: _exportedAt, ...snapshotRows } = JSON.parse(snapshot.json)
  assert.deepEqual(snapshotRows, before)
  const after = await withoutTime(db)
  const fail = () => { throw new Error('test injected attempt write failure') }
  db.attempts.hook('creating', fail)
  await assert.rejects(importBackupJSON(snapshot.json, db), /injected attempt write failure/)
  db.attempts.hook('creating').unsubscribe(fail)
  assert.deepEqual(await withoutTime(db), after)
  assert.deepEqual(await exportRecoverySnapshot(db), snapshot)
  await importBackupJSON(snapshot.json, db)
  assert.deepEqual(await withoutTime(db), before)
})

test('A: if current data or snapshot storage cannot be verified, restoration cannot begin', async t => {
  const db = await seeded(t)
  const valid = await exportBackupJSON(db)
  const before = await withoutTime(db)
  const fail = () => { throw new Error('test snapshot quota failure') }
  db.recoverySnapshots.hook('creating', fail)
  await assert.rejects(importBackupJSON(valid, db), /snapshot quota failure/)
  db.recoverySnapshots.hook('creating').unsubscribe(fail)
  assert.deepEqual(await withoutTime(db), before)
  await db.reviews.update(7, { cardJson: 'broken-existing-card' })
  await assert.rejects(importBackupJSON(valid, db), /cardJson/)
  assert.equal((await db.reviews.get(7)).cardJson, 'broken-existing-card')
})

test('B: same number across sections, duplicate import, conflict, and invalid fields', async t => {
  const db = isolated(t)
  const fixture = [question('听力'), question('阅读'), question('写作')]
  const [first, again] = await Promise.all([importBank(db, fixture), importBank(db, fixture)])
  assert.equal(first.questionsAdded + again.questionsAdded, 3)
  assert.equal(first.questionsSkipped + again.questionsSkipped, 3)
  assert.equal(await db.questions.count(), 3)
  const bad = await importBank(db, [
    { ...question('听力'), stem: '同题号不同内容' },
    { ...question('阅读', 2), options: null },
    { ...question('阅读', 2), options: [' '] },
    { ...question('阅读', 2), order: undefined },
    { ...question('阅读', 2), source: undefined },
    { ...question('阅读', 2), paperTitle: '不存在' },
    { ...question('阅读', 2), answerIndex: 5 },
  ])
  assert.equal(bad.questionsAdded, 0)
  assert.equal(bad.errors.length, 7)
  await assert.rejects(importQuestionBank('{"questions":42}', db), /必须是数组/)
  await assert.rejects(importQuestionBank('{', db), /JSON/)
  assert.equal(await db.questions.count(), 3)
  assert.equal(await db.papers.count(), 1)
})

function openV3(name) {
  const legacy = new Dexie(name)
  legacy.version(3).stores({
    vocab: '++id, ko, pos, source, source_level, yonsei_lesson, status, favorite',
    reviews: '++id, vocabId, reviewedAt, dueAt', daily_stats: '++id, date',
    questions: '++id, paperId, qtype, difficulty, status, source', papers: '++id, level, status, title',
    attempts: '++id, questionId, paperId, answeredAt, correct',
  })
  return legacy
}

test('legacy detached reviews are preserved through upgrade, export, and verified restore', async t => {
  const name = 'test-topik-v3-orphan-' + randomUUID()
  const legacy = openV3(name)
  const card = (await reviewSrsCard(await newSrsCard(when), '认识', when)).card
  const active = { id: 7, vocabId: vocab.id, reviewedAt: when, dueAt: new Date(card.dueAt), grade: '认识', cardJson: serializeCard(card) }
  const orphan = { ...active, id: 8, vocabId: 81 }
  await legacy.table('vocab').add(vocab)
  await legacy.table('reviews').bulkAdd([active, orphan])
  legacy.close()

  const db = isolated(t, name)
  assert.deepEqual(await db.reviews.toArray(), [active])
  assert.deepEqual((await db.archivedReviews.toArray()).map(row => row.review), [orphan])
  const v8 = JSON.parse(await exportBackupJSON(db))
  const { data } = parseBackupJSON(JSON.stringify(v8))
  assert.deepEqual(data.archivedReviews, [orphan])
  const { archivedReviews: _archive, ...ordinary } = v8
  const old = { ...ordinary, formatVersion: 1, dexieVersion: 3, reviews: [...ordinary.reviews, orphan] }
  const v6 = { ...ordinary, formatVersion: 6, dexieVersion: 8 }
  assert.throws(() => parseBackupJSON(JSON.stringify({ ...v6, reviews: old.reviews })), /reviews.*vocabId/)
  assert.throws(() => parseBackupJSON(JSON.stringify({ ...v8, archivedReviews: [{ ...orphan, cardJson: '{}' }] })), /archivedReviews.*cardJson/)

  await importBackupJSON(JSON.stringify(old), db)
  await importBackupJSON(JSON.stringify(v6), db)
  assert.deepEqual((await db.archivedReviews.toArray()).map(row => row.review), [orphan])
  const { data: snapshot } = parseBackupJSON((await exportRecoverySnapshot(db)).json)
  assert.deepEqual(snapshot.archivedReviews, [orphan])

  const fresh = isolated(t)
  const fail = () => { throw new Error('injected archive write failure') }
  fresh.archivedReviews.hook('creating', fail)
  await assert.rejects(importBackupJSON(JSON.stringify(v8), fresh), /injected archive write failure/)
  assert.equal(await fresh.reviews.count(), 0)
  assert.equal(await exportRecoverySnapshot(fresh), undefined)
  fresh.archivedReviews.hook('creating').unsubscribe(fail)
  await importBackupJSON(JSON.stringify(old), fresh)
  await importBackupJSON(JSON.stringify(v8), fresh)
  assert.deepEqual(await fresh.reviews.toArray(), [active])
  assert.deepEqual((await fresh.archivedReviews.toArray()).map(row => row.review), [orphan])
})

test('B: upgrade actual v3 stores without rekeying legacy questions or attempts', async t => {
  const name = 'test-topik-v3-' + randomUUID()
  const legacy = openV3(name)
  await legacy.table('papers').add({ ...paper, id: 51 })
  const { paperTitle: _, ...row } = question('听力')
  const old = { ...row, paperId: 51, id: 71, difficulty: '中', status: '待核实', answer: '', explanation: '', audio: '' }
  await legacy.table('questions').add(old)
  // A legacy unnumbered row is retained as-is.
  await legacy.table('questions').add({ ...old, id: 72, order: 0, stem: '旧版未编号题' })
  const attempt = { id: 91, questionId: 71, paperId: 51, answeredAt: when, selectedAnswer: '选项一', correct: true }
  await legacy.table('attempts').add(attempt)
  legacy.close()
  const db = isolated(t, name)
  await db.open()
  assert.equal(db.verno, 12)
  assert.deepEqual(await db.questions.get(71), old)
  assert.deepEqual(await db.attempts.get(91), attempt)
  assert.equal((await db.questions.get(72)).order, 0)
  const result = await importBank(db, [question('听力'), question('阅读')])
  assert.deepEqual([result.questionsAdded, result.questionsSkipped], [1, 1])
  assert.equal(await db.questions.where('[paperId+qtype+order]').equals([51, '阅读', 1]).count(), 1)
  assert.deepEqual(await db.attempts.get(91), attempt)
  assert.equal(parseBackupJSON(await exportBackupJSON(db)).preview.counts.attempts, 1)
})

test('import preview is read-only, matches committed rows, and does not leave accidental empty papers', async t => {
  const db = isolated(t)
  const emptyPaper = { ...paper, title: '无有效题的测试卷' }
  const json = JSON.stringify({
    papers: [paper, emptyPaper],
    questions: [
      question('听力'), question('阅读'), question('阅读'),
      { ...question('阅读'), stem: '同键题干冲突' },
      { ...question('写作'), paperTitle: emptyPaper.title, order: undefined },
    ],
  })
  const plan = await previewQuestionBankImport(json, db)
  assert.equal(plan.papersAdded, 1)
  assert.equal(plan.questionsAdded, 2)
  assert.deepEqual(plan.duplicateQuestionRows, [3])
  assert.deepEqual(plan.issues.map(issue => [issue.collection, issue.row, issue.kind, issue.field]), [
    ['questions', 5, 'invalid', 'order'],
    ['questions', 4, 'conflict', 'order'],
    ['papers', 2, 'empty-paper', undefined],
  ])
  assert.equal(await db.papers.count(), 0)
  assert.equal(await db.questions.count(), 0)
  assert.deepEqual(await importQuestionBank(json, db, plan), plan)
  assert.deepEqual((await db.papers.toArray()).map(row => row.title), [paper.title])
  const questions = await db.questions.toArray()
  assert.deepEqual(questions.map(q => [q.qtype, q.order]), [['听力', 1], ['阅读', 1]])
  assert.equal(questions[0].paperId, questions[1].paperId)

  const papersOnly = JSON.stringify({ papers: [emptyPaper] })
  const papersOnlyPlan = await previewQuestionBankImport(papersOnly, db)
  assert.equal(papersOnlyPlan.papersAdded, 1)
  await importQuestionBank(papersOnly, db, papersOnlyPlan)
  assert.equal(await db.papers.count(), 2)
})

test('import asks for a fresh confirmation after another import and rolls back a failed write', async t => {
  const db = isolated(t)
  const json = JSON.stringify({ papers: [paper], questions: [question('阅读'), question('写作')] })
  const initial = await previewQuestionBankImport(json, db)
  await importBank(db, [question('阅读')])
  let updated
  await assert.rejects(importQuestionBank(json, db, initial), err => {
    assert.ok(err instanceof QuestionBankPreviewChanged)
    updated = err.preview
    assert.deepEqual(updated.duplicateQuestionRows, [1])
    assert.equal(updated.questionsAdded, 1)
    return true
  })
  assert.equal(await db.questions.count(), 1)
  await importQuestionBank(json, db, updated)
  assert.equal(await db.questions.count(), 2)

  const rollbackPaper = { ...paper, title: '写入失败测试卷' }
  const rollback = JSON.stringify({ papers: [rollbackPaper], questions: [{ ...question('阅读'), paperTitle: rollbackPaper.title }] })
  const before = await previewQuestionBankImport(rollback, db)
  const fail = () => { throw new Error('test injected question write failure') }
  db.questions.hook('creating', fail)
  await assert.rejects(importQuestionBank(rollback, db, before), /injected question write failure/)
  db.questions.hook('creating').unsubscribe(fail)
  assert.equal(await db.papers.count(), 1)
  assert.equal(await db.questions.count(), 2)
  assert.deepEqual(await previewQuestionBankImport(rollback, db), before)
})

test('question favorites survive backup and repeated imports without affecting old questions or attempts', async t => {
  const db = await seeded(t)
  const oldBackup = await exportBackupJSON(db)
  const existing = await db.questions.orderBy('id').first()
  assert.equal(existing.favorite, undefined)
  assert.deepEqual(await getFavoriteQuestions(db), [])

  await setQuestionFavorite(existing.id, true, db)
  const repeat = await importBank(db, [question('阅读'), { ...question('阅读', 2), favorite: true }])
  assert.equal(repeat.questionsSkipped, 1)
  assert.equal(repeat.questionsAdded, 1)
  assert.deepEqual((await getFavoriteQuestions(db)).map(q => q.id), [existing.id])

  const destination = isolated(t)
  const backup = await exportBackupJSON(db)
  const corrupt = JSON.parse(backup)
  corrupt.questions[0].favorite = 'true'
  await assert.rejects(importBackupJSON(JSON.stringify(corrupt), destination), /questions.*favorite/)
  assert.equal(await destination.questions.count(), 0)
  await importBackupJSON(backup, destination)
  assert.deepEqual((await getFavoriteQuestions(destination)).map(q => q.id), [existing.id])
  assert.deepEqual(await destination.attempts.get(9), await db.attempts.get(9))

  await setQuestionFavorite(existing.id, false, destination)
  assert.deepEqual(await getFavoriteQuestions(destination), [])
  assert.equal((await destination.questions.get(existing.id)).favorite, false)
  assert.deepEqual(await destination.attempts.get(9), await db.attempts.get(9))
  await assert.rejects(setQuestionFavorite(9999, true, destination), /不在题库/)
  await importBackupJSON(oldBackup, destination)
  assert.equal((await destination.questions.get(existing.id)).favorite, undefined)
  assert.deepEqual(await getFavoriteQuestions(destination), [])
})

test('textbook upgrade adds an empty progress table and retains v4 learning data', async t => {
  const name = 'test-topik-v4-' + randomUUID()
  const old = new Dexie(name)
  old.version(4).stores({
    vocab: '++id, ko, pos, source, source_level, yonsei_lesson, status, favorite',
    reviews: '++id, vocabId, reviewedAt, dueAt', daily_stats: '++id, date',
    questions: '++id, paperId, qtype, difficulty, status, source, [paperId+qtype+order]',
    papers: '++id, level, status, title', attempts: '++id, questionId, paperId, answeredAt, correct',
    examSessions: 'id, status, updatedAt', recoverySnapshots: 'id',
  })
  const source = await seeded(t)
  await setQuestionFavorite(1, true, source)
  await startExam(1, duration, source, when.getTime())
  const { textbookProgress: _progress, ...backupV2 } = JSON.parse(await exportBackupJSON(source))
  const { vocab: words, reviews, daily_stats, papers, questions, attempts, examSessions } = backupV2
  const legacyJSON = JSON.stringify({ ...backupV2, formatVersion: 2, dexieVersion: 4 })
  const snapshot = { id: 'latest', createdAt: when.toISOString(), json: legacyJSON }
  await old.table('vocab').bulkAdd(words)
  await old.table('reviews').bulkAdd(reviews.map(row => ({ ...row, reviewedAt: new Date(row.reviewedAt), dueAt: new Date(row.dueAt) })))
  await old.table('daily_stats').bulkAdd(daily_stats)
  await old.table('papers').bulkAdd(papers)
  await old.table('questions').bulkAdd(questions)
  await old.table('attempts').bulkAdd(attempts.map(row => ({ ...row, answeredAt: new Date(row.answeredAt) })))
  await old.table('examSessions').bulkAdd(examSessions)
  await old.table('recoverySnapshots').put(snapshot)
  old.close()

  const db = isolated(t, name)
  assert.deepEqual(await getTextbookProgress(db), [])
  assert.equal(db.verno, 12)
  assert.deepEqual(await withoutTime(db), await withoutTime(source))
  assert.deepEqual(await exportRecoverySnapshot(db), snapshot)
})

test('textbook progress restores atomically and old backups preserve existing progress', async t => {
  const db = await seeded(t)
  const lesson = 'new-yonsei:6:20'
  await assert.rejects(setTextbookProgress('new-yonsei:6:21', 'completed', db), /课/)
  await assert.rejects(setTextbookProgress(lesson, 'invalid', db), /状态/)
  await setTextbookProgress(lesson, 'in-progress', db)
  await setTextbookProgress(lesson, 'completed', db)
  const progress = await getTextbookProgress(db)
  assert.deepEqual(progress.map(row => [row.id, row.status]), [[lesson, 'completed']])
  const completeBackup = JSON.parse(await exportBackupJSON(db))
  const { textbookProgress: _progress, ...legacy } = completeBackup
  legacy.formatVersion = 2
  legacy.dexieVersion = 4
  const preview = await importBackupJSON(JSON.stringify(legacy), db)
  assert.equal(preview.includesTextbookProgress, false)
  assert.deepEqual(await getTextbookProgress(db), progress)

  for (const mutate of [
    data => { data.textbookProgress[0].id = 'new-yonsei:7:1' },
    data => { data.textbookProgress.push(data.textbookProgress[0]) },
    data => { data.textbookProgress[0].status = 'not-started' },
    data => { data.textbookProgress[0].updatedAt = 'yesterday' },
    data => { delete data.textbookProgress },
  ]) {
    const invalid = structuredClone(completeBackup)
    mutate(invalid)
    await assert.rejects(importBackupJSON(JSON.stringify(invalid), db), /textbookProgress/)
  }
  assert.deepEqual(await getTextbookProgress(db), progress)

  const destination = await seeded(t)
  await setTextbookProgress('new-yonsei:1:1', 'in-progress', destination)
  const before = await withoutTime(destination)
  const fail = () => { throw new Error('test textbook write failure') }
  destination.textbookProgress.hook('creating', fail)
  await assert.rejects(importBackupJSON(JSON.stringify(completeBackup), destination), /test textbook write failure/)
  destination.textbookProgress.hook('creating').unsubscribe(fail)
  assert.deepEqual(await withoutTime(destination), before)
  assert.equal(await exportRecoverySnapshot(destination), undefined)

  const restored = await importBackupJSON(JSON.stringify(completeBackup), destination)
  assert.equal(restored.counts.textbookProgress, 1)
  assert.deepEqual(await getTextbookProgress(destination), progress)
  const safety = await exportRecoverySnapshot(destination)
  assert.deepEqual(JSON.parse(safety.json).textbookProgress, before.textbookProgress)
  await setTextbookProgress(lesson, 'not-started', destination)
  assert.deepEqual(await getTextbookProgress(destination), [])
})

test('personal resources support local editing and safe backup, including older files', async t => {
  const db = isolated(t)
  const before = JSON.parse(await exportBackupJSON(db))
  const { learningResources: _resources, ...legacy } = before
  await assert.rejects(saveLearningResource({ title: '无内容', url: '', note: '' }, undefined, db), /链接或笔记/)
  await assert.rejects(saveLearningResource({ title: '坏链接', url: 'javascript:alert(1)', note: '' }, undefined, db), /HTTP/)
  await saveLearningResource({ title: ' 笔记 ', url: '', note: '先查例句' }, undefined, db)
  const [resource] = await getLearningResources(db)
  assert.equal(resource.title, '笔记')
  await saveLearningResource({ title: '复习入口', url: 'https://www.topik.go.kr/', note: '核对公告' }, resource.id, db)
  const [edited] = await getLearningResources(db)
  assert.equal(edited.id, resource.id)
  const preview = await importBackupJSON(JSON.stringify({ ...legacy, formatVersion: 3, dexieVersion: 5 }), db)
  assert.equal(preview.includesLearningResources, false)
  assert.deepEqual(await getLearningResources(db), [edited])
  const json = await exportBackupJSON(db)
  const invalid = JSON.parse(json)
  invalid.learningResources[0].url = 'https://name:password@example.com'
  await assert.rejects(importBackupJSON(JSON.stringify(invalid), db), /learningResources/)
  assert.deepEqual(await getLearningResources(db), [edited])
  await deleteLearningResource(edited.id, db)
  assert.deepEqual(await getLearningResources(db), [])
  await importBackupJSON(json, db)
  assert.deepEqual(await getLearningResources(db), [edited])
})

test('study reminder follows local time, chosen weekdays, and preference validation', () => {
  const pref = { enabled: true, time: '19:00', schedule: 'mon-sat', dailyStudy: true, dueReviews: false }
  assert.equal(validReminderPreferences(pref), true)
  assert.equal(validReminderPreferences({ ...pref, time: '24:00' }), false)
  assert.equal(validReminderPreferences({ ...pref, dailyStudy: false }), false)
  assert.equal(isReminderTime(pref, new Date(2026, 10, 7, 18, 59)), false)
  assert.equal(isReminderTime(pref, new Date(2026, 10, 7, 19, 0)), true)
  assert.equal(isReminderTime(pref, new Date(2026, 10, 8, 22, 0)), false)
  assert.equal(isReminderTime({ ...pref, schedule: 'daily' }, new Date(2026, 10, 8, 22, 0)), true)
  assert.equal(isReminderTime({ ...pref, enabled: false }, new Date(2026, 10, 9, 22, 0)), false)
})

test('stage tests resume and preserve question snapshots, score only once, and restore from backup', async t => {
  const name = 'test-stage-' + randomUUID()
  const db = isolated(t, name)
  await importBank(db, [question('听力'), question('阅读'), question('写作')])
  const [run, parallel] = await Promise.all([
    startStageRun('yonsei-1-2', 1, db), startStageRun('yonsei-5-6', 1, db),
  ])
  assert.equal(run.id, parallel.id)
  assert.equal(run.questions.length, 2)
  await assert.rejects(saveStageAnswer(run.id, 0, 2, db), /答案无效/)
  await saveStageAnswer(run.id, 0, 0, db)
  await moveStageCursor(run.id, 1, db)
  db.close()
  const reopened = isolated(t, name)
  const [resumed] = await getStageRuns(reopened)
  assert.equal(resumed.cursor, 1)
  assert.deepEqual(resumed.answers, [0, null])
  await saveStageAnswer(run.id, 1, 1, reopened)
  await Promise.all([submitStageRun(run.id, reopened), submitStageRun(run.id, reopened)])
  const [done] = await getStageRuns(reopened)
  await saveStageAnswer(run.id, 1, 0, reopened)
  await discardStageRun(run.id, reopened)
  assert.deepEqual(await getStageRuns(reopened), [done])
  assert.deepEqual([scoreStageRun(done).correct, scoreStageRun(done).wrong], [1, 1])
  assert.equal(await reopened.attempts.count(), 0)
  await reopened.questions.clear()
  await reopened.papers.clear()
  const json = await exportBackupJSON(reopened)
  const destination = isolated(t)
  const bad = JSON.parse(json)
  bad.stageRuns[0].answers[0] = 900
  await assert.rejects(importBackupJSON(JSON.stringify(bad), destination), /stageRuns.*answers/)
  await importBackupJSON(json, destination)
  assert.deepEqual(await getStageRuns(destination), [done])
  const { stageRuns: _stageRuns, ...legacy } = JSON.parse(json)
  const preview = await importBackupJSON(JSON.stringify({ ...legacy, formatVersion: 4, dexieVersion: 6 }), destination)
  assert.equal(preview.includesStageRuns, false)
  assert.deepEqual(await getStageRuns(destination), [done])
})

test('grammar study and grading stay consistent across backup and concurrent writes', async t => {
  const db = isolated(t)
  const id = 'g1-1-01-01'
  await assert.rejects(setGrammarLearned('invalid', true, db), /语法点/)
  await Promise.all([setGrammarLearned(id, true, db), recordGrammarAnswer(id, true, db), recordGrammarAnswer(id, false, db)])
  const [stored] = await getGrammarStudy(db)
  assert.deepEqual([stored.learned, stored.attempts, stored.correct], [true, 2, 1])
  const raw = JSON.parse(await exportBackupJSON(db))
  const { grammarStudy: _study, ...legacy } = raw
  const preview = await importBackupJSON(JSON.stringify({ ...legacy, formatVersion: 5, dexieVersion: 7 }), db)
  assert.equal(preview.includesGrammarStudy, false)
  assert.deepEqual(await getGrammarStudy(db), [stored])
  const destination = isolated(t)
  const invalid = structuredClone(raw)
  invalid.grammarStudy[0].correct = 3
  await assert.rejects(importBackupJSON(JSON.stringify(invalid), destination), /grammarStudy.*state/)
  await importBackupJSON(JSON.stringify(raw), destination)
  assert.deepEqual(await getGrammarStudy(destination), [stored])
  await setGrammarLearned(id, false, destination)
  const [unmarked] = await getGrammarStudy(destination)
  assert.deepEqual([unmarked.learned, unmarked.attempts, unmarked.correct], [false, 2, 1])
})

test('grammar quiz skips missing meanings and alternate meanings of the same pattern', () => {
  const sample = (id, pattern, meaningZh) => ({ id, pattern, meaningZh })
  const target = sample('g1-1-01-01', 'pattern A', 'meaning A')
  const blank = sample('g1-1-01-02', 'pattern B', '')
  const quiz = buildGrammarQuiz([target, blank], [
    target, blank, sample('g1-1-01-03', 'pattern A', 'also A'),
    sample('g1-1-01-04', 'pattern C', 'meaning C'), sample('g1-1-01-05', 'pattern D', 'meaning D'),
    sample('g1-1-01-06', 'pattern E', 'meaning E'),
  ])
  assert.equal(quiz.length, 1)
  assert.equal(quiz[0].id, target.id)
  assert.deepEqual([...quiz[0].options].sort(), ['meaning A', 'meaning C', 'meaning D', 'meaning E'])
})

test('FSRS and daily stats roll back together, while concurrent focus completions count once', async t => {
  const db = isolated(t)
  await db.vocab.add(vocab)
  const fail = () => { throw new Error('test daily write failed') }
  db.daily_stats.hook('creating', fail)
  await assert.rejects(gradeCard(vocab.id, '认识', when, db), /daily write failed/)
  db.daily_stats.hook('creating').unsubscribe(fail)
  assert.equal(await db.reviews.count(), 0)
  assert.equal(await db.daily_stats.count(), 0)

  const day = localDateKey(when)
  const focus = { minutes: 25, focusSessionId: 'same-session' }
  await Promise.all([
    incrementDailyStat(day, focus, db), gradeCard(vocab.id, '认识', when, db),
    incrementDailyStat(day, focus, db), gradeCard(vocab.id, '不认识', when, db),
  ])
  const [stats] = await db.daily_stats.toArray()
  assert.deepEqual([stats.minutes, stats.reviewedWords, stats.correctCount], [25, 2, 1])
  assert.deepEqual(stats.focusSessionIds, ['same-session'])
  assert.equal(await db.daily_stats.count(), 1)
  const reviews = await db.reviews.toArray()
  assert.deepEqual(reviews.map(r => JSON.parse(r.cardJson).reps), [1, 2])
  assert.equal(parseBackupJSON(await exportBackupJSON(db)).preview.counts.reviews, 2)
})

test('goal progress counts local Monday through today with only objective practice attempts', async t => {
  const db = isolated(t)
  const local = day => new Date(2026, 10, day, 12)
  await db.vocab.bulkAdd([vocab, { ...vocab, id: 5, ko: '학생' }])
  await gradeCard(4, '认识', local(8), db)
  await gradeCard(4, '认识', local(9), db)
  await gradeCard(5, '认识', local(10), db)
  await incrementDailyStat(localDateKey(local(10)), { minutes: 20 }, db)
  await incrementDailyStat(localDateKey(local(11)), { minutes: 40 }, db)
  await importBank(db, [question('阅读'), question('写作')])
  const [reading, writing] = await db.questions.toArray()
  for (const day of [8, 9, 10, 11]) {
    await db.attempts.add({ questionId: reading.id, correct: true, selectedAnswer: reading.options[0], answeredAt: local(day) })
  }
  await db.attempts.add({ questionId: writing.id, correct: false, subjective: true, selectedAnswer: '답안', answeredAt: local(10) })
  const activity = await getStudyGoalActivity(local(10), db)
  assert.deepEqual([activity.startDate, activity.endDate], ['2026-11-09', '2026-11-15'])
  assert.deepEqual(activity.days.map(day => [day.date, day.newWords, day.practice]), [
    ['2026-11-09', 0, 1], ['2026-11-10', 1, 1],
  ])
  assert.deepEqual(activity.totals, { newWords: 1, reviews: 2, practice: 2, minutes: 20 })
})

test('calendar and daily activity use local dates and include only saved learning', async t => {
  const db = isolated(t)
  const local = (day, hour = 12) => new Date(2026, 10, day, hour)
  await db.vocab.add(vocab)
  await gradeCard(vocab.id, '认识', local(8), db)
  await gradeCard(vocab.id, '模糊', local(10, 8), db)
  await incrementDailyStat('2026-11-09', { minutes: 15 }, db)
  await incrementDailyStat('2026-11-12', { minutes: 0 }, db)
  await db.daily_stats.add({ date: '2026-11-12', newWords: 0, reviewedWords: 0, correctCount: 0, minutes: 99 })
  await importBank(db, [question('阅读'), question('写作')])
  const [reading, writing] = await db.questions.toArray()
  await db.attempts.add({ questionId: reading.id, correct: true, selectedAnswer: reading.options[0], answeredAt: local(10, 9) })
  await db.attempts.add({ questionId: writing.id, correct: false, subjective: true, selectedAnswer: 'private draft', answeredAt: local(10, 11) })
  await db.attempts.add({ questionId: reading.id, correct: false, selectedAnswer: reading.options[1], answeredAt: new Date(2026, 11, 1, 0) })
  const run = await startStageRun('yonsei-1-2', 1, db)
  await db.stageRuns.update(run.id, { startedAt: local(11, 13).toISOString(), finishedAt: local(11, 14).toISOString() })
  const cells = await getMonthCells(2026, 11, db)
  assert.equal(cells.length, 30)
  assert.deepEqual(cells.filter(cell => cell.studied).map(cell => cell.day), [8, 9, 10, 11])
  assert.equal(cells[7].isSunday, true)

  const activity = await getDayActivity('2026-11-10', db)
  assert.deepEqual([activity.summary.newWords, activity.summary.reviewedWords, activity.objectiveAnswers,
    activity.objectiveCorrect, activity.writingAnswers, activity.stageTests], [0, 1, 1, 1, 1, 0])
  assert.deepEqual(activity.events.map(event => event.kind), ['writing', 'objective', 'review'])
  assert.equal(JSON.stringify(activity).includes('private draft'), false)
  assert.equal((await getDayActivity('2026-11-09', db)).summary.minutes, 15)
  assert.equal((await getDayActivity('2026-11-11', db)).stageTests, 1)
  assert.deepEqual((await getDayActivity('2026-11-12', db)).events, [])
  assert.equal((await getDayActivity('2026-11-12', db)).summary.minutes, 0)
})

test('built-in seeds roll back both updates and inserts, and concurrent imports add each word once', async t => {
  const db = isolated(t)
  const nikl = JSON.parse(await readFile(new URL('../data/vocab-seed.json', import.meta.url), 'utf8'))
  assert.equal(nikl.length, 925)
  assert.ok(nikl.every(row => row.source === 'NIKL' && !row.yonsei_lesson && !row.zh && !row.example_ko && !row.example_zh))
  const original = { ...vocab, ko: '격리검증어', zh: '', favorite: true }
  await db.vocab.add(original)
  const seeds = async () => ({ nikl, yonsei: [{ ...original, zh: '隔离合并测试' }] })
  const fail = () => { throw new Error('seed write failed') }
  db.vocab.hook('creating', fail)
  await assert.rejects(loadSeedVocabulary(db, seeds), /seed write failed/)
  db.vocab.hook('creating').unsubscribe(fail)
  assert.deepEqual(await db.vocab.toArray(), [original])

  const results = await Promise.all([loadSeedVocabulary(db, seeds), loadSeedVocabulary(db, seeds)])
  assert.equal(results.reduce((total, result) => total + result.addedNikl + result.addedYonsei, 0), 925)
  assert.ok(results.every(result => result.totalAfter === 926))
  assert.equal((await db.vocab.get(original.id)).zh, '隔离合并测试')
  assert.equal((await db.vocab.get(original.id)).favorite, true)
  const words = await db.vocab.toArray()
  assert.equal(new Set(words.map(word => word.ko)).size, words.length)
})

test('C: reopen the database, resume exact cursor/draft/deadline, and commit each section once', async t => {
  const db = isolated(t)
  await importBank(db, [question('阅读'), question('阅读', 2), question('写作')])
  const p = await db.papers.orderBy('id').first()
  const now = when.getTime()
  const [exam, concurrent] = await Promise.all([startExam(p.id, duration, db, now), startExam(p.id, duration, db, now)])
  assert.equal(exam.id, concurrent.id)
  const [a, b] = exam.sections[0].questionIds
  await saveExamAnswer(exam.id, 0, a, { selected: 0 }, db, now + 1000)
  await saveExamAnswer(exam.id, 0, b, { selected: 1 }, db, now + 2000)
  await moveExamCursor(exam.id, 0, 1, db, now + 2100)
  db.close()
  const reopened = isolated(t, db.name)
  const resumed = await loadExam(reopened)
  assert.equal(resumed.questionIdx, 1)
  assert.equal(resumed.sectionEndAt, now + 60000)
  assert.deepEqual(resumed.answers[b], { selected: 1, enteredAt: now + 2000 })
  const first = await Promise.all([
    submitExamSection(exam.id, 0, reopened, now + 60001),
    submitExamSection(exam.id, 0, reopened, now + 60001),
  ])
  assert.deepEqual(first[0], first[1])
  assert.equal(first[0].sectionIdx, 1)
  assert.equal(await reopened.attempts.count(), 2)
  await assert.rejects(saveExamAnswer(exam.id, 0, a, { selected: 0 }, reopened, now + 60002), /已变化/)
  const [writing] = first[0].sections[1].questionIds
  await saveExamAnswer(exam.id, 1, writing, { text: '한글 초안', seconds: 2 }, reopened, now + 62000)
  const backup = await exportBackupJSON(reopened)
  const secondDevice = isolated(t)
  await importBackupJSON(backup, secondDevice)
  assert.equal((await loadExam(secondDevice)).answers[writing].text, '한글 초안')
  assert.equal(await secondDevice.attempts.count(), 2)
  const ended = await submitExamSection(exam.id, 1, reopened, now + 63000)
  await submitExamSection(exam.id, 1, reopened, now + 63001)
  assert.equal(ended.status, 'done')
  assert.equal(await reopened.attempts.count(), 3)
  assert.equal((await loadExam(reopened)).summaries.length, 2)
  assert.equal((await loadExam(secondDevice)).status, 'running')
  assert.equal(parseBackupJSON(await exportBackupJSON(reopened)).preview.counts.examSessions, 1)
})

test('C: timed-out writes are refused and failed section commit preserves all drafts and attempts', async t => {
  const db = isolated(t)
  await importBank(db, [question('阅读'), question('阅读', 2)])
  const p = await db.papers.orderBy('id').first()
  const now = when.getTime()
  const exam = await startExam(p.id, duration, db, now)
  const [q, q2] = exam.sections[0].questionIds
  await saveExamAnswer(exam.id, 0, q, { selected: 0 }, db, now + 1000)
  await saveExamAnswer(exam.id, 0, q2, { selected: 1 }, db, now + 2000)
  await assert.rejects(saveExamAnswer(exam.id, 0, q, { selected: 1 }, db, now + 60000), /已结束/)
  const fail = (_, row) => { if (row.questionId === q2) throw new Error('test injected partial failure') }
  db.attempts.hook('creating', fail)
  await assert.rejects(submitExamSection(exam.id, 0, db, now + 60001), /partial failure/)
  assert.equal(await db.attempts.count(), 0)
  assert.deepEqual((await loadExam(db)).answers, { [q]: { selected: 0, enteredAt: now + 1000 }, [q2]: { selected: 1, enteredAt: now + 2000 } })
  assert.equal((await loadExam(db)).status, 'running')
  db.attempts.hook('creating').unsubscribe(fail)
  await submitExamSection(exam.id, 0, db, now + 61000)
  assert.equal(await db.attempts.count(), 2)
})

test('long PBT II crosses midnight, catches up expired sections and commits each score once', async t => {
  const db = isolated(t)
  await importBank(db, [question('听力'), question('写作'), question('阅读'),
    { ...question('听力', 2), status: '待核实' }])
  const { id } = await db.papers.toCollection().first()
  const minute = 60_000
  const now = Date.parse('2026-11-09T23:30:00+08:00')
  const session = await startExam(id, duration, db, now, { mode: 'pbt-ii' })
  assert.deepEqual(session.sections.map(s => [s.key, s.minutes]), [['listening', 60], ['writing', 50], ['reading', 70]])
  await assert.rejects(setExamPaused(session.id, 0, true, now, db), /单科/)
  const [verified, unverified] = session.sections[0].questionIds
  await saveExamAnswer(session.id, 0, verified, { selected: 0 }, db, now + 31 * minute)
  await saveExamAnswer(session.id, 0, unverified, { selected: 1 }, db, now + 40 * minute)
  const resumed = await submitExpiredExam(await loadExam(db), now + 75 * minute, db)
  assert.equal(resumed.sectionIdx, 1)
  assert.equal(resumed.sectionStartedAt, now + 60 * minute)
  assert.equal(resumed.sectionEndAt, now + 110 * minute)
  const [writing] = resumed.sections[1].questionIds
  await saveExamAnswer(session.id, 1, writing, { text: '새로운 답안입니다.', seconds: 25 }, db, now + 76 * minute)
  await saveExamAnswer(session.id, 1, writing, { text: '이전 답안입니다.', seconds: 24 }, db, now + 75 * minute)
  const before = await loadExam(db)
  assert.equal(before.answers[writing].text, '새로운 답안입니다.')
  const finish = now + 181 * minute
  const results = await Promise.all([submitExpiredExam(before, finish, db), submitExpiredExam(before, finish, db)])
  assert.deepEqual(results[0], results[1])
  assert.equal(results[0].status, 'done')
  assert.deepEqual(results[0].summaries.map(s => s.seconds), [3600, 3000, 4200])
  assert.equal(results[0].grades[unverified], 'excluded')
  const attempts = await db.attempts.toArray()
  assert.deepEqual(attempts.map(row => [row.questionId, +row.answeredAt]), [
    [verified, now + 60 * minute], [writing, now + 110 * minute],
  ])
  const restored = isolated(t)
  const backup = await exportBackupJSON(db)
  await importBackupJSON(backup, restored)
  assert.deepEqual(await getExamHistory(restored), [results[0]])
  const tampered = JSON.parse(backup)
  tampered.examSessions[0].grades['999999'] = 'correct'
  await assert.rejects(importBackupJSON(JSON.stringify(tampered), restored), /grades/)
  assert.deepEqual(await getExamHistory(restored), [results[0]])
})

test('PBT I uses fixed times, missing subjects reject, and only single-subject practice can pause', async t => {
  const db = isolated(t)
  await importBank(db, [question('听力'), question('阅读')])
  const { id } = await db.papers.toCollection().first()
  const now = +when
  await assert.rejects(startExam(id, duration, db, now, { mode: 'pbt-ii' }), /缺少写作/)
  const pbt = await startExam(id, duration, db, now, { mode: 'pbt-i' })
  assert.deepEqual(pbt.sections.map(s => s.minutes), [40, 60])
  await submitExpiredExam(pbt, now + 6_000_000, db)
  const start = now + 6_000_001
  const session = await startExam(id, duration, db, start, { mode: 'practice', scope: 'reading' })
  const [qid] = session.sections[0].questionIds
  const paused = await setExamPaused(session.id, 0, true, start + 30_000, db)
  await assert.rejects(saveExamAnswer(session.id, 0, qid, { selected: 0 }, db, start + 31_000), /已暂停/)
  assert.deepEqual(await submitExpiredExam(paused, start + 300_000, db), paused)
  const restore = isolated(t)
  await importBackupJSON(await exportBackupJSON(db), restore)
  assert.deepEqual(await loadExam(restore), paused)
  const resume = await setExamPaused(session.id, 0, false, start + 300_000, restore)
  assert.equal(resume.sectionEndAt, start + 330_000)
  await saveExamAnswer(session.id, 0, qid, { selected: 0 }, restore, start + 325_000)
  assert.equal((await submitExpiredExam(await loadExam(restore), start + 330_000, restore)).summaries[0].seconds, 60)
})

test('wall-clock rollback does not extend a running exam within a page or before a persisted checkpoint', async t => {
  const db = isolated(t)
  await importBank(db, [question('阅读')])
  const { id } = await db.papers.toCollection().first()
  let wall = +when
  let monotonic = 10
  const read = createExamClock(() => wall, () => monotonic)
  const session = await startExam(id, duration, db, read(), { mode: 'practice' })
  monotonic += 30_000
  wall += 30_000
  await checkpointExam(session.id, 0, read(), db)
  wall -= 45_000
  const reopened = createExamClock(() => wall, () => monotonic)
  assert.equal(reopened((await loadExam(db)).updatedAt), +when + 30_000)
  monotonic += 15_000
  assert.equal(reopened(), +when + 45_000)
  wall += 120_000
  assert.equal((await submitExpiredExam(await loadExam(db), reopened(), db)).status, 'done')
})

test('v10 backup without long-exam fields restores; failed timed submission can retry without losing answers', async t => {
  const db = isolated(t)
  await importBank(db, [question('阅读')])
  const { id } = await db.papers.toCollection().first()
  const now = +when
  const session = await startExam(id, duration, db, now)
  const [qid] = session.sections[0].questionIds
  await saveExamAnswer(session.id, 0, qid, { selected: 0 }, db, now + 1)
  const legacy = JSON.parse(await exportBackupJSON(db))
  legacy.formatVersion = 10
  delete legacy.examSessions[0].answers[qid].enteredAt
  const restored = isolated(t)
  await importBackupJSON(JSON.stringify(legacy), restored)
  const saved = await loadExam(restored)
  assert.deepEqual(saved, legacy.examSessions[0])
  const fail = () => { throw new Error('mock attempt write failed') }
  restored.attempts.hook('creating', fail)
  await assert.rejects(submitExpiredExam(saved, now + 60000, restored), /write failed/)
  assert.deepEqual(await loadExam(restored), saved)
  assert.equal(await restored.attempts.count(), 0)
  restored.attempts.hook('creating').unsubscribe(fail)
  assert.equal((await submitExpiredExam(saved, now + 60000, restored)).status, 'done')
  assert.equal(await restored.attempts.count(), 1)
})
test('TOPIK I and II IBT use the current official times and preserve their profiles in backups', async t => {
  const db = isolated(t)
  await importBank(db, [question('听力'), question('阅读'), question('写作')])
  const { id } = await db.papers.toCollection().first()
  const now = +when
  const first = await startExam(id, duration, db, now, { mode: 'ibt-i' })
  assert.deepEqual(first.sections.map(s => [s.key, s.minutes]), [['listening', 30], ['reading', 40]])
  await submitExpiredExam(first, now + 70 * 60_000, db)
  const second = await startExam(id, duration, db, now + 70 * 60_000, { mode: 'ibt-ii' })
  assert.deepEqual(second.sections.map(s => [s.key, s.minutes]), [['listening', 35], ['writing', 50], ['reading', 40]])
  const restored = isolated(t)
  await importBackupJSON(await exportBackupJSON(db), restored)
  assert.deepEqual(await loadExam(restored), second)
  assert.equal((await getExamHistory(restored))[0].mode, 'ibt-i')
})
test('statistics reconcile raw events across month and year, late mock completion, and focus retries', async t => {
  const db = isolated(t)
  const before = new Date(2026, 11, 31, 23, 59)
  const after = new Date(2027, 0, 1, 0, 1)
  const reopen = new Date(2027, 0, 2, 9)
  const oldDay = '2026-12-31'
  const newDay = '2027-01-01'
  await db.vocab.bulkAdd([vocab, { ...vocab, id: 8, ko: '테스트', isTestData: true }])
  await gradeCard(vocab.id, '认识', before, db)
  await gradeCard(vocab.id, '模糊', after, db)
  await gradeCard(vocab.id, '很熟', new Date(+after + 60_000), db)
  const row = (await db.reviews.toArray())[0]
  await db.archivedReviews.add({ review: { ...row, vocabId: 999 } })
  await db.reviews.bulkAdd([{ ...row, id: undefined, vocabId: 8 }, { ...row, id: undefined, vocabId: 999 }])
  assert.equal(await countDue(new Date(2027, 0, 1, 0, 3), db), 0)

  await importBank(db, [question('阅读'), { ...question('阅读', 2), status: '待核实' }, question('写作')])
  const [verified, unverified, writing] = await db.questions.toArray()
  const original = { questionId: verified.id, selectedAnswer: '选项二', correct: false }
  await db.attempts.bulkAdd([
    { ...original, answeredAt: before },
    { ...original, questionId: unverified.id, correct: true, answeredAt: after },
    { ...original, questionId: verified.id, correct: true, answeredAt: '2027-01-01' },
  ])
  await db.questions.update(verified.id, { favorite: true })
  await saveWritingDraft({ questionId: writing.id, revision: 1, token: 'unfinished', text: '초안', seconds: 1,
    updatedAt: after.toISOString() }, db)
  await db.attempts.add({ questionId: writing.id, selectedAnswer: '완성본', correct: false, subjective: true,
    answeredAt: before, writingAssessment: { checks: [], note: 'private', updatedAt: after.toISOString() } })
  const session = await startExam(verified.paperId, { ...duration, reading: 2 }, db, +before, { mode: 'practice', scope: 'reading' })
  await saveExamAnswer(session.id, 0, verified.id, { selected: 0 }, db, +before + 20_000)
  await Promise.all([submitExpiredExam(session, +reopen, db), submitExpiredExam(session, +reopen, db)])
  await incrementDailyStat(newDay, { minutes: 20, focusSessionId: 'midnight-focus' }, db)
  const retry = await incrementDailyStat('2027-01-02', { minutes: 20, focusSessionId: 'midnight-focus' }, db)
  assert.equal(retry.date, newDay)
  await db.daily_stats.add({ date: newDay, newWords: 99, reviewedWords: 99, correctCount: 99, minutes: 99 })
  const beforeProjection = await db.attempts.toArray()
  const home = await getStudyOverview(newDay, db)
  const stats = await getStatsOverview(newDay, newDay, db)
  const daily = await buildDailyExport(newDay, db)
  assert.deepEqual(home.day, stats.week.days.at(-1))
  assert.deepEqual(home.day, stats.activity.summary)
  assert.deepEqual(home.day, daily.day)
  assert.deepEqual(home.day, await getDayStats(newDay, db))
  assert.equal(stats.streak, home.streak)
  assert.equal(home.streak, 2)
  assert.equal(stats.week.distinctReviewedWords, 1)
  for (const [key, value] of Object.entries({
    newWords: 0, reviewedWords: 2, distinctReviewedWords: 1, objectiveAnswers: 2, objectiveScored: 1,
    objectiveCorrect: 1, corrections: 1, mockExams: 1, writingAnswers: 0, writingAssessments: 1, minutes: 20,
  })) assert.equal(home.day[key], value, key)
  assert.equal(stats.month[0].studied, true)
  assert.equal(stats.month[1].studied, false)
  const previous = await getDayActivity(oldDay, db)
  assert.equal(previous.summary.newWords, 1)
  assert.equal(previous.summary.wrongAnswers, 1)
  assert.equal(previous.summary.writingQuestionsCompleted, 1)
  assert.equal(previous.summary.mockExams, 0)
  assert.equal(daily.audit.undatedEvents, 1)
  assert.equal(daily.audit.ignoredReviews, 2)
  assert.equal(daily.audit.duplicateDailyRows, 1)
  assert.equal(JSON.stringify(daily).includes('private'), false)
  assert.deepEqual(await db.attempts.toArray(), beforeProjection)
  assert.equal(beforeProjection.filter(attempt => +attempt.answeredAt === +after && attempt.correct).length, 2)
  assert.equal(await db.examSessions.where('status').equals('done').count(), 1)
})

test('time-zone projection moves an event once and handles both daylight-saving transitions', async t => {
  const oldZone = process.env.TZ
  try {
    process.env.TZ = 'America/New_York'
    const db = isolated(t)
    await importBank(db, [question('阅读')])
    const q = await db.questions.toCollection().first()
    const events = [
      '2026-03-08T04:59:59Z', '2026-03-08T05:00:00Z', '2026-03-08T07:00:00Z', '2026-03-09T04:00:00Z',
      '2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z', '2026-11-02T04:59:59Z',
    ]
    await db.attempts.bulkAdd(events.map(time => ({ questionId: q.id, correct: true, selectedAnswer: q.options[0], answeredAt: new Date(time) })))
    await incrementDailyStat('2026-03-07', { minutes: 12, focusSessionId: 'dst-focus' }, db)
    for (const [date, total] of [['2026-03-07', 1], ['2026-03-08', 2], ['2026-03-09', 1], ['2026-11-01', 3], ['2026-11-02', 0]]) {
      assert.equal((await getDayStats(date, db)).objectiveAnswers, total, date)
    }
    process.env.TZ = 'Asia/Shanghai'
    assert.equal((await getDayStats('2026-03-07', db)).objectiveAnswers, 0)
    assert.equal((await getDayStats('2026-03-07', db)).minutes, 12)
    assert.equal((await getDayStats('2026-03-08', db)).objectiveAnswers, 3)
    assert.equal((await getDayStats('2026-11-01', db)).objectiveAnswers, 2)
    assert.equal((await getDayStats('2026-11-02', db)).objectiveAnswers, 1)
    assert.equal(await db.attempts.count(), events.length)
  } finally {
    if (oldZone === undefined) delete process.env.TZ
    else process.env.TZ = oldZone
  }
})
