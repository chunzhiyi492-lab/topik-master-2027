export const SECTION_TYPES = { listening: '听力', reading: '阅读', writing: '写作' } as const
export type SectionKey = keyof typeof SECTION_TYPES

// NIIED TOPIK operating rules (2025-09-24), article 3.
export const EXAM_PROFILES = {
  'pbt-i': { label: 'TOPIK I PBT', sections: [
    { key: 'listening', minutes: 40, count: 30 }, { key: 'reading', minutes: 60, count: 40 },
  ] },
  'pbt-ii': { label: 'TOPIK II PBT', sections: [
    { key: 'listening', minutes: 60, count: 50 }, { key: 'writing', minutes: 50, count: 4 },
    { key: 'reading', minutes: 70, count: 50 },
  ] },
  'ibt-i': { label: 'TOPIK I IBT', sections: [
    { key: 'listening', minutes: 30, count: 26 }, { key: 'reading', minutes: 40, count: 26 },
  ] },
  'ibt-ii': { label: 'TOPIK II IBT', sections: [
    { key: 'listening', minutes: 35, count: 30 }, { key: 'writing', minutes: 50, count: 3 },
    { key: 'reading', minutes: 40, count: 30 },
  ] },
} as const
export type ExamMode = keyof typeof EXAM_PROFILES | 'practice'
export type ExamGrade = 'correct' | 'wrong' | 'unanswered' | 'excluded' | 'written' | 'unwritten'

export function canPauseExam(session: ExamSession): boolean {
  return session.mode === 'practice' && session.scope !== undefined
}

export function createExamClock(wall = Date.now, monotonic = () => performance.now()) {
  let time = 0
  let previous = monotonic()
  return (checkpoint = 0) => {
    const current = monotonic()
    time = Math.max(wall(), checkpoint, time + Math.max(0, current - previous))
    previous = current
    return Math.floor(time)
  }
}

export interface ExamSection {
  key: SectionKey
  minutes: number
  questionIds: number[]
}

export interface ExamAnswer {
  selected?: number
  text?: string
  seconds?: number
  enteredAt?: number
}

export interface SectionSummary {
  key: SectionKey
  label: string
  answered: number
  unanswered: number
  seconds: number
}

export interface ExamSession {
  id: string
  paperId: number
  status: 'running' | 'done'
  sections: ExamSection[]
  sectionIdx: number
  questionIdx: number
  sectionStartedAt: number
  sectionEndAt: number
  updatedAt: number
  answers: Record<string, ExamAnswer>
  summaries: SectionSummary[]
  otherCount: number
  mode?: ExamMode
  scope?: SectionKey
  pausedAt?: number
  grades?: Record<string, ExamGrade>
}
