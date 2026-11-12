export const PERSONAL_PLAN_KEY = 'topik-master-personal-plan-v1'

export const GOALS = {
  beginner: '零基础入门',
  daily: '日常韩语',
  topik: 'TOPIK II 备考',
} as const

export const LEVELS = {
  new: '刚开始学韩语',
  basic: '会读韩文，学过基础词句',
  intermediate: '能读简单文章，想继续提高',
} as const

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const

const LESSONS = {
  letters: { name: '韩文入门词汇', href: '#/vocab' },
  words: { name: '学习新词', href: '#/vocab' },
  review: { name: '复习词汇', href: '#/review' },
  grammar: { name: '语法与例句', href: '#/grammar' },
  listening: { name: '听力练习', href: '#/practice?qtype=听力' },
  reading: { name: '阅读篇章', href: '#/reading' },
  writing: { name: '写作练习', href: '#/writing' },
  mock: { name: '单科模考', href: '#/mock' },
} as const

type Lesson = keyof typeof LESSONS
type Goal = keyof typeof GOALS
type Level = keyof typeof LEVELS

export interface PlanSettings {
  goal: Goal
  level: Level
  minutes: number
  weekdays: number[]
  note: string
  examDate: string
  targetLevel: string
}

export interface PlanTask {
  id: string
  lesson: Lesson
  date: string
  minutes: number
}

export interface PersonalPlan {
  settings: PlanSettings
  startsOn: string
  completed: PlanTask[]
  moved: PlanTask[]
}

export const DEFAULT_SETTINGS: PlanSettings = {
  goal: 'beginner', level: 'new', minutes: 20, weekdays: [0, 1, 2, 3, 4],
  note: '', examDate: '', targetLevel: '4',
}

const DAY = 86_400_000

export function dateLabel(date: string) {
  const [, month, day] = date.split('-').map(Number)
  return month + '月' + day + '日'
}

export function daysTo(date: string, today: string) {
  return (Date.parse(date) - Date.parse(today)) / DAY
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

export function validSettings(value: unknown): value is PlanSettings {
  if (!value || typeof value !== 'object') return false
  const s = value as PlanSettings
  return Object.hasOwn(GOALS, s.goal) && Object.hasOwn(LEVELS, s.level) &&
    Number.isInteger(s.minutes) && s.minutes >= 10 && s.minutes <= 120 &&
    Array.isArray(s.weekdays) && s.weekdays.length > 0 && s.weekdays.length <= 7 &&
    s.weekdays.every(day => Number.isInteger(day) && day >= 0 && day <= 6) &&
    new Set(s.weekdays).size === s.weekdays.length &&
    typeof s.note === 'string' && s.note.length <= 60 &&
    (s.examDate === '' || validDate(s.examDate)) && ['3', '4', '5', '6'].includes(s.targetLevel)
}

function validTask(task: unknown): task is PlanTask {
  if (!task || typeof task !== 'object') return false
  const t = task as PlanTask
  return typeof t.id === 'string' && validDate(t.date) && Object.hasOwn(LESSONS, t.lesson) &&
    Number.isInteger(t.minutes) && t.minutes >= 1 && t.minutes <= 120
}

export function loadPersonalPlan(): PersonalPlan | undefined {
  const stored: unknown = JSON.parse(localStorage.getItem(PERSONAL_PLAN_KEY) ?? 'null')
  if (stored === null) return undefined
  const plan = stored as PersonalPlan
  if (!validSettings(plan.settings) || !validDate(plan.startsOn) ||
      !Array.isArray(plan.completed) || !plan.completed.every(validTask) ||
      !Array.isArray(plan.moved) || !plan.moved.every(validTask)) {
    throw new Error('无法读取已保存的学习计划。')
  }
  return plan
}

export function storePersonalPlan(plan: PersonalPlan) {
  localStorage.setItem(PERSONAL_PLAN_KEY, JSON.stringify(plan))
}

export function lessonDetails(lesson: Lesson) { return LESSONS[lesson] }

export function goalLabel(settings: PlanSettings) {
  if (settings.goal === 'topik') return GOALS.topik + ' · 目标 ' + settings.targetLevel + ' 级'
  return settings.note.trim() || GOALS[settings.goal]
}

const ROTATIONS: Record<Goal, Lesson[][]> = {
  beginner: [['letters', 'review', 'grammar'], ['letters', 'grammar', 'review']],
  daily: [['words', 'listening', 'review'], ['grammar', 'reading', 'review'], ['listening', 'writing', 'words']],
  topik: [['reading', 'grammar', 'review'], ['listening', 'words', 'review'], ['writing', 'reading', 'review'], ['mock', 'words', 'review']],
}

export function weekDates(today: string) {
  const start = Date.parse(today)
  const weekday = (new Date(start).getUTCDay() + 6) % 7
  return WEEKDAYS.map((label, index) => ({
    label, date: new Date(start + (index - weekday) * DAY).toISOString().slice(0, 10),
  }))
}

export function scheduledWeek(settings: PlanSettings, today: string) {
  let lessonDay = 0
  return weekDates(today).map((day, index) => {
    if (!settings.weekdays.includes(index)) return { ...day, tasks: [] as PlanTask[] }
    const rotation = ROTATIONS[settings.goal]
    let lessons = rotation[lessonDay++ % rotation.length]
    if (settings.goal !== 'beginner' && settings.level === 'new') {
      lessons = lessons.map(lesson => lesson === 'mock' || lesson === 'writing' ? 'grammar' : lesson)
    }
    if (settings.goal === 'beginner' && settings.level === 'intermediate') {
      lessons = lessons.map(lesson => lesson === 'letters' ? 'reading' : lesson)
    }
    const count = settings.minutes < 20 ? 2 : 3
    const share = Math.floor(settings.minutes / count)
    const tasks = lessons.slice(0, count).map((lesson, slot) => ({
      id: day.date + ':' + slot + ':' + lesson, lesson, date: day.date,
      minutes: share + (slot === 0 ? settings.minutes % count : 0),
    }))
    return { ...day, tasks }
  })
}

export function planWeek(plan: PersonalPlan, today: string) {
  const moved = new Set(plan.moved.map(task => task.id))
  const completed = new Map(plan.completed.map(task => [task.id, task]))
  return scheduledWeek(plan.settings, today).map(day => {
    const tasks = (day.date < plan.startsOn ? [] : day.tasks)
      .filter(task => !moved.has(task.id))
      .map(task => completed.get(task.id) ?? task)
    const present = new Set(tasks.map(task => task.id))
    for (const task of [...plan.moved, ...plan.completed]) {
      if (task.date === day.date && !present.has(task.id)) {
        tasks.push(task)
        present.add(task.id)
      }
    }
    return { ...day, tasks, completed: tasks.filter(task => completed.has(task.id)).length }
  })
}

export function moveMissedTasks(plan: PersonalPlan, today: string) {
  const week = planWeek(plan, today)
  const done = new Set(plan.completed.map(task => task.id))
  const missed = week.filter(day => day.date < today).flatMap(day => day.tasks.filter(task => !done.has(task.id)))
  const remaining = week.filter((day, index) => day.date >= today && plan.settings.weekdays.includes(index))
  if (!missed.length || !remaining.length) return undefined
  const reassigned = new Map(plan.moved.map(task => [task.id, task]))
  missed.forEach((task, index) => reassigned.set(task.id, { ...task, date: remaining[index % remaining.length].date }))
  return { ...plan, moved: [...reassigned.values()] }
}
