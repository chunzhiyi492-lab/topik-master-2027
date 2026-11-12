import type { QuestionType } from './db.ts'

export const STUDY_STAGES = {
  'yonsei-1-2': '第 1–2 册',
  'yonsei-3-4': '第 3–4 册',
  'yonsei-5-6': '第 5–6 册',
} as const

export type StudyStage = keyof typeof STUDY_STAGES
export const STAGE_MAX_QUESTIONS = 20

export interface StageQuestion {
  questionId: number
  qtype: QuestionType
  stem: string
  source: string
  options: string[]
  answerIndex: number
  explanation: string
  audio?: string
}

export interface StageRun {
  id: string
  stage: StudyStage
  paperTitle: string
  startedAt: string
  finishedAt?: string
  cursor: number
  questions: StageQuestion[]
  answers: (number | null)[]
}

export function isStudyStage(value: unknown): value is StudyStage {
  return typeof value === 'string' && Object.hasOwn(STUDY_STAGES, value)
}
