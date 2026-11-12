import grammarNotes from '../../data/grammar-notes.json'

export interface GrammarPoint {
  id: string
  pattern: string
  stage: '初级' | '中级' | '高级'
  meaningZh: string
  usageZh: string
  exampleKo: string
  exampleZh: string
  sourceUrl: string
}

// Keep the eight existing IDs so previously saved records still resolve.
export const GRAMMAR_POINTS: GrammarPoint[] = Object.entries(grammarNotes).map(([id, note]) => ({
  id, ...note, stage: note.stage as GrammarPoint['stage'],
}))

export function matchesGrammar(point: GrammarPoint, keyword: string): boolean {
  const fields = [point.pattern, point.meaningZh, point.usageZh, point.exampleKo, point.exampleZh]
  const normalized = fields.join(' ').normalize('NFKC').toLowerCase()
  return keyword.normalize('NFKC').toLowerCase().trim().split(/\s+/u).every(term => normalized.includes(term))
}
