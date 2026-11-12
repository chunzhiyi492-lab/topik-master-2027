import { useId, useState, type ReactNode } from 'react'
import type { VocabEntry } from '../lib/db'
import { IconChevron } from './icons'
import '../study-v4.css'

export function StudyHeart({ saved, onClick, disabled, label, showLabel }: {
  saved: boolean
  onClick: () => void
  disabled?: boolean
  label?: string
  showLabel?: boolean
}) {
  const action = label ?? (saved ? '取消收藏' : '收藏')
  return (
    <button type="button" className="study-control study-heart" aria-label={action} aria-pressed={saved}
      title={showLabel ? undefined : action} onClick={onClick} disabled={disabled}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.8 4.9a5.4 5.4 0 0 0-7.6 0L12 6.1l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.5a5.4 5.4 0 0 0 0-7.6Z" />
      </svg>
      {showLabel && <span>{action}</span>}
    </button>
  )
}

export function StudySpeak({ word, onClick, speaking, disabled, iconOnly }: {
  word: string
  onClick: () => void
  speaking?: boolean
  disabled?: boolean
  iconOnly?: boolean
}) {
  return (
    <button type="button" className="study-control study-speak" aria-label={`朗读 ${word}`}
      title={iconOnly ? '发音' : undefined} onClick={onClick} disabled={disabled} data-speaking={speaking || undefined}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 9v6h4l5 4V5L7 9H3ZM15 9a4 4 0 0 1 0 6m2.5-8a7 7 0 0 1 0 10" />
      </svg>
      {!iconOnly && <span>{speaking ? '朗读中…' : '发音'}</span>}
    </button>
  )
}

export function PearlWordCard({
  word, onSpeak, onFavorite, speaking, speechDisabled, favoriteDisabled, compact, revealed, onReveal, children,
}: {
  word: VocabEntry
  onSpeak: () => void
  onFavorite: () => void
  speaking?: boolean
  speechDisabled?: boolean
  favoriteDisabled?: boolean
  compact?: boolean
  revealed?: boolean
  onReveal?: () => void
  children?: ReactNode
}) {
  const title = useId()
  const panel = useId()
  const [expanded, setExpanded] = useState(false)
  const open = revealed ?? expanded
  const source = [word.source, word.source_level].filter(Boolean).join(' · ')
  const labels = [word.pos, source, word.yonsei_lesson].filter(Boolean)

  return (
    <section className="pearl-word-card" data-compact={compact || undefined} aria-labelledby={title}>
      <img className="pearl-word-wings" src={import.meta.env.BASE_URL + 'images/silver-wings.svg'}
        alt="" width={176} height={91} draggable={false} />
      <h3 className="pearl-word-title" lang="ko" id={title}>{word.ko}</h3>
      {labels.length > 0 && <ul className="pearl-word-meta" aria-label="词条信息">
        {labels.map((label, index) => <li key={index} lang={label === word.pos ? 'ko' : undefined}>{label}</li>)}
      </ul>}
      <div className="pearl-word-actions">
        <StudySpeak word={word.ko} speaking={speaking} disabled={speechDisabled} onClick={onSpeak} />
        <StudyHeart saved={word.favorite} onClick={onFavorite} disabled={favoriteDisabled} />
      </div>
      <button className="study-primary pearl-word-reveal" type="button" aria-expanded={open} aria-controls={panel}
        onClick={onReveal ?? (() => setExpanded(value => !value))}>
        {open ? '收起释义' : '显示释义'}
        <IconChevron size={15} />
      </button>
      <div className="pearl-word-details" id={panel} data-open={open} aria-hidden={!open} inert={!open}>
        <div className="pearl-word-details-inner">
          <dl>
            <dt>中文释义</dt>
            <dd className={word.zh ? 'pearl-word-meaning' : 'study-muted'}>{word.zh || '待补'}</dd>
            <dt>韩语例句</dt>
            <dd lang={word.example_ko ? 'ko' : undefined} className={word.example_ko ? undefined : 'study-muted'}>
              {word.example_ko || '暂无例句'}
            </dd>
            {(word.example_ko || word.example_zh) && <>
              <dt>例句翻译</dt>
              <dd className={word.example_zh ? undefined : 'study-muted'}>{word.example_zh || '待补'}</dd>
            </>}
          </dl>
          <p className="pearl-word-status">词条状态 <span className="study-tag" data-pending={word.status === '待核实'}>{word.status}</span></p>
        </div>
      </div>
      {children}
    </section>
  )
}
