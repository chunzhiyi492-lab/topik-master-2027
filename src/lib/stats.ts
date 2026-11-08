// TOPIK MASTER 2027 — 学习统计聚合（P3：#21 学习统计面板、#20 打卡与日历）
// 只读聚合：全部数字都从库里已有的真实记录算出来，不编造。
// - 新词数：某天第一次打分的词数（按 reviews 表里每条词的最早复习日期算）。
//   注意：DailyStat.newWords 从来没人写过（gradeCard 只写复习数/答对数），
//   所以不读它，改从 reviews 表推导——这是真实记录，不是编造。
// - 复习数：当天复习记录条数；正确率：打“认识 / 很熟”的占比。
// - 学习分钟数：只取 DailyStat.minutes（P4 番茄钟写入后才有数），无记录就是 0，
//   P3 不编造、不伪造学习时长。
// - 打卡：有复习记录的日期即已学日期；周日显示休息、不记缺勤（见 streak.ts）。

import { getAllReviews, getDailyStat } from './db'
import { getStudyStreak } from './review'
import { localDateKey } from './streak'

export interface DayStats {
  date: string
  /** 当天第一次打分的词数（新词）。 */
  newWords: number
  /** 当天复习记录条数。 */
  reviewedWords: number
  /** 当天打“认识 / 很熟”的条数。 */
  correctCount: number
  /** 正确率 0–1；当天无复习记录时为 null（页面显示“暂无”）。 */
  accuracy: number | null
  /** 学习分钟数（只取 DailyStat.minutes，无记录为 0）。 */
  minutes: number
}

export interface WeekStats {
  days: DayStats[]
  newWords: number
  reviewedWords: number
  correctCount: number
  accuracy: number | null
  minutes: number
}

function toDateKey(d: Date): string {
  return localDateKey(d)
}

function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d + delta)
  return localDateKey(dt)
}

function emptyDay(date: string): DayStats {
  return { date, newWords: 0, reviewedWords: 0, correctCount: 0, accuracy: null, minutes: 0 }
}

/** 某一天的统计（date 为本地日期键 YYYY-MM-DD）。 */
export async function getDayStats(date: string): Promise<DayStats> {
  const [allReviews, daily] = await Promise.all([getAllReviews(), getDailyStat(date)])
  // 每条词的最早复习日期：最早那天算“新词”。
  const firstDate = new Map<number, string>()
  for (const r of allReviews) {
    const key = toDateKey(r.reviewedAt)
    const cur = firstDate.get(r.vocabId)
    if (!cur || key < cur) firstDate.set(r.vocabId, key)
  }
  const day = emptyDay(date)
  for (const [, key] of firstDate) {
    if (key === date) day.newWords += 1
  }
  for (const r of allReviews) {
    if (toDateKey(r.reviewedAt) !== date) continue
    day.reviewedWords += 1
    if (r.grade === '认识' || r.grade === '很熟') day.correctCount += 1
  }
  day.accuracy = day.reviewedWords > 0 ? day.correctCount / day.reviewedWords : null
  day.minutes = daily?.minutes ?? 0
  return day
}

/** 最近 7 天的统计（含 endDate 当天，默认到今天）。 */
export async function getWeekStats(endDate: string = localDateKey(new Date())): Promise<WeekStats> {
  const days: DayStats[] = []
  for (let i = 6; i >= 0; i--) {
    days.push(await getDayStats(addDays(endDate, -i)))
  }
  const reviewed = days.reduce((s, d) => s + d.reviewedWords, 0)
  const correct = days.reduce((s, d) => s + d.correctCount, 0)
  return {
    days,
    newWords: days.reduce((s, d) => s + d.newWords, 0),
    reviewedWords: reviewed,
    correctCount: correct,
    accuracy: reviewed > 0 ? correct / reviewed : null,
    minutes: days.reduce((s, d) => s + d.minutes, 0),
  }
}

/** 有学习活动的日期键（有复习记录的日期），供日历标“已学”。 */
export async function getStudiedDates(): Promise<string[]> {
  const all = await getAllReviews()
  return [...new Set(all.map((r) => toDateKey(r.reviewedAt)))].sort()
}

export interface MonthCell {
  /** 本地日期键 YYYY-MM-DD。 */
  date: string
  /** 当月第几天。 */
  day: number
  /** 是否周日（休息日）。 */
  isSunday: boolean
  /** 是否今天。 */
  isToday: boolean
  /** 当天是否学过（有复习记录）。 */
  studied: boolean
}

/** 某个月的日历格子（只含当月日期，页面自己补前面的空白格）。 */
export async function getMonthCells(year: number, month: number): Promise<MonthCell[]> {
  const studied = new Set(await getStudiedDates())
  const todayKey = localDateKey(new Date())
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: MonthCell[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d)
    const date = localDateKey(dt)
    cells.push({
      date,
      day: d,
      isSunday: dt.getDay() === 0,
      isToday: date === todayKey,
      studied: studied.has(date),
    })
  }
  return cells
}

/** 当日导出 JSON 的内容（页面负责下载成文件）。 */
export async function buildDailyExport(date: string): Promise<{
  app: string
  exportedAt: string
  date: string
  day: DayStats
  week: WeekStats
  streak: number
}> {
  const [day, week, streak] = await Promise.all([
    getDayStats(date),
    getWeekStats(date),
    getStudyStreak(),
  ])
  return {
    app: 'topik-master-2027',
    exportedAt: new Date().toISOString(),
    date,
    day,
    week,
    streak,
  }
}
