// TOPIK MASTER 2027 — 答题卡（P7：#15，Practice 与 MockExam 共用）
// 每题一格：状态一眼可见，点格子跳到那道题。

export type AnswerCardState =
  | 'unanswered'
  | 'answered'
  | 'excluded'
  | 'correct'
  | 'wrong'
  | 'subjective-answered'
  | 'subjective-unanswered'

const STATE_LABEL: Record<AnswerCardState, string> = {
  unanswered: '未答',
  answered: '已答',
  excluded: '待核实，未计分',
  correct: '答对',
  wrong: '答错',
  'subjective-answered': '已写',
  'subjective-unanswered': '未写',
}

const STATE_MARK: Partial<Record<AnswerCardState, string>> = {
  answered: '•',
  excluded: '?',
  correct: '✓',
  wrong: '×',
  'subjective-answered': '写',
}

export default function AnswerCard({
  title,
  states,
  current,
  onJump,
}: {
  /** 卡片标题，如“答题卡（#15）” */
  title: string
  /** 每道题的状态，按题序 */
  states: AnswerCardState[]
  /** 当前题下标（从 0 起） */
  current: number
  /** 点格子跳题；不传则格子不可点（考后回顾用） */
  onJump?: (index: number) => void
}) {
  return (
    <div className="note garden-answer-card">
      <p>
        <b>{title}</b> · 共 {states.length} 道
        {onJump ? ' · 点格子可跳题' : ''}
      </p>
      <p className="garden-answer-grid">
        {states.map((state, i) => (
          <button
            key={i}
            type="button"
            data-state={state}
            aria-current={i === current ? 'step' : undefined}
            title={`第 ${i + 1} 道：${STATE_LABEL[state]}${i === current ? '（当前题）' : ''}`}
            disabled={!onJump}
            onClick={() => onJump?.(i)}
          >
            {i + 1}
            {STATE_MARK[state] && <span aria-hidden="true">{STATE_MARK[state]}</span>}
          </button>
        ))}
      </p>
      <p className="garden-meta garden-answer-legend">
        ✓ 答对 · × 答错 · • 已答（考试中不显示对错）· 写 主观题已写 · ? 待核实 · 虚线框为主观题未写 · 粗边框为当前题
      </p>
    </div>
  )
}
