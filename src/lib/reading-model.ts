import type { Question } from './db.ts'

export const READING_DIFFICULTIES = ['易', '中', '难'] as const
export const READING_SOURCES = ['原创练习', '教材', 'TOPIK 真题'] as const

export interface ReadingArticle {
  id: string
  title: string
  difficulty: typeof READING_DIFFICULTIES[number]
  sourceKind: typeof READING_SOURCES[number]
  source: string
  paragraphs: string[]
}

export interface ReadingPassage extends ReadingArticle {
  questionIds: number[]
  choices: Record<string, number>
  paragraph: number
  favorite: boolean
  finishedAt: string | null
}

export function readingBodyKey(paragraphs: readonly string[]): string {
  return paragraphs.join(' ').normalize('NFKC').replace(/\s+/gu, ' ').trim()
}

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
export function isReadingId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)
}

export function readArticle(value: unknown, path: string): ReadingArticle {
  const row = value as Partial<ReadingArticle> | null
  if (!row || !isReadingId(row.id) || !text(row.title) || !text(row.source) ||
    !row.difficulty || !READING_DIFFICULTIES.includes(row.difficulty) ||
    !row.sourceKind || !READING_SOURCES.includes(row.sourceKind) ||
    !Array.isArray(row.paragraphs) || !row.paragraphs.length || !row.paragraphs.every(text)) {
    throw new Error(`${path} 的标识、难度、来源或正文不完整`)
  }
  return { id: row.id, title: row.title.trim(), difficulty: row.difficulty, sourceKind: row.sourceKind,
    source: row.source.trim(), paragraphs: row.paragraphs.map(paragraph => paragraph.trim()) }
}

export function isScoredReadingQuestion(question: Question): boolean {
  return question.status === '已核实' && question.answerIndex !== null &&
    Number.isInteger(question.answerIndex) && question.answerIndex >= 0 && question.answerIndex < question.options.length &&
    !!question.explanation.trim()
}

export function readingHref(id: string): string {
  return `#/reading?passage=${encodeURIComponent(id)}`
}
