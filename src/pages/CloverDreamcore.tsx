import { useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import './CloverDreamcore.css'

// TOPIK MASTER 2027 — 四叶草 · 梦核主题首页视觉原型 v2（prototype/clover-dreamcore 分支）
// 方向（用户 2026-11-07 23:13 亲定）：四叶草形状再改改，以四叶草为灵感设计 UI 和交互点，
// 不是照抄金属风那一版；四叶草颜色太深，改浅一点。
// v2 与 v1 的根本不同：v1 是把金属风骨架（00 控制台 + 01/02/03 面板 + 旋钮 + 齿轮联动）
// 原样换了个四叶草皮肤；v2 让四叶草的形状本身成为组织方式——
// 首页中央一株大四叶草，四片草叶就是四个功能区（今日学习 / 复习 / 练习 / 进度），
// 点一片草叶去对应区；复习卡片是一片草叶，点草叶翻面看释义；进度是一片正在生长的
// 四叶草；数量调节不是旋钮，而是拉草茎（拖草叶上下拉，草茎跟着长短）；日期是一排小
// 草叶，今天那株开花；状态用草叶的形态表达（亮着的舒展、未完成的是小芽）。
// 只演示布局、材质与交互：不碰 Dexie / SRS / 真实词表、不装新依赖、不做 3D。
// 页面内容全部是明确标注的演示占位，不写入任何学习数据。
// 复习按钮只给按压反馈与选中态，不写复习逻辑、不碰 SRS。
// 发音按钮直接调 window.speechSynthesis 朗读演示占位词，不碰 src/lib/speech.ts。

const DEMO_WORDS: { ko: string; zh: string }[] = [
  { ko: '안녕하세요', zh: '你好' },
  { ko: '감사합니다', zh: '谢谢' },
]

const DRAW_POOL: { ko: string; zh: string }[] = [
  { ko: '안녕하세요', zh: '你好' },
  { ko: '감사합니다', zh: '谢谢' },
  { ko: '사랑', zh: '爱' },
  { ko: '학교', zh: '学校' },
  { ko: '친구', zh: '朋友' },
]

const FSRS_GRADES = ['不认识', '模糊', '认识', '很熟'] as const
type Grade = (typeof FSRS_GRADES)[number]

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六'] as const
type Weekday = (typeof WEEKDAYS)[number]

const PRACTICE_TYPES = ['听力', '阅读', '写作', '模拟考试'] as const
type PracticeType = (typeof PRACTICE_TYPES)[number]

const LAMPS = [
  { key: 'local', label: '本地' },
  { key: 'fsrs', label: 'FSRS' },
  { key: 'offline', label: '离线就绪' },
] as const
type LampKey = (typeof LAMPS)[number]['key']

type ZoneKey = 'study' | 'review' | 'practice' | 'progress'

const ZONES: { key: ZoneKey; no: string; name: string; sub: string }[] = [
  { key: 'study', no: '①', name: '今日学习', sub: '20 个' },
  { key: 'review', no: '②', name: '复习', sub: '40 张' },
  { key: 'practice', no: '③', name: '练习', sub: '抽词' },
  { key: 'progress', no: '④', name: '进度', sub: '62%' },
]

const INITIAL_NEW_WORDS = 20
const INITIAL_REVIEW_COUNT = 40
const INITIAL_PROGRESS = 62

function todayWeekday(): Weekday {
  // 周日没有课，归到周六
  const idx = Math.min((new Date().getDay() + 6) % 7, 5)
  return WEEKDAYS[idx]
}

/* ---------- 自画四叶草（纯 SVG，无图片素材） ----------
   一片草叶 = 一颗心形（尖在中心、两瓣朝外），四片分别旋转 0°/90°/180°/270°。
   v2 颜色改浅：草叶填充全部换成浅绿（#a5dba8 / #b7e3c0 / #9fd8ae / #c2e8c6），
   未点亮是更浅的 #eef8ec，粉色指示叶也改浅（#f2b8c8）。 */
const LEAF_PATH =
  'M50 50 C42 42 32 34 34 24 C36 16 46 18 50 26 C54 18 64 16 66 24 C68 34 58 42 50 50 Z'
const LEAF_FILLS = ['#a5dba8', '#b7e3c0', '#9fd8ae', '#c2e8c6']

function Clover({
  size,
  rotation = 0,
  bloom = 1,
  lit = [true, true, true, true],
  pointerLeaf,
  glow = false,
  label,
  className = '',
}: {
  size: number
  rotation?: number
  bloom?: number
  lit?: boolean[]
  pointerLeaf?: number
  glow?: boolean
  label: string
  className?: string
}) {
  return (
    <svg
      className={`clover-svg${glow ? ' is-glow' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      data-rotation={Math.round(rotation)}
      data-bloom={bloom.toFixed(2)}
      style={{ transform: `rotate(${rotation}deg) scale(${bloom})` }}
    >
      <path
        d="M50 56 C48 68 52 78 50 92"
        stroke="#a5dba8"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
      {[0, 90, 180, 270].map((a, i) => (
        <path
          key={a}
          d={LEAF_PATH}
          fill={pointerLeaf === i ? '#f2b8c8' : lit[i] ? LEAF_FILLS[i] : '#eef8ec'}
          stroke={pointerLeaf === i ? '#d18ba3' : lit[i] ? '#7cc98d' : '#cfeeda'}
          strokeWidth={1}
          transform={`rotate(${a} 50 50)`}
        />
      ))}
      <circle cx={50} cy={50} r={4.5} fill="#f9dbe4" stroke="#e9a8bd" strokeWidth={1} />
    </svg>
  )
}

/* 单片草叶（小标记用：进度草叶、评分按钮上的草叶标记、生长草叶） */
function Leaf({
  size,
  lit,
  label,
  style,
  grow,
}: {
  size: number
  lit: boolean
  label: string
  style?: CSSProperties
  grow?: number
}) {
  return (
    <svg
      className={`clover-leaf${lit ? ' is-lit' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      data-lit={lit ? 'on' : 'off'}
      data-grow={grow !== undefined ? grow.toFixed(2) : undefined}
      style={style}
    >
      <path
        d={LEAF_PATH}
        fill={lit ? '#a5dba8' : '#eef8ec'}
        stroke={lit ? '#7cc98d' : '#cfeeda'}
        strokeWidth={1.5}
      />
    </svg>
  )
}

/* ---------- 首页中央的大四叶草：四片草叶就是四个功能区 ----------
   草叶朝外生长（尖在中心、两瓣朝外），每片草叶上直接写分区名与小字，
   文字用反向旋转保持正向可读；圆心是今日进度与日期。点一片草叶去对应区。 */
function BigClover({
  progress,
  weekday,
  activeLeaf,
  onSelect,
}: {
  progress: number
  weekday: Weekday
  activeLeaf: ZoneKey | null
  onSelect: (key: ZoneKey) => void
}) {
  const onLeafKey = (e: ReactKeyboardEvent<SVGGElement>, key: ZoneKey) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(key)
    }
  }
  return (
    <svg
      className="clover-big"
      viewBox="0 0 220 240"
      role="group"
      aria-label="四叶草导航：四片草叶分别是今日学习、复习、练习、进度，点一片去对应分区"
    >
      {/* 草茎与土壤线 */}
      <path d="M110 182 C110 192 108 198 110 204" stroke="#a5dba8" strokeWidth={3} fill="none" strokeLinecap="round" />
      <line x1="66" y1="206" x2="154" y2="206" stroke="#d3e8d2" strokeWidth={2} strokeLinecap="round" />
      {ZONES.map((z, i) => {
        const angle = i * 90
        const active = activeLeaf === z.key
        // 草叶朝向：0° 朝上，顺时针 90° 一片。标签与编号按屏面坐标排布
        // （不在缩放的草叶组里写字，避免字体被放大）。
        // 分区名在内（半径 40）、小字在外（半径 53，沿草叶向外方向），
        // 小字绝不往圆心方向放——圆心白圈半径 27，会盖住它。
        // 草叶放大到 2.15 倍（叶尖半径约 73），左右两片横向小字的宽度
        // 沿径向伸展也不会探出叶尖。
        // 注意：左右两片草叶上，名字和小字不能放同一条横线（会互相重叠），
        // 小字改放名字下方；上下两片保持名字在内、小字在外。
        const rad = (angle * Math.PI) / 180
        const dx = Math.sin(rad)
        const dy = -Math.cos(rad)
        const lx = 110 + dx * 40
        const ly = 105 + dy * 40
        const isSide = angle === 90 || angle === 270
        const sx = isSide ? lx : 110 + dx * 53
        const sy = isSide ? 121 : 105 + dy * 53
        return (
          <g
            key={z.key}
            className={`clover-big-leaf${active ? ' is-active' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${z.no} ${z.name}（点按去${z.name}分区）`}
            data-leaf={z.key}
            data-active={active ? 'on' : 'off'}
            onClick={() => onSelect(z.key)}
            onKeyDown={(e) => onLeafKey(e, z.key)}
          >
            <g
              transform={`translate(110,105) rotate(${angle}) scale(${active ? 2.28 : 2.15}) translate(-50,-50)`}
            >
              <path
                d={LEAF_PATH}
                fill={active ? '#a5dba8' : '#cfeeda'}
                stroke={active ? '#7cc98d' : '#a5dba8'}
                strokeWidth={1.2}
              />
            </g>
            {/* 草叶上的分区名与小字（屏面坐标，正向可读） */}
            <text x={lx} y={ly} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="#2e4034">
              {z.name}
            </text>
            <text x={sx} y={sy} textAnchor="middle" fontSize={9.5} fill="#6b7d70">
              {z.key === 'progress' ? `${progress}%` : z.sub}
            </text>
            {/* 复习叶上有待复习任务：粉色小芽标记（在名字上方） */}
            {z.key === 'review' && (
              <circle cx={lx} cy={ly - 16} r={4.5} fill="#f2b8c8" stroke="#d18ba3" strokeWidth={0.8} />
            )}
          </g>
        )
      })}
      {/* 圆心：今日进度与日期 */}
      <circle cx={110} cy={105} r={27} fill="#ffffff" stroke="#d3e8d2" strokeWidth={1.5} />
      <text x={110} y={102} textAnchor="middle" fontSize={15} fontWeight={700} fill="#4c8a5f">
        {progress}%
      </text>
      <text x={110} y={117} textAnchor="middle" fontSize={9} fill="#6b7d70">
        今日 · {weekday}
      </text>
    </svg>
  )
}

/* ---------- 拉草茎调数量：拖草叶上下拉，草茎跟着长短 ----------
   不是旋钮：竖着的草茎是一条生长线，草叶是拉手，往上拉数值变大、往下推变小；
   草茎已长出的部分填浅绿；也支持点按刻度、方向键、两端小叶按钮微调。 */
function SproutControl({
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
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pct = (value / max) * 100

  const setFromClientY = (clientY: number) => {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const ratio = 1 - (clientY - r.top) / r.height
    onChange(Math.max(0, Math.min(max, Math.round(ratio * max))))
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    setFromClientY(e.clientY)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    setFromClientY(e.clientY)
  }
  const endDrag = () => {
    dragging.current = false
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 5 : 1
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

  return (
    <div className="clover-sprout">
      <div
        ref={trackRef}
        className="clover-sprout-track"
        role="slider"
        tabIndex={0}
        aria-label={`${label}（上下拖草叶或用方向键调节）`}
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
        <div className="clover-sprout-ticks" aria-hidden="true" />
        <div className="clover-sprout-fill" style={{ height: `${pct}%` }} aria-hidden="true" />
        <div
          className="clover-sprout-leaf"
          style={{ bottom: `calc(${pct}% - 22px)` }}
          data-value={value}
          aria-hidden="true"
        >
          <Clover size={44} label={`${label}草叶拉手`} />
        </div>
      </div>
      <p className="clover-sprout-readout">
        <span>{label}</span>
        <strong>
          {value}
          {unit}
        </strong>
      </p>
      <div className="clover-sprout-steps">
        <button
          type="button"
          aria-label={`${label}减 1`}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <button
          type="button"
          aria-label={`${label}加 1`}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          ＋
        </button>
      </div>
    </div>
  )
}

/* ---------- 草丛联动：拉草茎时，花园里的三株四叶草跟着旋转 + 绽开 ---------- */
function GardenCluster({
  rotA,
  rotB,
  rotC,
  bloomA,
  bloomB,
  bloomC,
}: {
  rotA: number
  rotB: number
  rotC: number
  bloomA: number
  bloomB: number
  bloomC: number
}) {
  return (
    <div className="clover-cluster" aria-label="花园草丛（随草茎联动绽开）">
      <Clover size={64} rotation={rotA} bloom={bloomA} glow label="大四叶草（随每日新词草茎联动）" />
      <Clover size={44} rotation={rotB} bloom={bloomB} label="小四叶草（随每日新词草茎反向联动）" />
      <Clover size={54} rotation={rotC} bloom={bloomC} label="四叶草（随复习量草茎联动）" />
      <p className="clover-cluster-note">花园草丛随草茎绽开</p>
    </div>
  )
}

function CloverDreamcore({ onBack }: { onBack: () => void }) {
  const [simple, setSimple] = useState(false)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [lamps, setLamps] = useState<Record<LampKey, boolean>>({ local: true, fsrs: true, offline: true })
  const [collapsed, setCollapsed] = useState<Record<ZoneKey, boolean>>({
    study: false,
    review: false,
    practice: false,
    progress: false,
  })
  const [newWords, setNewWords] = useState(INITIAL_NEW_WORDS)
  const [reviewCount, setReviewCount] = useState(INITIAL_REVIEW_COUNT)
  const [progress, setProgress] = useState(INITIAL_PROGRESS)
  const [zhHidden, setZhHidden] = useState<Record<string, boolean>>({})
  const [fav, setFav] = useState<Record<string, boolean>>({})
  const [speakingKo, setSpeakingKo] = useState<string | null>(null)
  const [mode, setMode] = useState<'study' | 'review'>('study')
  const [weekday, setWeekday] = useState<Weekday>(todayWeekday)
  const [activeLeaf, setActiveLeaf] = useState<ZoneKey | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [drawn, setDrawn] = useState<number | null>(null)
  const [drawZhHidden, setDrawZhHidden] = useState(false)
  const [practiceType, setPracticeType] = useState<PracticeType | null>(null)

  const zoneRefs = useRef<Record<ZoneKey, HTMLElement | null>>({
    study: null,
    review: null,
    practice: null,
    progress: null,
  })

  // 草丛联动：拉草茎，草丛按比例旋转 + 绽开（公式与 v1 一致，数值驱动不变）
  const sproutAAngle = -135 + (newWords / 50) * 270
  const sproutBAngle = -135 + (reviewCount / 100) * 270
  const cloverA = sproutAAngle * 2
  const cloverB = -sproutAAngle * 1.5 + 12
  const cloverC = sproutBAngle * 2
  const bloomA = 0.85 + (newWords / 50) * 0.3
  const bloomB = 0.85 + (newWords / 50) * 0.15
  const bloomC = 0.85 + (reviewCount / 100) * 0.3

  // 进度生长草叶：四片草叶随完成度逐片长出（每 25% 长满一片）
  const growFracs = [0, 1, 2, 3].map((i) => Math.max(0, Math.min(1, (progress - i * 25) / 25)))
  const litLeaves = growFracs.map((f) => f >= 1)

  const selectZone = (key: ZoneKey) => {
    setActiveLeaf(key)
    setCollapsed((v) => ({ ...v, [key]: false }))
    zoneRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const resetAll = () => {
    setSimple(false)
    setGrade(null)
    setLamps({ local: true, fsrs: true, offline: true })
    setCollapsed({ study: false, review: false, practice: false, progress: false })
    setNewWords(INITIAL_NEW_WORDS)
    setReviewCount(INITIAL_REVIEW_COUNT)
    setProgress(INITIAL_PROGRESS)
    setZhHidden({})
    setFav({})
    setSpeakingKo(null)
    setMode('study')
    setWeekday(todayWeekday())
    setActiveLeaf(null)
    setFlipped(false)
    setDrawn(null)
    setDrawZhHidden(false)
    setPracticeType(null)
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

  const onGrowClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    setProgress(Math.round(ratio * 100))
  }
  const onGrowKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      setProgress((v) => Math.min(100, v + step))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      setProgress((v) => Math.max(0, v - step))
    }
  }

  const toggleCollapse = (key: ZoneKey) => setCollapsed((v) => ({ ...v, [key]: !v[key] }))
  const drawWord = () => {
    setDrawn(Math.floor(Math.random() * DRAW_POOL.length))
    setDrawZhHidden(false)
  }

  const reviewWord = DEMO_WORDS[0]

  return (
    <div className={`clover-proto${simple ? ' clover-simple' : ''}`}>
      {/* 梦核柔雾光团（纯 CSS，无图片） */}
      <div className="clover-mist mist-1" aria-hidden="true" />
      <div className="clover-mist mist-2" aria-hidden="true" />
      <div className="clover-mist mist-3" aria-hidden="true" />

      {/* 顶栏：四叶草铭牌 + 四叶草形状的状态灯（可逐个点亮/熄灭） */}
      <header className="clover-topbar panel-soft">
        <button type="button" className="clover-btn clover-btn-back" onClick={onBack}>
          ← 返回首页
        </button>
        <div className="clover-brand">
          <span className="clover-brand-mark" aria-hidden="true">
            <Clover size={36} label="四叶草标志" />
          </span>
          <span className="clover-brand-text">
            <strong>TOPIK MASTER 2027</strong>
            <small>四叶草 · 梦核 · 视觉原型</small>
          </span>
        </div>
        <div className="clover-lamps" aria-label="状态指示（演示，点按开关）">
          {LAMPS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className="clover-lamp"
              aria-pressed={lamps[key]}
              title={`${label}（演示，点按开关）`}
              onClick={() => setLamps((v) => ({ ...v, [key]: !v[key] }))}
            >
              <Clover
                size={26}
                lit={[lamps[key], lamps[key], lamps[key], lamps[key]]}
                glow={lamps[key]}
                label={`${label}四叶草灯`}
              />
              <span className="clover-lamp-label">{label}</span>
              <span className="clover-lamp-state">{lamps[key] ? '开' : '关'}</span>
            </button>
          ))}
        </div>
        <label className="clover-toggle">
          <span>简洁模式</span>
          <button
            type="button"
            role="switch"
            aria-checked={simple}
            aria-label="简洁模式开关"
            className={`clover-switch${simple ? ' is-on' : ''}`}
            onClick={() => setSimple((v) => !v)}
          >
            <span className="clover-switch-knob">
              <Leaf size={16} lit={simple} label="开关上的草叶" />
            </span>
          </button>
        </label>
      </header>

      <p className="clover-demo-note">
        原型演示：页面内容为演示占位（非教材词汇）。四叶草与柔雾均为纯 CSS / SVG 手绘，未使用任何图片素材。
      </p>

      {/* 首页中央的大四叶草：四片草叶就是四个功能区 */}
      <section className="clover-panel clover-hero panel-soft" aria-label="四叶草花园">
        <span className="clover-corner corner-tl" aria-hidden="true">
          <Clover size={20} label="装饰四叶草" />
        </span>
        <span className="clover-corner corner-tr" aria-hidden="true">
          <Clover size={20} label="装饰四叶草" />
        </span>
        <div className="clover-panel-head">
          <h2>
            <Clover size={22} label="分区四叶草" />
            四叶草花园
          </h2>
          <span className="clover-tag">点一片草叶，去对应分区</span>
        </div>
        <div className="clover-divider" aria-hidden="true">
          <span />
          <Clover size={16} label="分隔线四叶草" />
          <span />
        </div>
        <div className="clover-hero-body">
          <BigClover progress={progress} weekday={weekday} activeLeaf={activeLeaf} onSelect={selectZone} />
          <p className="clover-hero-status" aria-live="polite">
            {activeLeaf
              ? `已选：${ZONES.find((z) => z.key === activeLeaf)?.name}分区（演示）`
              : '点一片草叶，去今日学习、复习、练习或进度分区（演示）'}
          </p>
        </div>
      </section>

      {/* 苗圃：拉草茎调数量 + 花园草丛联动 + 模式 + 日期小草叶 + 重新播种 */}
      <section className="clover-panel clover-nursery panel-soft" aria-label="苗圃">
        <span className="clover-corner corner-tl" aria-hidden="true">
          <Clover size={20} label="装饰四叶草" />
        </span>
        <span className="clover-corner corner-tr" aria-hidden="true">
          <Clover size={20} label="装饰四叶草" />
        </span>
        <div className="clover-panel-head">
          <h2>
            <Clover size={22} label="分区四叶草" />
            苗圃 · 调节
          </h2>
          <span className="clover-tag">拉草茎 · 草丛联动 · 模式</span>
        </div>
        <div className="clover-divider" aria-hidden="true">
          <span />
          <Clover size={16} label="分隔线四叶草" />
          <span />
        </div>
        <div className="clover-nursery-body">
          <SproutControl label="每日新词" value={newWords} max={50} unit=" 个" onChange={setNewWords} />
          <GardenCluster
            rotA={cloverA}
            rotB={cloverB}
            rotC={cloverC}
            bloomA={bloomA}
            bloomB={bloomB}
            bloomC={bloomC}
          />
          <SproutControl label="复习量" value={reviewCount} max={100} unit=" 张" onChange={setReviewCount} />
          <div className="clover-nursery-controls">
            <div className="clover-segmented" role="group" aria-label="学习模式（演示）">
              <button
                type="button"
                className={mode === 'study' ? 'is-on' : ''}
                aria-pressed={mode === 'study'}
                onClick={() => setMode('study')}
              >
                <Leaf size={16} lit={mode === 'study'} label="学习模式草叶" />
                学习模式
              </button>
              <button
                type="button"
                className={mode === 'review' ? 'is-on' : ''}
                aria-pressed={mode === 'review'}
                onClick={() => setMode('review')}
              >
                <Leaf size={16} lit={mode === 'review'} label="复习模式草叶" />
                复习模式
              </button>
            </div>
            <p className="clover-mode-state" aria-live="polite">
              当前：{mode === 'study' ? '学习模式——今日学习分区显示新词' : '复习模式——今日学习分区切换为复习卡片'}
              （演示）
            </p>
            <div className="clover-weekdays" role="group" aria-label="日期选择（演示）">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`clover-weekday${weekday === d ? ' is-on' : ''}`}
                  aria-pressed={weekday === d}
                  onClick={() => setWeekday(d)}
                >
                  <span className="clover-weekday-plant">
                    <Clover
                      size={weekday === d ? 30 : 24}
                      glow={weekday === d}
                      label={`${d}小草叶`}
                    />
                    {weekday === d && <span className="clover-weekday-bud" aria-hidden="true" />}
                  </span>
                  {d}
                </button>
              ))}
            </div>
            <button type="button" className="clover-btn clover-btn-reset" onClick={resetAll}>
              <Leaf size={16} lit label="重新播种草叶" />
              重新播种
            </button>
          </div>
        </div>
      </section>

      <main className="clover-grid">
        {/* ① 今日学习 / 今日复习 */}
        <section
          className="clover-panel panel-soft"
          aria-label="今日学习"
          ref={(el) => {
            zoneRefs.current.study = el
          }}
        >
          <span className="clover-corner corner-tl" aria-hidden="true">
            <Clover size={20} label="装饰四叶草" />
          </span>
          <span className="clover-corner corner-tr" aria-hidden="true">
            <Clover size={20} label="装饰四叶草" />
          </span>
          <div className="clover-panel-head">
            <h2>
              <button
                type="button"
                className="clover-panel-toggle"
                aria-expanded={!collapsed.study}
                onClick={() => toggleCollapse('study')}
              >
                <Clover size={22} label="分区四叶草" />
                <span className="clover-sec-no">①</span>
                {mode === 'study' ? '今日学习' : '今日复习'} · {weekday}
                <span className={`clover-chevron${collapsed.study ? ' is-collapsed' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
            </h2>
            <span className="clover-tag">TOPIK II · 保 4 冲 5</span>
          </div>
          <div className="clover-divider" aria-hidden="true">
            <span />
            <Clover size={16} label="分隔线四叶草" />
            <span />
          </div>
          {!collapsed.study && (
            <div className="clover-cards">
              {DEMO_WORDS.map((w) => (
                <article key={w.ko} className="clover-word-card">
                  <p className="clover-word-ko">{w.ko}</p>
                  {zhHidden[w.ko] ? (
                    <p className="clover-word-zh is-masked">··· 释义已遮盖</p>
                  ) : (
                    <p className="clover-word-zh">
                      {w.zh}
                      <span className="clover-word-note">（演示占位，非教材词汇）</span>
                    </p>
                  )}
                  <div className="clover-word-actions">
                    <button
                      type="button"
                      className="clover-mini-btn"
                      aria-pressed={!!zhHidden[w.ko]}
                      onClick={() => setZhHidden((v) => ({ ...v, [w.ko]: !v[w.ko] }))}
                    >
                      {zhHidden[w.ko] ? '显示释义' : '隐藏释义'}
                    </button>
                    <button
                      type="button"
                      className={`clover-mini-btn${fav[w.ko] ? ' is-fav' : ''}`}
                      aria-pressed={!!fav[w.ko]}
                      onClick={() => setFav((v) => ({ ...v, [w.ko]: !v[w.ko] }))}
                    >
                      <Leaf size={15} lit={!!fav[w.ko]} label="收藏草叶" />
                      {fav[w.ko] ? '已收藏' : '收藏'}
                    </button>
                    <button
                      type="button"
                      className="clover-mini-btn"
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

        {/* ② 复习：草叶翻面卡片 + 四片小草叶评分 */}
        <section
          className="clover-panel panel-soft"
          aria-label="复习"
          ref={(el) => {
            zoneRefs.current.review = el
          }}
        >
          <span className="clover-corner corner-tl" aria-hidden="true">
            <Clover size={20} label="装饰四叶草" />
          </span>
          <span className="clover-corner corner-tr" aria-hidden="true">
            <Clover size={20} label="装饰四叶草" />
          </span>
          <div className="clover-panel-head">
            <h2>
              <button
                type="button"
                className="clover-panel-toggle"
                aria-expanded={!collapsed.review}
                onClick={() => toggleCollapse('review')}
              >
                <Clover size={22} label="分区四叶草" />
                <span className="clover-sec-no">②</span> 复习
                <span className={`clover-chevron${collapsed.review ? ' is-collapsed' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
            </h2>
            <span className="clover-tag">FSRS · 四档评分</span>
          </div>
          <div className="clover-divider" aria-hidden="true">
            <span />
            <Clover size={16} label="分隔线四叶草" />
            <span />
          </div>
          {!collapsed.review && (
            <>
              <div
                className="clover-leaf-card"
                role="button"
                tabIndex={0}
                aria-label={flipped ? '草叶卡片背面：释义，点按翻回正面' : '草叶卡片正面：韩文单词，点按翻面看释义'}
                aria-pressed={flipped}
                onClick={() => setFlipped((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setFlipped((v) => !v)
                  }
                }}
              >
                <div className={`clover-leaf-face front${flipped ? ' is-hidden' : ''}`} aria-hidden={flipped}>
                  <Clover size={40} label="卡片上的四叶草" />
                  <p className="clover-word-ko">{reviewWord.ko}</p>
                  <p className="clover-leaf-hint">点草叶翻面看释义（演示）</p>
                </div>
                <div className={`clover-leaf-face back${flipped ? '' : ' is-hidden'}`} aria-hidden={!flipped}>
                  <Clover size={40} label="卡片背面的四叶草" />
                  <p className="clover-word-zh">
                    {reviewWord.zh}
                    <span className="clover-word-note">（演示占位，非教材词汇）</span>
                  </p>
                  <p className="clover-leaf-hint">再点草叶翻回正面（演示）</p>
                </div>
              </div>
              <div className="clover-grades" role="group" aria-label="复习评分（演示）">
                {FSRS_GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={grade === g}
                    className={`clover-grade${grade === g ? ' is-selected' : ''}`}
                    onClick={() => setGrade(g)}
                  >
                    <Leaf size={18} lit={grade === g} label={`${g}草叶标记`} />
                    {g}
                  </button>
                ))}
              </div>
              <p className="clover-grade-state" aria-live="polite">
                {grade
                  ? `已选：${grade}（演示，仅视觉反馈，不写入复习记录）`
                  : '先翻面看释义，再点一片小草叶评分（演示，仅视觉反馈，不写入复习记录）'}
              </p>
            </>
          )}
        </section>

        {/* ③ 练习：随机抽词 + 练习类型小草叶 */}
        <section
          className="clover-panel panel-soft"
          aria-label="练习"
          ref={(el) => {
            zoneRefs.current.practice = el
          }}
        >
          <span className="clover-corner corner-tl" aria-hidden="true">
            <Clover size={20} label="装饰四叶草" />
          </span>
          <span className="clover-corner corner-tr" aria-hidden="true">
            <Clover size={20} label="装饰四叶草" />
          </span>
          <div className="clover-panel-head">
            <h2>
              <button
                type="button"
                className="clover-panel-toggle"
                aria-expanded={!collapsed.practice}
                onClick={() => toggleCollapse('practice')}
              >
                <Clover size={22} label="分区四叶草" />
                <span className="clover-sec-no">③</span> 练习
                <span className={`clover-chevron${collapsed.practice ? ' is-collapsed' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
            </h2>
            <span className="clover-tag">随机抽词 · 演示</span>
          </div>
          <div className="clover-divider" aria-hidden="true">
            <span />
            <Clover size={16} label="分隔线四叶草" />
            <span />
          </div>
          {!collapsed.practice && (
            <>
              <button type="button" className="clover-btn clover-btn-draw" onClick={drawWord}>
                <Leaf size={16} lit label="抽词草叶" />
                随机抽一张
              </button>
              {drawn !== null && (
                <article className="clover-word-card clover-draw-card">
                  <p className="clover-word-ko">{DRAW_POOL[drawn].ko}</p>
                  {drawZhHidden ? (
                    <p className="clover-word-zh is-masked">··· 释义已遮盖</p>
                  ) : (
                    <p className="clover-word-zh">
                      {DRAW_POOL[drawn].zh}
                      <span className="clover-word-note">（演示占位，非教材词汇）</span>
                    </p>
                  )}
                  <div className="clover-word-actions">
                    <button
                      type="button"
                      className="clover-mini-btn"
                      aria-pressed={drawZhHidden}
                      onClick={() => setDrawZhHidden((v) => !v)}
                    >
                      {drawZhHidden ? '显示释义' : '隐藏释义'}
                    </button>
                  </div>
                </article>
              )}
              <div className="clover-practice-types" role="group" aria-label="练习类型（演示）">
                {PRACTICE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={practiceType === t}
                    className={`clover-practice-type${practiceType === t ? ' is-selected' : ''}`}
                    onClick={() => setPracticeType(t)}
                  >
                    <Leaf size={15} lit={practiceType === t} label={`${t}草叶`} />
                    {t}
                  </button>
                ))}
              </div>
              <p className="clover-grade-state" aria-live="polite">
                {practiceType
                  ? `已选：${practiceType}练习（演示，题库未接入）`
                  : '选一种练习类型（演示，题库未接入）'}
              </p>
            </>
          )}
        </section>

        {/* ④ 进度：正在生长的四叶草 + 生长线 */}
        <section
          className="clover-panel panel-soft"
          aria-label="进度"
          ref={(el) => {
            zoneRefs.current.progress = el
          }}
        >
          <span className="clover-corner corner-tl" aria-hidden="true">
            <Clover size={20} label="装饰四叶草" />
          </span>
          <span className="clover-corner corner-tr" aria-hidden="true">
            <Clover size={20} label="装饰四叶草" />
          </span>
          <div className="clover-panel-head">
            <h2>
              <button
                type="button"
                className="clover-panel-toggle"
                aria-expanded={!collapsed.progress}
                onClick={() => toggleCollapse('progress')}
              >
                <Clover size={22} label="分区四叶草" />
                <span className="clover-sec-no">④</span> 进度
                <span className={`clover-chevron${collapsed.progress ? ' is-collapsed' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
            </h2>
            <span className="clover-tag">本周</span>
          </div>
          <div className="clover-divider" aria-hidden="true">
            <span />
            <Clover size={16} label="分隔线四叶草" />
            <span />
          </div>
          {!collapsed.progress && (
            <>
              <div className="clover-grow" aria-label="今日学习进度（演示数值，点生长线可设定）">
                <div className="clover-grow-head">
                  <span>今日学习进度（演示数值，点生长线可设定）</span>
                  <span className="clover-grow-value">{progress}%</span>
                </div>
                {/* 正在生长的四叶草：四片草叶随完成度逐片长出、点亮 */}
                <div
                  className="clover-grow-plant"
                  aria-label={`生长中的四叶草，已长满 ${litLeaves.filter(Boolean).length} 片（演示）`}
                >
                  <svg
                    className="clover-grow-svg"
                    viewBox="0 0 200 120"
                    role="img"
                    aria-label="生长中的四叶草"
                  >
                    <path
                      d="M100 108 C98 96 102 88 100 78"
                      stroke="#a5dba8"
                      strokeWidth={3}
                      fill="none"
                      strokeLinecap="round"
                    />
                    {[0, 90, 180, 270].map((a, i) => {
                      const f = growFracs[i]
                      return (
                        <g
                          key={a}
                          transform={`translate(100,78) rotate(${a}) scale(${0.25 + 0.75 * f}) translate(-50,-50)`}
                          opacity={0.35 + 0.65 * f}
                          data-grow={f.toFixed(2)}
                          data-leaf-index={i}
                        >
                          <path
                            d={LEAF_PATH}
                            fill={f >= 1 ? '#a5dba8' : '#eef8ec'}
                            stroke={f >= 1 ? '#7cc98d' : '#cfeeda'}
                            strokeWidth={1.5}
                          />
                        </g>
                      )
                    })}
                    <circle cx={100} cy={78} r={5} fill="#f9dbe4" stroke="#e9a8bd" strokeWidth={1} />
                    <line x1="60" y1="112" x2="140" y2="112" stroke="#d3e8d2" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                  <p className="clover-grow-note">
                    四片草叶逐片长出：已长满 {litLeaves.filter(Boolean).length} 片（演示）
                  </p>
                </div>
                <div
                  className="clover-grow-track"
                  role="slider"
                  tabIndex={0}
                  aria-label="今日学习进度生长线（演示，点按或用方向键设定）"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-valuetext={`${progress}%`}
                  onClick={onGrowClick}
                  onKeyDown={onGrowKeyDown}
                >
                  <div className="clover-grow-ticks" aria-hidden="true" />
                  <div className="clover-grow-fill" style={{ width: `${progress}%` }} />
                  <div className="clover-grow-needle" style={{ left: `${progress}%` }} aria-hidden="true">
                    <Clover size={22} label="生长线上的四叶草" />
                  </div>
                </div>
                <div className="clover-grow-scale" aria-hidden="true">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </div>
              <dl className="clover-stats">
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
              <p className="clover-word-zh">以上均为演示数值。</p>
            </>
          )}
        </section>
      </main>

      <footer className="clover-foot">
        <p>
          原型说明：本页为四叶草 · 梦核主题视觉原型 v2，仅演示布局、材质与交互；内容为演示占位，非教材词汇；不读取、不写入真实学习数据。
        </p>
      </footer>
    </div>
  )
}

export default CloverDreamcore
