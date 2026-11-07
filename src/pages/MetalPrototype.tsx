import { useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import './MetalPrototype.css'

// TOPIK MASTER 2027 — 冷银金属 × 高科技仪器风首页视觉原型（第二版，prototype/metal-design 分支）
// 方向（用户 2026-11-07 21:59 亲定）：明亮银色金属为主 + 少量浅蓝冷光；抛光银、铬银、拉丝银、
// 珍珠银表现层次，不用灰色做主色；齿轮、精密刻度、状态灯、金属旋钮、机械面板。
// 19 个有实际反馈的交互点（见 DESIGN-PROPOSAL-METAL.md 交互清单表）。
// 只演示布局、材质与交互：不碰 Dexie / SRS / 真实词表、不装新依赖、不做 3D、不做陪伴区域。
// 页面内容全部是明确标注的演示占位，不写入任何学习数据。
// 复习按钮只给按压反馈与选中态，不写复习逻辑、不碰 SRS。
// 发音按钮直接调 window.speechSynthesis 朗读演示占位词，不碰 src/lib/speech.ts。

const DEMO_WORDS: { ko: string; zh: string }[] = [
  { ko: '안녕하세요', zh: '你好' },
  { ko: '감사합니다', zh: '谢谢' },
]

const FSRS_GRADES = ['不认识', '模糊', '认识', '很熟'] as const
type Grade = (typeof FSRS_GRADES)[number]

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六'] as const
type Weekday = (typeof WEEKDAYS)[number]

const LAMPS = [
  { key: 'local', label: '本地' },
  { key: 'fsrs', label: 'FSRS' },
  { key: 'offline', label: '离线就绪' },
] as const
type LampKey = (typeof LAMPS)[number]['key']

const INITIAL_NEW_WORDS = 20
const INITIAL_REVIEW_COUNT = 40
const INITIAL_PROGRESS = 62

function todayWeekday(): Weekday {
  // 周日没有课，归到周六
  const idx = Math.min((new Date().getDay() + 6) % 7, 5)
  return WEEKDAYS[idx]
}

/* ---------- 自画 SVG 齿轮（纯 SVG，无图片素材） ---------- */
function Gear({
  size,
  teeth,
  rotation,
  label,
}: {
  size: number
  teeth: number
  rotation: number
  label: string
}) {
  const c = size / 2
  const rOuter = size / 2 - 2
  const rBody = size / 2 - 9
  const toothW = (2 * Math.PI * rBody) / teeth / 2.2
  return (
    <svg
      className="metal-gear"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      data-rotation={Math.round(rotation)}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {Array.from({ length: teeth }).map((_, i) => {
        const a = (i * 360) / teeth
        return (
          <rect
            key={i}
            x={c - toothW / 2}
            y={c - rOuter}
            width={toothW}
            height={9}
            rx={1.5}
            fill="#dfe5ea"
            stroke="#8f959b"
            strokeWidth={0.8}
            transform={`rotate(${a} ${c} ${c})`}
          />
        )
      })}
      <circle cx={c} cy={c} r={rBody} fill="#eef1f4" stroke="#8f959b" strokeWidth={1} />
      <circle cx={c} cy={c} r={rBody * 0.45} fill="#f8fafb" stroke="#aab0b6" strokeWidth={1} />
      <circle cx={c} cy={c} r={3} fill="#8f959b" />
    </svg>
  )
}

/* ---------- 金属旋钮：指针拖动旋转 + 键盘方向键 ---------- */
function Knob({
  label,
  value,
  max,
  unit,
  onChange,
}: {
  label: string
  value: number
  max: number
  unit: string
  onChange: (v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startAngle: number; startValue: number } | null>(null)
  const angle = -135 + (value / max) * 270

  const angleOf = (clientX: number, clientY: number) => {
    const el = ref.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return (Math.atan2(clientY - (r.top + r.height / 2), clientX - (r.left + r.width / 2)) * 180) / Math.PI
  }
  const norm = (d: number) => ((d + 540) % 360) - 180

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startAngle: angleOf(e.clientX, e.clientY), startValue: value }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const delta = norm(angleOf(e.clientX, e.clientY) - d.startAngle)
    const next = Math.round(d.startValue + (delta / 270) * max)
    onChange(Math.max(0, Math.min(max, next)))
  }
  const endDrag = () => {
    drag.current = null
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      onChange(Math.min(max, value + step))
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      onChange(Math.max(0, value - step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(max)
    }
  }

  // 旋钮外圈刻度：11 条，从 -135° 到 +135°
  const ticks = Array.from({ length: 11 }).map((_, i) => {
    const a = ((-135 + i * 27) * Math.PI) / 180
    const x1 = 50 + 42 * Math.sin(a)
    const y1 = 50 - 42 * Math.cos(a)
    const x2 = 50 + 47 * Math.sin(a)
    const y2 = 50 - 47 * Math.cos(a)
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 5 === 0 ? '#1e4e79' : '#8f959b'} strokeWidth={i % 5 === 0 ? 2 : 1} />
  })

  return (
    <div className="metal-knob-wrap">
      <svg className="metal-knob-ticks" viewBox="0 0 100 100" aria-hidden="true">
        {ticks}
      </svg>
      <div
        ref={ref}
        className="metal-knob"
        role="slider"
        tabIndex={0}
        aria-label={`${label}（拖动旋转或用方向键调节）`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value}${unit}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <span className="metal-knob-disc" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="metal-knob-pointer" />
        </span>
      </div>
      <p className="metal-knob-readout">
        <span>{label}</span>
        <strong>
          {value}
          {unit}
        </strong>
      </p>
    </div>
  )
}

function MetalPrototype({ onBack }: { onBack: () => void }) {
  const [simple, setSimple] = useState(false)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [lamps, setLamps] = useState<Record<LampKey, boolean>>({ local: true, fsrs: true, offline: true })
  const [collapsed, setCollapsed] = useState({ study: false, review: false, progress: false })
  const [newWords, setNewWords] = useState(INITIAL_NEW_WORDS)
  const [reviewCount, setReviewCount] = useState(INITIAL_REVIEW_COUNT)
  const [progress, setProgress] = useState(INITIAL_PROGRESS)
  const [zhHidden, setZhHidden] = useState<Record<string, boolean>>({})
  const [fav, setFav] = useState<Record<string, boolean>>({})
  const [speakingKo, setSpeakingKo] = useState<string | null>(null)
  const [mode, setMode] = useState<'study' | 'review'>('study')
  const [weekday, setWeekday] = useState<Weekday>(todayWeekday)

  // 齿轮联动：旋钮转，齿轮按比例转（旋钮 A 驱动大齿轮 + 小齿轮，旋钮 B 驱动第三齿轮）
  const knobAAngle = -135 + (newWords / 50) * 270
  const knobBAngle = -135 + (reviewCount / 100) * 270
  const gearA = knobAAngle * 2
  const gearB = -knobAAngle * 1.5 + 12
  const gearC = knobBAngle * 2

  const resetAll = () => {
    setSimple(false)
    setGrade(null)
    setLamps({ local: true, fsrs: true, offline: true })
    setCollapsed({ study: false, review: false, progress: false })
    setNewWords(INITIAL_NEW_WORDS)
    setReviewCount(INITIAL_REVIEW_COUNT)
    setProgress(INITIAL_PROGRESS)
    setZhHidden({})
    setFav({})
    setSpeakingKo(null)
    setMode('study')
    setWeekday(todayWeekday())
  }

  const speak = (ko: string) => {
    if (speakingKo) return
    try {
      const u = new SpeechSynthesisUtterance(ko)
      u.lang = 'ko-KR'
      setSpeakingKo(ko)
      u.onend = () => setSpeakingKo(null)
      u.onerror = () => setSpeakingKo(null)
      window.speechSynthesis.speak(u)
      // 无语音环境的兜底：4 秒后自动复位
      window.setTimeout(() => setSpeakingKo((cur) => (cur === ko ? null : cur)), 4000)
    } catch {
      setSpeakingKo(null)
    }
  }

  const onGaugeClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    setProgress(Math.round(ratio * 100))
  }
  const onGaugeKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      setProgress((v) => Math.min(100, v + step))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      setProgress((v) => Math.max(0, v - step))
    }
  }

  const toggleCollapse = (key: 'study' | 'review' | 'progress') =>
    setCollapsed((v) => ({ ...v, [key]: !v[key] }))

  return (
    <div className={`metal-proto${simple ? ' metal-simple' : ''}`}>
      {/* 顶栏：仪器铭牌 + 状态灯（可逐个点亮/熄灭） */}
      <header className="metal-topbar panel-brushed">
        <button type="button" className="metal-btn metal-btn-back" onClick={onBack}>
          ← 返回首页
        </button>
        <div className="metal-brand">
          <span className="metal-brand-mark" aria-hidden="true">
            TM
          </span>
          <span className="metal-brand-text">
            <strong>TOPIK MASTER 2027</strong>
            <small>冷银金属 × 仪器风 · 视觉原型</small>
          </span>
        </div>
        <div className="metal-lamps" aria-label="状态指示（演示，点按开关）">
          {LAMPS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className="metal-lamp"
              aria-pressed={lamps[key]}
              title={`${label}（演示，点按开关）`}
              onClick={() => setLamps((v) => ({ ...v, [key]: !v[key] }))}
            >
              <i className={`lamp-dot${lamps[key] ? ' lamp-on' : ''}`} />
              {label}
              <span className="metal-lamp-state">{lamps[key] ? '开' : '关'}</span>
            </button>
          ))}
        </div>
        <label className="metal-toggle">
          <span>简洁模式</span>
          <button
            type="button"
            role="switch"
            aria-checked={simple}
            aria-label="简洁模式开关"
            className={`metal-switch${simple ? ' is-on' : ''}`}
            onClick={() => setSimple((v) => !v)}
          >
            <span className="metal-switch-knob" />
          </button>
        </label>
      </header>

      <p className="metal-demo-note">
        原型演示：页面内容为演示占位（非教材词汇）。金属质感均为纯 CSS / SVG 实现，未使用任何图片素材。
      </p>

      {/* 00 仪器控制台：旋钮 + 齿轮联动 + 模式 + 日期 + 重置 */}
      <section className="metal-panel metal-deck panel-brushed" aria-label="仪器控制台">
        <span className="metal-screw screw-tl" aria-hidden="true" />
        <span className="metal-screw screw-tr" aria-hidden="true" />
        <div className="metal-panel-head">
          <h2>
            <span className="metal-sec-no">00</span> 仪器控制台
          </h2>
          <span className="metal-tag">旋钮 · 齿轮 · 模式</span>
        </div>
        <div className="metal-deck-body">
          <Knob label="每日新词" value={newWords} max={50} unit=" 个" onChange={setNewWords} />
          <Knob label="复习量" value={reviewCount} max={100} unit=" 张" onChange={setReviewCount} />
          <div className="metal-gears" aria-label="齿轮组（随旋钮联动）">
            <Gear size={64} teeth={12} rotation={gearA} label="大齿轮（随每日新词旋钮联动）" />
            <Gear size={44} teeth={9} rotation={gearB} label="小齿轮（随每日新词旋钮反向联动）" />
            <Gear size={54} teeth={10} rotation={gearC} label="齿轮（随复习量旋钮联动）" />
            <p className="metal-gears-note">齿轮随旋钮转动</p>
          </div>
          <div className="metal-deck-controls">
            <div className="metal-segmented" role="group" aria-label="学习模式（演示）">
              <button
                type="button"
                className={mode === 'study' ? 'is-on' : ''}
                aria-pressed={mode === 'study'}
                onClick={() => setMode('study')}
              >
                学习模式
              </button>
              <button
                type="button"
                className={mode === 'review' ? 'is-on' : ''}
                aria-pressed={mode === 'review'}
                onClick={() => setMode('review')}
              >
                复习模式
              </button>
            </div>
            <p className="metal-mode-state" aria-live="polite">
              当前：{mode === 'study' ? '学习模式——今日学习面板显示新词' : '复习模式——今日学习面板切换为复习卡片'}
              （演示）
            </p>
            <div className="metal-weekdays" role="group" aria-label="日期选择（演示）">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={weekday === d ? 'is-on' : ''}
                  aria-pressed={weekday === d}
                  onClick={() => setWeekday(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <button type="button" className="metal-btn metal-btn-reset" onClick={resetAll}>
              重置演示
            </button>
          </div>
        </div>
      </section>

      <main className="metal-grid">
        {/* 01 今日学习 / 今日复习 */}
        <section className="metal-panel panel-brushed" aria-label="今日学习">
          <span className="metal-screw screw-tl" aria-hidden="true" />
          <span className="metal-screw screw-tr" aria-hidden="true" />
          <span className="metal-screw screw-bl" aria-hidden="true" />
          <span className="metal-screw screw-br" aria-hidden="true" />
          <div className="metal-panel-head">
            <h2>
              <button
                type="button"
                className="metal-panel-toggle"
                aria-expanded={!collapsed.study}
                onClick={() => toggleCollapse('study')}
              >
                <span className="metal-sec-no">01</span>
                {mode === 'study' ? '今日学习' : '今日复习'} · {weekday}
                <span className={`metal-chevron${collapsed.study ? ' is-collapsed' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
            </h2>
            <span className="metal-tag">TOPIK II · 保 4 冲 5</span>
          </div>
          {!collapsed.study && (
            <div className="metal-cards">
              {DEMO_WORDS.map((w) => (
                <article key={w.ko} className="metal-word-card">
                  <p className="metal-word-ko">{w.ko}</p>
                  {zhHidden[w.ko] ? (
                    <p className="metal-word-zh is-masked">··· 释义已遮盖</p>
                  ) : (
                    <p className="metal-word-zh">
                      {w.zh}
                      <span className="metal-word-note">（演示占位，非教材词汇）</span>
                    </p>
                  )}
                  <div className="metal-word-actions">
                    <button
                      type="button"
                      className="metal-mini-btn"
                      aria-pressed={!!zhHidden[w.ko]}
                      onClick={() => setZhHidden((v) => ({ ...v, [w.ko]: !v[w.ko] }))}
                    >
                      {zhHidden[w.ko] ? '显示释义' : '隐藏释义'}
                    </button>
                    <button
                      type="button"
                      className={`metal-mini-btn${fav[w.ko] ? ' is-fav' : ''}`}
                      aria-pressed={!!fav[w.ko]}
                      onClick={() => setFav((v) => ({ ...v, [w.ko]: !v[w.ko] }))}
                    >
                      {fav[w.ko] ? '★ 已收藏' : '☆ 收藏'}
                    </button>
                    <button
                      type="button"
                      className="metal-mini-btn"
                      disabled={speakingKo === w.ko}
                      onClick={() => speak(w.ko)}
                    >
                      {speakingKo === w.ko ? '朗读中…' : '朗读'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* 02 复习 */}
        <section className="metal-panel panel-brushed" aria-label="复习">
          <span className="metal-screw screw-tl" aria-hidden="true" />
          <span className="metal-screw screw-tr" aria-hidden="true" />
          <div className="metal-panel-head">
            <h2>
              <button
                type="button"
                className="metal-panel-toggle"
                aria-expanded={!collapsed.review}
                onClick={() => toggleCollapse('review')}
              >
                <span className="metal-sec-no">02</span> 复习
                <span className={`metal-chevron${collapsed.review ? ' is-collapsed' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
            </h2>
            <span className="metal-tag">FSRS · 四档评分</span>
          </div>
          {!collapsed.review && (
            <>
              <p className="metal-sec-desc">当前卡片（演示）：안녕하세요</p>
              <div className="metal-grades" role="group" aria-label="复习评分（演示）">
                {FSRS_GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={grade === g}
                    className={`metal-grade${grade === g ? ' is-selected' : ''}`}
                    onClick={() => setGrade(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <p className="metal-grade-state" aria-live="polite">
                {grade
                  ? `已选：${grade}（演示，仅视觉反馈，不写入复习记录）`
                  : '请点一个评分（演示，仅视觉反馈，不写入复习记录）'}
              </p>
            </>
          )}
        </section>

        {/* 03 进度 */}
        <section className="metal-panel panel-brushed" aria-label="进度">
          <span className="metal-screw screw-tl" aria-hidden="true" />
          <span className="metal-screw screw-tr" aria-hidden="true" />
          <div className="metal-panel-head">
            <h2>
              <button
                type="button"
                className="metal-panel-toggle"
                aria-expanded={!collapsed.progress}
                onClick={() => toggleCollapse('progress')}
              >
                <span className="metal-sec-no">03</span> 进度
                <span className={`metal-chevron${collapsed.progress ? ' is-collapsed' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
            </h2>
            <span className="metal-tag">本周</span>
          </div>
          {!collapsed.progress && (
            <>
              <div className="metal-gauge" aria-label="今日学习进度（演示数值，点刻度可设定）">
                <div className="metal-gauge-head">
                  <span>今日学习进度（演示数值，点刻度可设定）</span>
                  <span className="metal-gauge-value">{progress}%</span>
                </div>
                <div
                  className="metal-gauge-track"
                  role="slider"
                  tabIndex={0}
                  aria-label="今日学习进度（演示，点按或用方向键设定）"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-valuetext={`${progress}%`}
                  onClick={onGaugeClick}
                  onKeyDown={onGaugeKeyDown}
                >
                  <div className="metal-gauge-ticks" aria-hidden="true" />
                  <div className="metal-gauge-fill" style={{ width: `${progress}%` }} />
                  <div className="metal-gauge-needle" style={{ left: `${progress}%` }} />
                </div>
                <div className="metal-gauge-scale" aria-hidden="true">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </div>
              <dl className="metal-stats">
                <div>
                  <dt>学习天数</dt>
                  <dd>5 天</dd>
                </div>
                <div>
                  <dt>累计卡片</dt>
                  <dd>86 张</dd>
                </div>
                <div>
                  <dt>专注时长</dt>
                  <dd>21 小时</dd>
                </div>
              </dl>
              <p className="metal-word-zh">以上均为演示数值。</p>
            </>
          )}
        </section>
      </main>

      <footer className="metal-foot">
        <p>
          原型说明：本页为冷银金属 × 仪器风首页视觉原型（第二版），仅演示布局、材质与交互；内容为演示占位，非教材词汇；不读取、不写入真实学习数据。
        </p>
      </footer>
    </div>
  )
}

export default MetalPrototype
