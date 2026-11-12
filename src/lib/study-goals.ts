export const DAILY_TARGET_KEY = 'topik-master-p1-daily-target'
export const WEEKLY_TARGET_KEY = 'topik-master-weekly-targets'
export const DAILY_TARGET_MAX = 200

export const WEEKLY_METRICS = [
  { key: 'newWords', label: '新词', unit: '个', max: 1400, href: '#/vocab', action: '去背词' },
  { key: 'reviews', label: '复习评分', unit: '次', max: 5000, href: '#/review', action: '去复习' },
  { key: 'practice', label: '客观题作答', unit: '次', max: 5000, href: '#/practice', action: '去练习' },
  { key: 'minutes', label: '专注时长', unit: '分钟', max: 10080, href: '#/focus', action: '去专注' },
] as const

export type WeeklyMetric = typeof WEEKLY_METRICS[number]['key']
export type WeeklyTargets = Record<WeeklyMetric, number>
const EMPTY: WeeklyTargets = { newWords: 0, reviews: 0, practice: 0, minutes: 0 }

function within(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

export function loadDailyTarget(): number {
  try {
    const value = Number(localStorage.getItem(DAILY_TARGET_KEY))
    if (within(value, 1, DAILY_TARGET_MAX)) return value
  } catch { /* Keep the default if browser preferences are unavailable. */ }
  return 20
}

export function saveDailyTarget(value: number): void {
  if (!within(value, 1, DAILY_TARGET_MAX)) throw new Error('每日新词目标需为 1–200 个。')
  localStorage.setItem(DAILY_TARGET_KEY, String(value))
}

export function loadWeeklyTargets(): WeeklyTargets {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(WEEKLY_TARGET_KEY) ?? 'null')
    if (raw && typeof raw === 'object') {
      const values = raw as Partial<WeeklyTargets>
      const targets = { ...EMPTY }
      for (const { key, max } of WEEKLY_METRICS) {
        const value = values[key]
        if (within(value, 0, max)) targets[key] = value
      }
      return targets
    }
  } catch { /* Ignore unreadable preferences. */ }
  return { ...EMPTY }
}

export function saveWeeklyTargets(targets: WeeklyTargets): void {
  for (const { key, label, max } of WEEKLY_METRICS) {
    if (!within(targets[key], 0, max)) throw new Error(`${label}目标需为 0–${max} 的整数。`)
  }
  localStorage.setItem(WEEKLY_TARGET_KEY, JSON.stringify(targets))
}

export function calendarWeek(now: Date) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()
  const daysSinceMonday = (now.getDay() + 6) % 7
  return {
    start: new Date(year, month, day - daysSinceMonday),
    end: new Date(year, month, day - daysSinceMonday + 6),
    tomorrow: new Date(year, month, day + 1),
  }
}
