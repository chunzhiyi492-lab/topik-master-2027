import { useEffect, useRef, useState } from 'react'
import './JournalDreamcore.css'

// TOPIK MASTER 2027 — 手账·梦核四叶草视觉原型（prototype/journal-dreamcore 分支）
// 简约款骨架 + 梦核 × 四叶草主题：只做视觉与交互演示，不碰 Dexie / SRS / 真实词表。
// 页面内容全部是明确标注的演示占位，不写入任何学习数据。
// 布置状态只存在 localStorage 的原型专用 key，与学习数据完全分开。
// 不用外网图片：全部装饰均为手绘内联 SVG 与纯 CSS 柔光。
const STORAGE_KEY = 'topik-journal-dreamcore-v1'

type StickerKind = 'clover' | 'sprout' | 'bud' | 'cloud' | 'spark' | 'dew'

interface PlacedSticker {
  id: string
  kind: StickerKind
  /** 相对手账展开区的百分比坐标 */
  x: number
  y: number
  rot: number
  scale: number
}

const KINDS: { kind: StickerKind; label: string }[] = [
  { kind: 'clover', label: '四叶草' },
  { kind: 'sprout', label: '草叶' },
  { kind: 'bud', label: '花苞' },
  { kind: 'cloud', label: '云朵' },
  { kind: 'spark', label: '星光' },
  { kind: 'dew', label: '露珠' },
]

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** 全部 SVG 贴纸均为手绘内联 SVG，不用外网图片、不依赖任何授权素材。 */
function StickerSvg({ kind }: { kind: StickerKind }) {
  if (kind === 'clover') {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 62 C46 74 44 84 42 94" stroke="#5da271" strokeWidth="5" fill="none" strokeLinecap="round" />
        <g fill="#8fbf7f" stroke="#5da271" strokeWidth="2.5">
          <path d="M50 48 C38 30 22 28 22 42 C22 54 38 56 50 48 Z" />
          <path d="M50 48 C62 30 78 28 78 42 C78 54 62 56 50 48 Z" />
          <path d="M50 52 C38 70 22 72 22 58 C22 46 38 44 50 52 Z" />
          <path d="M50 52 C62 70 78 72 78 58 C78 46 62 44 50 52 Z" />
        </g>
        <circle cx="50" cy="50" r="4" fill="#4f8f57" />
        <circle cx="34" cy="38" r="2.5" fill="#ffffff" opacity="0.75" />
        <circle cx="66" cy="62" r="2" fill="#ffffff" opacity="0.75" />
      </svg>
    )
  }
  if (kind === 'sprout') {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 92 C50 66 50 48 50 30" stroke="#5da271" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M50 62 C36 62 26 52 24 38 C38 38 48 46 50 62 Z" fill="#a8cf9a" stroke="#5da271" strokeWidth="2.5" />
        <path d="M50 52 C64 52 74 42 76 28 C62 28 52 36 50 52 Z" fill="#8fbf7f" stroke="#5da271" strokeWidth="2.5" />
        <circle cx="50" cy="26" r="5" fill="#cfe8c2" stroke="#5da271" strokeWidth="2" />
      </svg>
    )
  }
  if (kind === 'bud') {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 88 C50 74 50 66 50 58" stroke="#5da271" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M50 66 C40 66 34 58 34 48 C42 50 48 56 50 66 Z" fill="#a8cf9a" stroke="#5da271" strokeWidth="2" />
        <path d="M50 66 C60 66 66 58 66 48 C58 50 52 56 50 66 Z" fill="#8fbf7f" stroke="#5da271" strokeWidth="2" />
        <path d="M50 14 C62 26 66 40 60 54 C56 60 52 60 50 54 C44 60 40 58 38 50 C34 38 38 24 50 14 Z" fill="#f6cdd9" stroke="#e2a3b8" strokeWidth="2.5" />
        <circle cx="44" cy="30" r="2.5" fill="#ffffff" opacity="0.8" />
      </svg>
    )
  }
  if (kind === 'cloud') {
    return (
      <svg viewBox="0 0 120 80" aria-hidden="true">
        <path
          d="M28 62 C16 62 10 52 14 43 C17 36 26 33 32 37 C35 25 48 19 58 25 C63 15 79 13 86 23 C97 20 107 28 106 40 C112 44 110 56 102 60 C96 63 92 62 88 62 Z"
          fill="#ffffff"
          stroke="#cfe4ef"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="46" cy="46" r="3" fill="#bfe3f2" opacity="0.9" />
        <circle cx="70" cy="50" r="2.5" fill="#bfe3f2" opacity="0.9" />
      </svg>
    )
  }
  if (kind === 'spark') {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 8 C54 34 66 46 92 50 C66 54 54 66 50 92 C46 66 34 54 8 50 C34 46 46 34 50 8 Z" fill="#ffe9a8" stroke="#eccf7a" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M78 16 C80 26 84 30 94 32 C84 34 80 38 78 48 C76 38 72 34 62 32 C72 30 76 26 78 16 Z" fill="#fff6d6" stroke="#eccf7a" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="50" cy="50" r="3.5" fill="#fffdf2" />
      </svg>
    )
  }
  // dew
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 12 C62 34 74 48 74 64 C74 78 63 88 50 88 C37 88 26 78 26 64 C26 48 38 34 50 12 Z" fill="#bfe3f2" stroke="#8fc6dd" strokeWidth="2.5" />
      <path d="M40 56 C40 66 44 74 50 78" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.85" />
      <circle cx="58" cy="44" r="3" fill="#ffffff" opacity="0.8" />
    </svg>
  )
}

function loadStickers(): PlacedSticker[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PlacedSticker[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s) => KINDS.some((k) => k.kind === s.kind))
  } catch {
    return []
  }
}

export default function JournalDreamcore({ onBack }: { onBack: () => void }) {
  const [pageSet, setPageSet] = useState(0)
  const [flipping, setFlipping] = useState(false)
  const [simple, setSimple] = useState(false)
  const [stickers, setStickers] = useState<PlacedSticker[]>(loadStickers)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [peeled, setPeeled] = useState(false)
  const [bloomed, setBloomed] = useState(false)
  const spreadRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null)

  const today = new Date()
  const dateLabel = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`

  // 布置只存原型专用 key，与学习数据（IndexedDB）完全分开。
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stickers))
    } catch {
      // 存储不可用时静默跳过，不影响原型使用
    }
  }, [stickers])

  function addSticker(kind: StickerKind) {
    const st: PlacedSticker = {
      id: uid(),
      kind,
      x: 34 + Math.random() * 28,
      y: 26 + Math.random() * 34,
      rot: Math.round((Math.random() * 24 - 12) * 10) / 10,
      scale: 1,
    }
    setStickers((prev) => [...prev, st])
    setSelectedId(st.id)
  }

  function updateSelected(patch: Partial<PlacedSticker>) {
    if (!selectedId) return
    setStickers((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)))
  }

  function flip() {
    if (flipping) return
    setFlipping(true)
    window.setTimeout(() => {
      setPageSet((p) => (p + 1) % 2)
      setSelectedId(null)
      setFlipping(false)
    }, 620)
  }

  function onStickerPointerDown(e: React.PointerEvent, st: PlacedSticker) {
    e.stopPropagation()
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // 旧浏览器不支持指针捕获时仍可拖动
    }
    const rect = spreadRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = {
      id: st.id,
      dx: ((e.clientX - rect.left) / rect.width) * 100 - st.x,
      dy: ((e.clientY - rect.top) / rect.height) * 100 - st.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
    setSelectedId(st.id)
  }

  function onStickerPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 6) d.moved = true
    const rect = spreadRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100 - d.dx
    const y = ((e.clientY - rect.top) / rect.height) * 100 - d.dy
    setStickers((prev) =>
      prev.map((s) => (s.id === d.id ? { ...s, x: clamp(x, 2, 96), y: clamp(y, 2, 94) } : s)),
    )
  }

  function onStickerPointerUp() {
    // 移动小于阈值视为点选（选中后显示控制条）；拖动后保持选中
    dragRef.current = null
  }

  const selected = stickers.find((s) => s.id === selectedId) ?? null

  return (
    <div className={`dc-proto${simple ? ' simple' : ''}`}>
      <div className="dc-topbar">
        <button type="button" className="secondary" onClick={onBack}>
          ← 返回首页
        </button>
        <span className="dc-title">我的韩语手账 · 梦核四叶草</span>
        <button
          type="button"
          className={`dc-lucky${bloomed ? ' bloomed' : ''}`}
          onClick={() => setBloomed((v) => !v)}
          aria-pressed={bloomed}
          aria-label="今日幸运草，点一下会开花"
        >
          <span className="dc-lucky-svg" aria-hidden="true">
            <StickerSvg kind="clover" />
          </span>
          <span className="dc-lucky-label">{bloomed ? '幸运草开花了' : '今日幸运草'}</span>
        </button>
        <button
          type="button"
          className={simple ? '' : 'secondary'}
          onClick={() => setSimple((v) => !v)}
          aria-pressed={simple}
        >
          {simple ? '显示装饰' : '简洁阅读'}
        </button>
      </div>

      <p className="dc-hint">
        原型演示：页面内容为演示占位（非教材词汇）。点下方贴纸栏把四叶草贴到手账上，拖动可摆放，点中贴纸可旋转、缩放、删除。点一下“今日幸运草”，它会发光开花（演示）。
      </p>
      {bloomed && (
        <p className="dc-bloom-note" role="status">
          今天的幸运草开花了，好运 +1（演示）
        </p>
      )}

      <div
        ref={spreadRef}
        className={`dc-book${flipping ? ' flipping' : ''}`}
        onPointerDown={() => setSelectedId(null)}
      >
        {/* 梦核装饰：柔光团、页边四叶草、漂浮星光（简洁阅读时隐藏） */}
        <div className="dc-deco dc-mist dc-mist-a" aria-hidden="true" />
        <div className="dc-deco dc-mist dc-mist-b" aria-hidden="true" />
        <div className="dc-deco dc-mist dc-mist-c" aria-hidden="true" />
        <div className="dc-deco dc-margin-clover dc-margin-tl" aria-hidden="true">
          <StickerSvg kind="clover" />
        </div>
        <div className="dc-deco dc-margin-clover dc-margin-br" aria-hidden="true">
          <StickerSvg kind="sprout" />
        </div>
        <div className="dc-deco dc-sparkle dc-sparkle-a" aria-hidden="true">
          <StickerSvg kind="spark" />
        </div>
        <div className="dc-deco dc-sparkle dc-sparkle-b" aria-hidden="true">
          <StickerSvg kind="spark" />
        </div>

        <div className={`dc-spread dc-spread-${pageSet}`}>
          {pageSet === 0 ? (
            <>
              <section className="dc-page dc-page-left">
                <div className="dc-page-head">
                  <span className="dc-date-label">{dateLabel}</span>
                  <span className="dc-goal-tag">TOPIK II · 保 4 冲 5</span>
                </div>
                <h2 className="dc-page-title">今日学习</h2>
                <div className="dc-text-card">
                  <p className="dc-ko-line">안녕하세요</p>
                  <p className="dc-zh-line">你好（演示占位，非教材词汇）</p>
                </div>
                <div className="dc-text-card">
                  <p className="dc-ko-line">감사합니다</p>
                  <p className="dc-zh-line">谢谢（演示占位，非教材词汇）</p>
                </div>
                <div className="dc-text-card">
                  <p className="dc-card-title">今日小目标（演示）</p>
                  <ul className="dc-todo-list">
                    <li>☐ 读一课课文</li>
                    <li>☐ 复习 20 张卡片</li>
                    <li>☐ 听 10 分钟韩语</li>
                  </ul>
                </div>
              </section>

              <section className="dc-page dc-page-right">
                <div className="dc-page-head">
                  <span className="dc-date-label">收藏</span>
                  <span className="dc-goal-tag">我的布置</span>
                </div>
                <h2 className="dc-page-title">收藏与布置</h2>
                <div className="dc-text-card">
                  <p className="dc-card-title">怎么玩这本手账（演示）</p>
                  <p className="dc-zh-line">
                    点下面贴纸栏里的贴纸，它会出现在页面上；拖动可以换位置；点中一张贴纸，下方会出现旋转、放大、缩小和删除按钮。
                  </p>
                </div>
                <div className="dc-text-card">
                  <p className="dc-card-title">收藏夹（演示占位）</p>
                  <p className="dc-zh-line">
                    以后这里会放你收藏的单词和句子。现在是空的演示卡片，等词汇功能做好后再接真实内容。
                  </p>
                </div>
                <div className="dc-text-card dc-clover-note">
                  <p className="dc-card-title">四叶草小记（演示）</p>
                  <p className="dc-zh-line">在页边贴一片四叶草，今天的学习就有了小小的好运。</p>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="dc-page dc-page-left">
                <div className="dc-page-head">
                  <span className="dc-date-label">本周回顾</span>
                  <span className="dc-goal-tag">便签墙</span>
                </div>
                <h2 className="dc-page-title">本周回顾</h2>
                <div className="dc-text-card">
                  <p className="dc-card-title">学习小结（演示占位）</p>
                  <p className="dc-zh-line">
                    这周完成了发音检查与第 1 课巩固。下周继续同一课，不赶进度。
                  </p>
                </div>
                <div className="dc-text-card">
                  <p className="dc-card-title">最难的一点（演示占位）</p>
                  <p className="dc-zh-line">收音拼读还不熟，多跟读几遍就好了。</p>
                </div>
              </section>

              <section className="dc-page dc-page-right">
                <div className="dc-page-head">
                  <span className="dc-date-label">便签</span>
                  <span className="dc-goal-tag">点一下揭开</span>
                </div>
                <h2 className="dc-page-title">藏起来的小纸条</h2>
                <button
                  type="button"
                  className={`dc-sticky-note${peeled ? ' peeled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPeeled((v) => !v)
                  }}
                  aria-pressed={peeled}
                >
                  <span className="dc-note-under">
                    <span className="dc-card-title">给自己的话（演示）</span>
                    <span className="dc-zh-line">每天一点点，到四月就看得到变化。加油！</span>
                  </span>
                  <span className="dc-note-cover">
                    <span className="dc-card-title">点我揭开 ↓</span>
                    <span className="dc-zh-line">这里藏了一句悄悄话</span>
                  </span>
                </button>
                <div className="dc-text-card">
                  <p className="dc-card-title">下周计划（演示占位）</p>
                  <p className="dc-zh-line">继续巩固第 1 课，周末做一次小测。</p>
                </div>
              </section>
            </>
          )}

          {/* 贴到页面上的贴纸（可拖动） */}
          {stickers.map((st) => (
            <div
              key={st.id}
              className={`dc-placed-sticker${selectedId === st.id ? ' selected' : ''}`}
              style={{
                left: `${st.x}%`,
                top: `${st.y}%`,
                transform: `translate(-50%, -50%) rotate(${st.rot}deg) scale(${st.scale})`,
              }}
              onPointerDown={(e) => onStickerPointerDown(e, st)}
              onPointerMove={onStickerPointerMove}
              onPointerUp={onStickerPointerUp}
              onPointerCancel={onStickerPointerUp}
              role="button"
              tabIndex={0}
              aria-label={`贴纸 ${KINDS.find((k) => k.kind === st.kind)?.label ?? ''}，点按选中`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedId(st.id)
                }
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  setStickers((prev) => prev.filter((s) => s.id !== st.id))
                  setSelectedId(null)
                }
              }}
            >
              <StickerSvg kind={st.kind} />
            </div>
          ))}

          {/* 右下角页角：点一下翻页 */}
          <button
            type="button"
            className="dc-page-corner"
            onClick={(e) => {
              e.stopPropagation()
              flip()
            }}
            aria-label="翻到下一组页面"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      {/* 选中贴纸的控制条 */}
      {selected && (
        <div className="dc-sticker-controls" role="toolbar" aria-label="贴纸控制">
          <span className="dc-controls-label">
            正在调整：{KINDS.find((k) => k.kind === selected.kind)?.label}
          </span>
          <button type="button" onClick={() => updateSelected({ rot: selected.rot + 15 })}>
            旋转 +15°
          </button>
          <button
            type="button"
            onClick={() => updateSelected({ scale: clamp(selected.scale * 1.2, 0.5, 2) })}
          >
            放大
          </button>
          <button
            type="button"
            onClick={() => updateSelected({ scale: clamp(selected.scale / 1.2, 0.5, 2) })}
          >
            缩小
          </button>
          <button
            type="button"
            onClick={() => {
              setStickers((prev) => prev.filter((s) => s.id !== selected.id))
              setSelectedId(null)
            }}
          >
            删除
          </button>
        </div>
      )}

      {/* 翻页按钮 */}
      <div className="dc-actions">
        <button type="button" className="secondary" onClick={flip} disabled={flipping}>
          {pageSet === 0 ? '翻页 → 本周回顾' : '← 翻回今日学习'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setStickers([])
            setSelectedId(null)
          }}
        >
          清空贴纸
        </button>
        <span className="dc-page-indicator">第 {pageSet + 1} / 2 组页面</span>
      </div>

      {/* 贴纸栏 */}
      <div className="dc-sticker-bar" role="toolbar" aria-label="贴纸栏">
        {KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            className="dc-sticker-pick"
            onClick={() => addSticker(kind)}
            aria-label={`添加贴纸：${label}`}
          >
            <span className="dc-sticker-pick-svg">
              <StickerSvg kind={kind} />
            </span>
            <span className="dc-sticker-pick-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
