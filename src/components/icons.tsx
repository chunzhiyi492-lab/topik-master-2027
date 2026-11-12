// TOPIK MASTER 2027 — 细线 SVG 图标集（第一阶段）
// 全部 inline SVG，描边 1.5px、圆角端点；不用 Emoji 做图标。
// 颜色由父级 currentColor 决定（导航用 Vintage Rose，植物类用 Moss）。

import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  className?: string
  style?: CSSProperties
}

function Svg({
  size = 20,
  className,
  style,
  children,
  viewBox = '0 0 24 24',
}: IconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** 词汇：书 */
export function IconBook(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Svg>
  )
}

/** 语法：钢笔 */
export function IconPen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </Svg>
  )
}

/** 听力：耳机 */
export function IconHeadphones(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </Svg>
  )
}

/** 阅读：展开的书 */
export function IconReading(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </Svg>
  )
}

/** 写作：笔 + 横线 */
export function IconWriting(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      <path d="M3 21h18" />
    </Svg>
  )
}

/** 模拟考试：靶心 */
export function IconTarget(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Svg>
  )
}

/** 随机练习：交叉箭头 */
export function IconShuffle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="M4 4l5 5" />
    </Svg>
  )
}

/** 番茄钟：计时器 */
export function IconTimer(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 2h4" />
      <circle cx="12" cy="14" r="8" />
      <path d="M12 10v4l2.5 2.5" />
    </Svg>
  )
}

/** 学习记录：柱状图 */
export function IconChart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 15v-4M12 17V7M17 13v-2" />
    </Svg>
  )
}

/** 智能复习：卡片 */
export function IconReview(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 5v4" />
    </Svg>
  )
}

/**
 * 四叶草：四片心形叶 + 茎 + 珍珠中心点。
 * 手绘 SVG，保持轻盈精致；叶片用 Moss / Sage，中心点用 Pearl。
 */
export function IconClover({ size = 64, className, style }: IconProps) {
  const leaf =
    'M32 30 C 26 16, 10 14, 12 26 C 13 34, 24 36, 32 30 Z'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <g fill="#78866B" stroke="#A5AA94" strokeWidth="1">
        <path d={leaf} />
        <path d={leaf} transform="rotate(90 32 32)" />
        <path d={leaf} transform="rotate(180 32 32)" />
        <path d={leaf} transform="rotate(270 32 32)" />
      </g>
      <path d="M32 34 C 32 44, 30 50, 26 56" stroke="#78866B" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="2.4" fill="#EDE5E9" stroke="#C99AAF" strokeWidth="1" />
    </svg>
  )
}

export function IconHome(props: IconProps) {
  return <Svg {...props}><path d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10" /></Svg>
}

export function IconRepeat(props: IconProps) {
  return <Svg {...props}><path d="M20 4v5h-5M4 20v-5h5M20 9a8.5 8.5 0 0 0-14-4l-2 3m0 7a8.5 8.5 0 0 0 14 4l2-3" /></Svg>
}

export function IconExam(props: IconProps) {
  return <Svg {...props}><path d="M13 20H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5M7 8h8m-8 4h5m2 4 3 3 5-6" /></Svg>
}

export function IconProfile(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" /></Svg>
}

export function IconCalendar(props: IconProps) {
  return <Svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></Svg>
}

export function IconClock(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
}

export function IconChevron(props: IconProps) {
  return <Svg {...props}><path d="m9 5 7 7-7 7" /></Svg>
}
