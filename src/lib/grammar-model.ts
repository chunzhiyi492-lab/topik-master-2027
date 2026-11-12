import type { GrammarPoint } from './grammar-content'

export interface GrammarStudy {
  id: string
  learned: boolean
  attempts: number
  correct: number
  updatedAt: string
}

export interface GrammarQuizQuestion {
  id: string
  pattern: string
  meaning: string
  options: string[]
}

export function isGrammarPointId(id: unknown): id is string {
  return typeof id === 'string' && /^g[1-6]-[12]-\d{2}-\d{2}$/.test(id)
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const first = result[i]
    result[i] = result[j]
    result[j] = first
  }
  return result
}

type Definition = Pick<GrammarPoint, 'id' | 'pattern' | 'meaningZh'>
const meaningKey = (meaning: string) => meaning.trim().normalize('NFKC').replace(/\s+/gu, ' ')

export function buildGrammarQuiz(points: readonly Definition[], alternatives: readonly Definition[]): GrammarQuizQuestion[] {
  const distinct = new Map<string, string>()
  for (const point of alternatives) {
    const key = meaningKey(point.meaningZh)
    if (key && !distinct.has(key)) distinct.set(key, point.meaningZh.trim())
  }
  const quiz: GrammarQuizQuestion[] = []
  const patterns = new Set<string>()
  for (const point of shuffled(points)) {
    const meaning = point.meaningZh.trim()
    if (!meaning || patterns.has(point.pattern)) continue
    const otherMeanings = new Set(alternatives.filter(other => other.pattern === point.pattern).map(other => meaningKey(other.meaningZh)))
    otherMeanings.add(meaningKey(meaning))
    const wrong = shuffled([...distinct].filter(([key]) => !otherMeanings.has(key))).slice(0, 3).map(([, value]) => value)
    if (wrong.length < 3) continue
    patterns.add(point.pattern)
    quiz.push({ id: point.id, pattern: point.pattern, meaning, options: shuffled([meaning, ...wrong]) })
    if (quiz.length === 5) break
  }
  return quiz
}
