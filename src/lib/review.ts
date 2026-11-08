// TOPIK MASTER 2027 — 复习会话（P2：#2 FSRS 间隔复习卡片、#3 随机抽词、
// #7 词汇掌握度标记、#5 收藏与错词本）
// 只做会话逻辑：到期列表、打分、随机抽词、连续天数。
// FSRS 算法本身在 srs.ts（不动它）；表结构不动，不升 Dexie 版本。

import {
  addReview,
  getAllReviews,
  getAllVocab,
  getDailyStat,
  getLatestGradeMap,
  getLatestReviewByVocab,
  upsertDailyStat,
  type VocabEntry,
} from './db'
import {
  deserializeCard,
  newSrsCard,
  previewSrsCard,
  reviewSrsCard,
  serializeCard,
  type GradeLabel,
} from './srs'
import { calcStreak, localDateKey } from './streak'

export type { GradeLabel }

export const GRADES: GradeLabel[] = ['不认识', '模糊', '认识', '很熟']

export interface DueItem {
  vocab: VocabEntry
  /** 本次到期时间（新卡 = 现在）。 */
  dueAt: Date
  /** 从未复习过的卡。 */
  isNew: boolean
  /** 最新一次打分档位（新卡为 null）。 */
  lastGrade: string | null
}

/**
 * 到期列表：最新一次复习的 dueAt <= 现在的卡 + 从未复习过的新卡。
 * 排序：已到期的旧卡按 dueAt 升序在前，新卡按 id 升序在后。
 * （FSRS 里新卡的 dueAt 就是现在，所以新卡天然到期；P1 的“今日新词”与此同源。）
 */
export async function getDueList(now: Date = new Date()): Promise<DueItem[]> {
  const [allVocab, allReviews] = await Promise.all([getAllVocab(), getAllReviews()])
  const latest = new Map<number, { dueAt: Date; grade: string; reviewedAt: Date }>()
  for (const r of allReviews) {
    const cur = latest.get(r.vocabId)
    if (!cur || r.reviewedAt.getTime() >= cur.reviewedAt.getTime()) {
      latest.set(r.vocabId, { dueAt: r.dueAt, grade: r.grade, reviewedAt: r.reviewedAt })
    }
  }
  const overdue: DueItem[] = []
  const fresh: DueItem[] = []
  for (const vocab of allVocab) {
    if (vocab.id === undefined) continue
    // P4 修复（自测词串位）：T0 自测会在首页挂载时先写 3 条测试词再删，
    // 窗口期只有几毫秒，但快速点进复习页正好撞上时测试词会短暂进到期队列
    // 甚至被打分。测试词（isTestData）永远不进复习队列，SelfTest 本身不动。
    if (vocab.isTestData) continue
    const last = latest.get(vocab.id)
    if (!last) {
      fresh.push({ vocab, dueAt: now, isNew: true, lastGrade: null })
    } else if (last.dueAt.getTime() <= now.getTime()) {
      overdue.push({ vocab, dueAt: last.dueAt, isNew: false, lastGrade: last.grade })
    }
  }
  overdue.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
  fresh.sort((a, b) => (a.vocab.id ?? 0) - (b.vocab.id ?? 0))
  return [...overdue, ...fresh]
}

/** 今日到期张数（只计数，不取全表词条）。 */
export async function countDue(now: Date = new Date()): Promise<number> {
  return (await getDueList(now)).length
}

export interface GradeResult {
  /** 打分后的卡片下次到期时间。 */
  dueAt: Date
  /** 本次打分对应的间隔天数（FSRS scheduledDays）。 */
  scheduledDays: number
  /** 打分后该卡的掌握度（= 本次档位）。 */
  grade: GradeLabel
}

/**
 * 给一张卡打分：按 FSRS 更新下次到期日，写一条复习记录，更新当日统计。
 * 打分后该词自动从 P1 的“今日新词”列表消失（getUnlearnedVocab 按 reviews 表排除）。
 */
export async function gradeCard(
  vocabId: number,
  grade: GradeLabel,
  now: Date = new Date(),
): Promise<GradeResult> {
  const latest = await getLatestReviewByVocab(vocabId)
  const card = latest ? deserializeCard(latest.cardJson) : await newSrsCard(now)
  const res = await reviewSrsCard(card, grade, now)
  await addReview({
    vocabId,
    reviewedAt: now,
    grade,
    dueAt: res.card.dueAt,
    cardJson: serializeCard(res.card),
  })
  // 当日统计：复习数 +1；认识 / 很熟计入答对数。
  const dateKey = localDateKey(now)
  const stat = await getDailyStat(dateKey)
  await upsertDailyStat({
    date: dateKey,
    newWords: stat?.newWords ?? 0,
    reviewedWords: (stat?.reviewedWords ?? 0) + 1,
    correctCount: (stat?.correctCount ?? 0) + (grade === '认识' || grade === '很熟' ? 1 : 0),
    minutes: stat?.minutes ?? 0,
  })
  return { dueAt: res.card.dueAt, scheduledDays: res.card.scheduledDays, grade }
}

/** 四档打分各自的下次到期预览（与 gradeCard 用同一张卡、同一算法，结果一致）。 */
export async function previewGrades(
  vocabId: number,
  now: Date = new Date(),
): Promise<{ grade: string; dueAt: Date; scheduledDays: number }[]> {
  const latest = await getLatestReviewByVocab(vocabId)
  const card = latest ? deserializeCard(latest.cardJson) : await newSrsCard(now)
  return previewSrsCard(card, now)
}

/** 随机抽词：从已导入的全部词条中随机抽一条，排除已抽过的 id；抽完返回 null。测试词（isTestData）永远不进抽词池（与到期队列同一修法，P4）。 */
export async function getRandomVocab(excludeIds: number[]): Promise<VocabEntry | null> {
  const all = await getAllVocab()
  const pool = all.filter(
    (v) => v.id !== undefined && !v.isTestData && !excludeIds.includes(v.id),
  )
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

/** 今天已复习的张数（按 reviewedAt 的本地日期计）。 */
export async function countReviewedToday(now: Date = new Date()): Promise<number> {
  const key = localDateKey(now)
  const all = await getAllReviews()
  return all.filter((r) => localDateKey(r.reviewedAt) === key).length
}

/** 连续学习天数（周日不算断签，见 streak.ts）。 */
export async function getStudyStreak(now: Date = new Date()): Promise<number> {
  const all = await getAllReviews()
  const keys = [...new Set(all.map((r) => localDateKey(r.reviewedAt)))]
  return calcStreak(keys, now)
}

/** 某条词的掌握度：最新一次打分档位；没复习过返回 null（未学）。 */
export async function getMastery(vocabId: number): Promise<string | null> {
  const map = await getLatestGradeMap()
  return map.get(vocabId)?.grade ?? null
}

/** 把下次到期时间说成人话：约 N 分钟 / N 小时 / N.N 天后（M月D日）。 */
export function formatDue(dueAt: Date, now: Date = new Date()): string {
  const diffMs = dueAt.getTime() - now.getTime()
  if (diffMs <= 0) return '已到期'
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `约 ${mins} 分钟后`
  const hours = Math.round(diffMs / 3600000)
  if (hours < 24) return `约 ${hours} 小时后`
  const days = diffMs / 86400000
  return `约 ${days.toFixed(1)} 天后（${dueAt.getMonth() + 1}月${dueAt.getDate()}日）`
}

/** 绝对日期简写：M月D日 HH:mm（打分结果展示用）。 */
export function formatDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`
}
