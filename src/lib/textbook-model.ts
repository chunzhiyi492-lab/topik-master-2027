export const TEXTBOOK_VOLUMES = [1, 2, 3, 4, 5, 6] as const
// Keep the existing numeric progress slots and backup identifiers.
export const TEXTBOOK_LESSON_NUMBERS = Array.from({ length: 20 }, (_, index) => index + 1)

export const TEXTBOOK_STATUS_LABELS = {
  'not-started': '未开始',
  'in-progress': '学习中',
  completed: '已完成',
} as const

export type TextbookStatus = keyof typeof TEXTBOOK_STATUS_LABELS

export interface TextbookProgress {
  id: string
  status: Exclude<TextbookStatus, 'not-started'>
  updatedAt: string
}

export function textbookLessonId(volume: number, lesson: number): string {
  return `new-yonsei:${volume}:${lesson}`
}

const lessonIds = new Set(TEXTBOOK_VOLUMES.flatMap(volume =>
  TEXTBOOK_LESSON_NUMBERS.map(lesson => textbookLessonId(volume, lesson)),
))

export function isTextbookLessonId(value: unknown): value is string {
  return typeof value === 'string' && lessonIds.has(value)
}
