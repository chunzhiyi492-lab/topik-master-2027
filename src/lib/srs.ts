import { DefaultScheduler, Rating } from 'ts-fsrs'
import type { DefaultSchedulerCard } from 'ts-fsrs'

// TOPIK MASTER 2027 — SRS 层（T0）
// 直接复用 ts-fsrs v6，默认 FSRS-7 参数，不自研算法，不做参数训练。
//
// 类型说明（实测记录）：ts-fsrs v6 的 DefaultScheduler 默认 FSRS-7，
// 但库内 FSRS-6 / FSRS-7 两套卡片类型同名不同构，newCard / review /
// preview 三处的卡片类型在 tsc 下不能直接互通（运行时字段一致，
// Node 实测与浏览器自测均通过）。因此本文件在边界处用 unknown 中转，
// 对外只暴露 DefaultSchedulerCard；这是类型适配，不是绕过算法。

export type GradeLabel = '不认识' | '模糊' | '认识' | '很熟'

// Rating.Again=1 / Hard=2 / Good=3 / Easy=4；Manual=0 不用于复习。
export const GRADE_TO_RATING: Record<GradeLabel, 1 | 2 | 3 | 4> = {
  '不认识': Rating.Again,
  '模糊': Rating.Hard,
  '认识': Rating.Good,
  '很熟': Rating.Easy,
}

export const RATING_TO_GRADE: Record<number, GradeLabel> = {
  [Rating.Again]: '不认识',
  [Rating.Hard]: '模糊',
  [Rating.Good]: '认识',
  [Rating.Easy]: '很熟',
}

export type SrsCard = DefaultSchedulerCard

type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>

let schedulerPromise: Promise<Scheduler> | null = null

/** 单例 scheduler。DefaultScheduler() 默认即 FSRS-7。 */
export function getScheduler(): Promise<Scheduler> {
  if (!schedulerPromise) schedulerPromise = DefaultScheduler()
  return schedulerPromise
}

export async function newSrsCard(now: Date = new Date()): Promise<SrsCard> {
  const scheduler = await getScheduler()
  const card = scheduler.newCard({ now })
  // v6 的类型里 newCard 返回值缺 stabilityFast，
  // 但运行时实际有该字段（实测值为 0）。这里补齐后返回。
  const normalized = {
    ...card,
    stabilityFast: (card as { stabilityFast?: number }).stabilityFast ?? 0,
  }
  return normalized as unknown as SrsCard
}

export interface ReviewResult {
  card: SrsCard
  /** 复习记录（revlog），可序列化 */
  revlog: unknown
}

export async function reviewSrsCard(
  card: SrsCard,
  grade: GradeLabel,
  now: Date = new Date(),
): Promise<ReviewResult> {
  const scheduler = await getScheduler()
  // v6 的 review 入参卡片类型在 tsc 下解析为 FSRS-6 变体（缺 stabilityFast），
  // 与 DefaultSchedulerCard（FSRS-7）同名不同构；运行时字段一致，
  // 此处整参以 never 中转，返回值再转回 SrsCard（Node 实测已验证行为）。
  const result = scheduler.review({ card, grade: GRADE_TO_RATING[grade], now } as never) as {
    card: unknown
    revlog: unknown
  }
  return { card: result.card as SrsCard, revlog: result.revlog }
}

export async function previewSrsCard(card: SrsCard, now: Date = new Date()) {
  const scheduler = await getScheduler()
  // v6 的 preview 返回可迭代对象（非数组），先转数组再 map；
  // 入参类型问题同 review，整参以 never 中转。
  const items = [
    ...scheduler.preview({ card, now } as never),
  ] as unknown as { grade: number; card: { dueAt: Date; scheduledDays: number } }[]
  return items.map((item) => ({
    grade: RATING_TO_GRADE[item.grade] ?? String(item.grade),
    dueAt: item.card.dueAt,
    scheduledDays: item.card.scheduledDays,
  }))
}

/** 卡片转可存 JSON（Date → ISO 字符串），供 IndexedDB 的 cardJson 字段使用。 */
export function serializeCard(card: SrsCard): string {
  return JSON.stringify(card, (_key, value) => (value instanceof Date ? value.toISOString() : value))
}

/** 从 JSON 恢复卡片（ISO 字符串 → Date）。 */
export function deserializeCard(json: string): SrsCard {
  const raw = JSON.parse(json) as Record<string, unknown>
  for (const key of ['dueAt', 'lastReviewAt']) {
    if (typeof raw[key] === 'string') raw[key] = new Date(raw[key] as string)
  }
  return raw as unknown as SrsCard
}
