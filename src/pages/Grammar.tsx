// TOPIK MASTER 2027 — 语法学习页（第一阶段新建）
// 数据：data/grammar.json（《新延世韩国语》1–6 册《词汇与语法》提取，
// 正文 400 点 + 附录 280 条；附录只在数据层，本页仅展示正文）。
// meaningZh 为空的点显示“待补”，不编造释义与例句。
// 来源：商业教材提取，仅供个人学习（见页底说明）。

import { useMemo, useState } from 'react'
import grammarJson from '../../data/grammar.json'

interface GrammarPoint {
  id: string
  book: string
  lesson: number
  pattern: string
  meaningZh: string
  exampleKo: string[]
  exampleZh: string[]
  note: string
  page: number | string
  kind: '正文' | '附录'
}

const DATA = grammarJson as unknown as {
  source: string
  licenseNote: string
  counts: { main: number; appendix: number; total: number }
  points: GrammarPoint[]
}

const BOOKS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2', '5-1', '5-2', '6-1', '6-2']

function bookLabel(book: string): string {
  const [level, part] = book.split('-')
  return `${level}册 ${part === '1' ? '上' : '下'}`
}

export default function Grammar({ onBack }: { onBack: () => void }) {
  const [book, setBook] = useState('全部')
  const [keyword, setKeyword] = useState('')

  const mainPoints = useMemo(() => DATA.points.filter((p) => p.kind === '正文'), [])
  const pendingCount = useMemo(
    () => mainPoints.filter((p) => !p.meaningZh).length,
    [mainPoints],
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim()
    return mainPoints.filter((p) => {
      if (book !== '全部' && p.book !== book) return false
      if (!kw) return true
      return p.pattern.includes(kw) || (p.meaningZh && p.meaningZh.includes(kw))
    })
  }, [mainPoints, book, keyword])

  return (
    <>
      <h1>语法学习</h1>
      <p>
        按《新延世韩国语》1–6 册《词汇与语法》整理。点开一条看中文解释与例句；
        中文释义缺失的标“待补”，不编造。
      </p>
      <p className="grammar-count">
        正文 {DATA.counts.main} 点（其中 {pendingCount} 点中文释义待补）· 附录{' '}
        {DATA.counts.appendix} 条已收录在数据中，本页仅展示正文（是否单独展示后续再定）。
      </p>
      <div className="grammar-search">
        <select value={book} onChange={(e) => setBook(e.target.value)} aria-label="按分册筛选">
          <option value="全部">全部分册</option>
          {BOOKS.map((b) => (
            <option key={b} value={b}>
              {bookLabel(b)}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索语法形式或中文释义"
          aria-label="搜索语法"
        />
      </div>
      <p className="grammar-count">共 {filtered.length} 点</p>
      {filtered.length === 0 && <p>没有符合条件的语法点，换个关键词或分册试试。</p>}
      {filtered.map((p) => (
        <details key={p.id} className="grammar-item">
          <summary>
            <span className="grammar-pattern">{p.pattern}</span>
            <span className="grammar-book">
              {bookLabel(p.book)} · {p.lesson}课 · 书 p.{p.page}
            </span>
          </summary>
          {p.meaningZh ? (
            <p className="grammar-meaning">{p.meaningZh}</p>
          ) : (
            <p className="grammar-meaning grammar-pending">中文释义待补（原书为韩文原版，无中文别册）。</p>
          )}
          {p.exampleKo.length > 0 && (
            <ul className="grammar-example">
              {p.exampleKo.map((ex, i) => (
                <li key={i}>
                  {ex}
                  {p.exampleZh[i] ? <div>{p.exampleZh[i]}</div> : null}
                </li>
              ))}
            </ul>
          )}
          {p.note && <p className="grammar-note">备注：{p.note}</p>}
        </details>
      ))}
      <div className="note">
        <p>
          数据来源：{DATA.source}。{DATA.licenseNote}。
          本页只展示已提取的内容，不声称官方授权；例句与释义均来自书内原文，未自行编造。
        </p>
      </div>
      <p>
        <button type="button" className="secondary" onClick={onBack}>
          返回首页
        </button>
      </p>
    </>
  )
}
