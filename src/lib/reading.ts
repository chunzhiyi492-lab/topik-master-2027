import { db, type Question, type TopikDB } from './db.ts'
import { isScoredReadingQuestion, readArticle, readingBodyKey, type ReadingPassage } from './reading-model.ts'

function parseReadingImport(json: string) {
  const input: unknown = JSON.parse(json)
  if (!Array.isArray(input) || !input.length) throw new Error('请提供含篇章的 JSON 数组')
  return input.map((value, i) => {
    const path = `第 ${i + 1} 篇`
    const article = readArticle(value, path)
    if (!Array.isArray(value.questions) || !value.questions.length) throw new Error(`${path} 至少需要一道题`)
    const questions: Omit<Question, 'id'>[] = value.questions.map((row: Partial<Question> | null, j: number) => {
      if (!row || row.order !== j + 1 || typeof row.stem !== 'string' || !row.stem.trim() ||
        !Array.isArray(row.options) || row.options.length < 2 || row.options.some(option => typeof option !== 'string' || !option.trim())) {
        throw new Error(`${path}第 ${j + 1} 题的题号、题干或选项无效`)
      }
      const options = row.options.map(option => option.trim())
      if (new Set(options).size !== options.length) throw new Error(`${path}第 ${j + 1} 题有重复选项`)
      if (row.answerIndex != null && (!Number.isInteger(row.answerIndex) || row.answerIndex < 0 || row.answerIndex >= options.length)) {
        throw new Error(`${path}第 ${j + 1} 题的答案越界`)
      }
      const explanation = typeof row.explanation === 'string' ? row.explanation.trim() : ''
      const question: Question = { stem: row.stem.trim(), options, explanation, answer: '', answerIndex: row.answerIndex ?? null,
        source: typeof row.source === 'string' ? row.source.trim() : '', status: row.status === '已核实' ? '已核实' : '待核实',
        qtype: '阅读', difficulty: article.difficulty, order: j + 1, readingId: article.id }
      return question.source && isScoredReadingQuestion(question) ? question : {
        ...question, source: question.source || article.source, status: '待核实', answerIndex: null, explanation: '',
      }
    })
    return { article, questions }
  })
}

export async function importReadingPassages(json: string, database: TopikDB = db): Promise<number> {
  const incoming = parseReadingImport(json)
  return database.transaction('rw', [database.readingPassages, database.questions], async () => {
    const existing = await database.readingPassages.toArray()
    const ids = new Set(existing.map(row => row.id))
    const bodies = new Set(existing.map(row => readingBodyKey(row.paragraphs)))
    for (const { article, questions } of incoming) {
      const body = readingBodyKey(article.paragraphs)
      if (ids.has(article.id) || bodies.has(body)) throw new Error(`篇章重复：${article.title}`)
      ids.add(article.id)
      bodies.add(body)
      const questionIds = await database.questions.bulkAdd(questions, { allKeys: true })
      await database.readingPassages.add({ ...article, questionIds, choices: {}, paragraph: 0, favorite: false, finishedAt: null })
    }
    return incoming.length
  })
}

export async function readPassage(id: string, database: TopikDB = db) {
  return database.transaction('r', [database.readingPassages, database.questions], async () => {
    const passage = await database.readingPassages.get(id)
    if (!passage) return undefined
    const questions = await database.questions.bulkGet(passage.questionIds)
    return { passage, questions: questions.filter((q): q is Question => q !== undefined) }
  })
}

export function saveReadingChoice(id: string, questionId: number, option: number, database: TopikDB = db) {
  return database.transaction('rw', [database.readingPassages, database.questions], async () => {
    const [passage, question] = await Promise.all([database.readingPassages.get(id), database.questions.get(questionId)])
    if (!passage || passage.finishedAt || !passage.questionIds.includes(questionId) || !question || question.readingId !== id ||
      !Number.isInteger(option) || option < 0 || option >= question.options.length) throw new Error('当前答案无法保存，请重新打开篇章')
    await database.readingPassages.update(id, { choices: { ...passage.choices, [questionId]: option } })
  })
}

export async function saveReadingPosition(id: string, paragraph: number, database: TopikDB = db) {
  await database.readingPassages.where(':id').equals(id).modify(row => {
    if (Number.isInteger(paragraph) && paragraph >= 0 && paragraph < row.paragraphs.length) row.paragraph = paragraph
  })
}

export async function submitReading(id: string, database: TopikDB = db, now = new Date()) {
  return database.transaction('rw', [database.readingPassages, database.questions, database.attempts], async () => {
    const passage = await database.readingPassages.get(id)
    if (!passage) throw new Error('篇章不存在')
    if (passage.finishedAt) return
    const questions = await database.questions.bulkGet(passage.questionIds)
    const attempts = []
    for (const question of questions) {
      if (!question?.id || question.readingId !== id) throw new Error('篇章题目关联不完整')
      if (!isScoredReadingQuestion(question)) continue
      const selected = passage.choices[question.id]
      const answer = question.options[selected]
      if (!answer) throw new Error('请先作答全部可评分题目')
      attempts.push({ questionId: question.id, selectedAnswer: answer, correct: selected === question.answerIndex, answeredAt: now })
    }
    if (!attempts.length) throw new Error('本篇暂没有可评分的题目')
    await database.attempts.bulkAdd(attempts)
    await database.readingPassages.update(id, { finishedAt: now.toISOString() })
  })
}

export function getReadingPassages(database: TopikDB = db): Promise<ReadingPassage[]> {
  return database.readingPassages.toArray()
}
