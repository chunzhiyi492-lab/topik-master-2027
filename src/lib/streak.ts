// TOPIK MASTER 2027 — 连续学习天数（P2，#20 规则的一部分）
// 纯函数，不依赖 IndexedDB，方便单独测试。
// 规则（2026-11-07 定）：周日休息不算断签——周日没学不中断连续天数，
// 周日学了照常计一天；其他日子没学则断签。
// 今天还没学时，从昨天开始往回数（今天未完成不算断签）。

/** 本地日期键 YYYY-MM-DD（用本地时区，不用 UTC）。 */
export function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 按“周日不算断签”算连续学习天数。
 * @param activityDateKeys 有学习活动的本地日期键集合（如复习记录的 reviewedAt 日期）。
 * @param today 今天（默认此刻）；只看日期部分。
 */
export function calcStreak(activityDateKeys: string[], today: Date = new Date()): number {
  const set = new Set(activityDateKeys)
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  // 今天还没学且今天不是周日：从昨天开始数。
  if (!set.has(localDateKey(day)) && day.getDay() !== 0) {
    day.setDate(day.getDate() - 1)
  }
  let streak = 0
  for (let i = 0; i < 3660; i++) {
    const key = localDateKey(day)
    if (set.has(key)) {
      streak += 1
    } else if (day.getDay() === 0) {
      // 周日休息：没学也不算断签，跳过不计数。
    } else {
      break
    }
    day.setDate(day.getDate() - 1)
  }
  return streak
}

/** A historic local date or time without an offset cannot locate an event unambiguously. */
export function studyEventDate(value: unknown): Date | undefined {
  const date = value instanceof Date ? value : typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? new Date(value) : undefined
  return date && Number.isFinite(+date) ? date : undefined
}
