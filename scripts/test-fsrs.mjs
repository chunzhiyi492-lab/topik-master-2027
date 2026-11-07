// TOPIK MASTER 2027 — T0：ts-fsrs Node 测试
// 用法：npm run test:fsrs
// 断言：
//  1. 新建卡片 review Good 后，下次 due 晚于 review Again 的 due。
//  2. 卡片可 JSON 序列化，往返后 dueAt 不变。
//  3. preview 返回 Again / Hard / Good / Easy 四档。
import { DefaultScheduler, Rating } from 'ts-fsrs'

const now = new Date('2026-11-07T00:00:00.000Z')
const scheduler = await DefaultScheduler()

const good = scheduler.review({ card: scheduler.newCard({ now }), grade: Rating.Good, now })
const again = scheduler.review({ card: scheduler.newCard({ now }), grade: Rating.Again, now })
const hard = scheduler.review({ card: scheduler.newCard({ now }), grade: Rating.Hard, now })
const easy = scheduler.review({ card: scheduler.newCard({ now }), grade: Rating.Easy, now })

const goodDue = new Date(good.card.dueAt).getTime()
const againDue = new Date(again.card.dueAt).getTime()

console.log('Good due:', good.card.dueAt, 'scheduledDays:', good.card.scheduledDays)
console.log('Hard due:', hard.card.dueAt, 'scheduledDays:', hard.card.scheduledDays)
console.log('Again due:', again.card.dueAt, 'scheduledDays:', again.card.scheduledDays)
console.log('Easy due:', easy.card.dueAt, 'scheduledDays:', easy.card.scheduledDays)

const serialized = JSON.stringify(good.card)
const restored = JSON.parse(serialized)
const roundTripOk = new Date(restored.dueAt).getTime() === goodDue
console.log('序列化往返 dueAt 一致:', roundTripOk)

const preview = [...scheduler.preview({ card: scheduler.newCard({ now }), now })]
console.log('preview 档位:', preview.map((p) => p.grade))

const failures = []
if (!(goodDue > againDue)) failures.push('Good 的 due 不晚于 Again 的 due')
if (!roundTripOk) failures.push('序列化往返后 dueAt 变化')
if (preview.length !== 4) failures.push(`preview 应返回 4 档，实际 ${preview.length} 档`)

if (failures.length > 0) {
  console.error('FAIL:', failures.join('；'))
  process.exit(1)
}
console.log('PASS: ts-fsrs 调度正常（Good 间隔 > Again 间隔，序列化正常，四档齐全）')
