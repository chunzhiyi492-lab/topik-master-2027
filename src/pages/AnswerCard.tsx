// TOPIK MASTER 2027 — 答题卡（P7：#15，Practice 与 MockExam 共用）
// 每题一格：状态一眼可见，点格子跳到那道题。
// 状态色（内联样式，index.css 不在 P7 可改清单里）：
// - 未答：白底灰字；答对：绿底白字；答错：红底白字；
// - 主观题已写：紫底白字；主观题未写：白底紫字虚线边。
// 当前题加粗边框。图例写在卡片下方，不靠颜色单独传意（文字也标状态）。

export type AnswerCardState =
  | 'unanswered'
  | 'answered'
  | 'correct'
  | 'wrong'
  | 'subjective-answered'
  | 'subjective-unanswered'

const STATE_LABEL: Record<AnswerCardState, string> = {
  unanswered: '未答',
  answered: '已答',
  correct: '答对',
  wrong: '答错',
  'subjective-answered': '已写',
  'subjective-unanswered': '未写',
}

function stateStyle(state: AnswerCardState, isCurrent: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    minWidth: 40,
    height: 36,
    padding: '0 6px',
    margin: 3,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    border: isCurrent ? '3px solid #111' : '1px solid #999',
  }
  switch (state) {
    case 'answered':
      // 中性“已答”（模拟考试进行中用：只表示已选，不泄露对错）。
      return { ...base, background: '#0969da', color: '#fff', borderColor: isCurrent ? '#111' : '#0969da' }
    case 'correct':
      return { ...base, background: '#1a7f37', color: '#fff', borderColor: isCurrent ? '#111' : '#1a7f37' }
    case 'wrong':
      return { ...base, background: '#cf222e', color: '#fff', borderColor: isCurrent ? '#111' : '#cf222e' }
    case 'subjective-answered':
      return { ...base, background: '#8250df', color: '#fff', borderColor: isCurrent ? '#111' : '#8250df' }
    case 'subjective-unanswered':
      return { ...base, background: '#fff', color: '#8250df', border: '1px dashed #8250df' }
    default:
      return { ...base, background: '#fff', color: '#333' }
  }
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
    <div className="note">
      <p>
        <b>{title}</b> · 共 {states.length} 道
        {onJump ? ' · 点格子可跳题' : ''}
      </p>
      <p>
        {states.map((state, i) => (
          <button
            key={i}
            type="button"
            style={stateStyle(state, i === current)}
            title={`第 ${i + 1} 道：${STATE_LABEL[state]}${i === current ? '（当前题）' : ''}`}
            disabled={!onJump}
            onClick={() => onJump?.(i)}
          >
            {i + 1}
          </button>
        ))}
      </p>
      <p>
        图例：<span style={{ color: '#1a7f37', fontWeight: 700 }}>■ 答对</span>{' '}
        <span style={{ color: '#cf222e', fontWeight: 700 }}>■ 答错</span>{' '}
        <span style={{ color: '#0969da', fontWeight: 700 }}>■ 已答（考试中不显示对错）</span>{' '}
        <span style={{ color: '#8250df', fontWeight: 700 }}>■ 主观题已写</span>{' '}
        <span>□ 未答（主观题未写为紫色虚线框）</span> · 粗边框为当前题
      </p>
    </div>
  )
}
