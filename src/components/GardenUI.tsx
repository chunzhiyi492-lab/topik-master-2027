import type { ReactNode, Ref } from 'react'
import { IconChevron } from './icons'

export function GardenBrand({ compact, edition, children }: {
  compact?: boolean
  edition?: boolean
  children?: ReactNode
}) {
  return (
    <header className={compact ? 'silver-brand personal-brand' : 'silver-brand'}>
      <img className="silver-wings" src={import.meta.env.BASE_URL + 'images/silver-wings.svg'} alt="" width={176} height={91} />
      <div className="silver-brand-name">
        <h1>TOPIK MASTER</h1>
        {edition && <span className="silver-brand-edition">2027</span>}
      </div>
      {children}
    </header>
  )
}

export function GardenPageTitle({ children, titleRef, id }: {
  children: ReactNode
  titleRef?: Ref<HTMLHeadingElement>
  id?: string
}) {
  return <h1 className="garden-page-title" id={id} ref={titleRef} tabIndex={titleRef ? -1 : undefined}>{children}</h1>
}

type BackAction = { href: string; onClick?: never } | { onClick: () => void; href?: never }

export function GardenBack({ href, onClick, children }: BackAction & { children: ReactNode }) {
  const label = <><IconChevron size={16} className="garden-back-icon" />{children}</>
  return href === undefined
    ? <button className="personal-back" type="button" onClick={onClick}>{label}</button>
    : <a className="personal-back" href={href}>{label}</a>
}

export function GardenNotice({ tone = 'info', id, children }: {
  tone?: 'info' | 'error' | 'status'
  id?: string
  children: ReactNode
}) {
  return <p id={id} className="garden-notice" data-tone={tone}
    role={tone === 'error' ? 'alert' : tone === 'status' ? 'status' : undefined}>{children}</p>
}

export function GardenProgress({ label, max, value, children }: {
  label: string
  max: number
  value?: number
  children: ReactNode
}) {
  return (
    <div className="garden-progress">
      <span>{label}</span>
      <progress aria-label={label} max={max} value={value} />
      <strong>{children}</strong>
    </div>
  )
}

export function GardenTableScroll({ label, children }: { label: string; children: ReactNode }) {
  return <div className="garden-table-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>
}
