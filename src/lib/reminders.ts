export interface ReminderPreferences {
  enabled: boolean
  time: string
  schedule: 'daily' | 'mon-sat'
  dailyStudy: boolean
  dueReviews: boolean
}

export const REMINDER_KEY = 'topik-master-reminder-preferences'
export const REMINDER_DISMISS_KEY = 'topik-master-reminder-dismissed'
const DEFAULTS: ReminderPreferences = {
  enabled: false, time: '19:00', schedule: 'mon-sat', dailyStudy: true, dueReviews: true,
}

export function validReminderPreferences(value: unknown): value is ReminderPreferences {
  if (!value || typeof value !== 'object') return false
  const pref = value as Partial<ReminderPreferences>
  return typeof pref.enabled === 'boolean' && typeof pref.time === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(pref.time) &&
    (pref.schedule === 'daily' || pref.schedule === 'mon-sat') &&
    typeof pref.dailyStudy === 'boolean' && typeof pref.dueReviews === 'boolean' &&
    (!pref.enabled || pref.dailyStudy || pref.dueReviews)
}

export function loadReminderPreferences(): ReminderPreferences {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(REMINDER_KEY) ?? 'null')
    if (validReminderPreferences(raw)) return raw
  } catch {
    // A disabled reminder is the default when storage cannot be read.
  }
  return { ...DEFAULTS }
}

export function saveReminderPreferences(pref: ReminderPreferences): void {
  if (!validReminderPreferences(pref)) throw new Error('请填写有效的提醒时间，并至少选择一项提醒内容。')
  localStorage.setItem(REMINDER_KEY, JSON.stringify(pref))
}

export function isReminderTime(pref: ReminderPreferences, now: Date): boolean {
  if (!pref.enabled || (pref.schedule === 'mon-sat' && now.getDay() === 0)) return false
  const [hour, minute] = pref.time.split(':').map(Number)
  return now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute
}
