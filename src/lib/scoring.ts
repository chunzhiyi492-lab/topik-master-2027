// TOPIK MASTER 2027 — 自动计分纯函数（P7：#15 答题卡与自动计分）
// 不碰 IndexedDB、不碰 React，只算数，方便手工核对与单测。
// 口径（P7 定死）：
// - 只判客观题（objective: true，即 options 非空、answerIndex 不为 null 的题）：
//   选对 = 答对，选错 = 答错，没选 = 未答。
// - 主观题（objective: false，即写作等 subjective 答题）不自动判分、不计正确率，
//   只记“已写 / 未写”，成绩页标“待自评”。
// - 正确率 = 答对 ÷ 已答客观题（未答不计入分母）；按题型分项同理；
//   已答为 0 时正确率为 null（页面显示“—”）。

export interface ScoredItem {
  questionId: number
  qtype: string
  /** 是否客观题（主观题为 false） */
  objective: boolean
  /** 客观题：已作答（选了选项） */
  answered: boolean
  /** 客观题：已答且答对 */
  correct: boolean
  /** 主观题：已写答案 */
  subjectiveAnswered: boolean
}

export interface QtypeScore {
  qtype: string
  /** 该题型客观题总数 */
  total: number
  /** 该题型客观题已答数 */
  answered: number
  /** 该题型客观题答对数 */
  correct: number
  /** 该题型客观题正确率（已答为 0 时为 null） */
  accuracy: number | null
  /** 该题型主观题已写数 */
  subjectiveAnswered: number
  /** 该题型主观题总数 */
  subjectiveTotal: number
}

export interface ScoreSummary {
  /** 客观题总数 */
  total: number
  /** 客观题已答数 */
  answered: number
  /** 客观题答对数 */
  correct: number
  /** 客观题答错数（已答 − 答对） */
  wrong: number
  /** 客观题未答数 */
  unanswered: number
  /** 客观题正确率（已答为 0 时为 null） */
  accuracy: number | null
  /** 主观题总数 */
  subjectiveTotal: number
  /** 主观题已写数 */
  subjectiveAnswered: number
  /** 按题型分项（按首次出现顺序） */
  byQtype: QtypeScore[]
}

/** 正确率：答对 ÷ 已答，四舍五入到整数百分比；已答为 0 时返回 null（显示“—”）。 */
export function accuracyPct(correct: number, answered: number): number | null {
  if (answered <= 0) return null
  return Math.round((correct / answered) * 100)
}

export function scoreItems(items: ScoredItem[]): ScoreSummary {
  const obj = items.filter((i) => i.objective)
  const subj = items.filter((i) => !i.objective)
  const answered = obj.filter((i) => i.answered).length
  const correct = obj.filter((i) => i.answered && i.correct).length
  const byQtype: QtypeScore[] = []
  const seen = new Map<string, QtypeScore>()
  for (const i of items) {
    let row = seen.get(i.qtype)
    if (!row) {
      row = {
        qtype: i.qtype,
        total: 0,
        answered: 0,
        correct: 0,
        accuracy: null,
        subjectiveAnswered: 0,
        subjectiveTotal: 0,
      }
      seen.set(i.qtype, row)
      byQtype.push(row)
    }
    if (i.objective) {
      row.total += 1
      if (i.answered) row.answered += 1
      if (i.answered && i.correct) row.correct += 1
    } else {
      row.subjectiveTotal += 1
      if (i.subjectiveAnswered) row.subjectiveAnswered += 1
    }
  }
  for (const row of byQtype) {
    row.accuracy = accuracyPct(row.correct, row.answered)
  }
  return {
    total: obj.length,
    answered,
    correct,
    wrong: answered - correct,
    unanswered: obj.length - answered,
    accuracy: accuracyPct(correct, answered),
    subjectiveTotal: subj.length,
    subjectiveAnswered: subj.filter((i) => i.subjectiveAnswered).length,
    byQtype,
  }
}
