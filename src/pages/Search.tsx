import { liveQuery } from 'dexie'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getAllQuestions, getAllVocab, getLearningResources } from '../lib/db'
import { GRAMMAR_POINTS, matchesGrammar } from '../lib/grammar-content'
import { PUBLIC_RESOURCE_LINKS } from '../lib/resource-model'
import { readingHref } from '../lib/reading-model'

const LIMIT = 20
const normalize = (text: string) => text.normalize('NFKC').toLowerCase()

async function readSearchData() {
  const [vocab, questions, resources] = await Promise.all([getAllVocab(), getAllQuestions(), getLearningResources()])
  return { vocab, questions, resources }
}

function Group({ name, count, children }: { name: string; count: number; children: ReactNode }) {
  return (
    <section className="garden-search-group" aria-label={name}>
      <h2>{name}（{count}）</h2>
      {count === 0 ? <p className="garden-meta">没有匹配结果。</p> : <ul className="garden-entries">{children}</ul>}
      {count > LIMIT && <p>显示前 {LIMIT} 项，可缩小关键词范围。</p>}
    </section>
  )
}

export default function Search({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof readSearchData>>>()
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const subscription = liveQuery(readSearchData).subscribe({
      next: setData,
      error: () => setError('无法读取学习数据，请重新打开搜索页。'),
    })
    return () => subscription.unsubscribe()
  }, [])

  const results = useMemo(() => {
    const terms = normalize(query).trim().split(/\s+/u).filter(Boolean)
    if (!data || terms.length === 0) return undefined
    const matches = (...fields: string[]) => {
      const text = normalize(fields.join(' '))
      return terms.every(term => text.includes(term))
    }
    return {
      vocab: data.vocab.filter(row => !row.isTestData && matches(row.ko, row.zh, row.example_ko, row.example_zh)),
      grammar: GRAMMAR_POINTS.filter(point => matchesGrammar(point, query)),
      questions: data.questions.filter(row => matches(row.stem, row.qtype, row.source)),
      personal: data.resources.filter(row => matches(row.title, row.note, row.url)),
      public: PUBLIC_RESOURCE_LINKS.filter(row => matches(row.title, row.description, row.url)),
    }
  }, [data, query])

  return (
    <>
      <button type="button" className="secondary garden-back" onClick={onBack}>← 返回首页</button>
      <h1>全局搜索</h1>
      <p className="garden-search-field"><label className="garden-field">搜索词汇、语法、题目和资料{' '}
        <input type="search" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} />
      </label></p>
      {error && <p role="alert" className="fail">{error}</p>}
      {!query.trim() && <p className="garden-meta">输入韩文或中文关键词即可搜索。词汇和题目以本机已有的记录为准。</p>}
      {query.trim() && !results && !error && <p role="status">正在读取学习数据……</p>}
      {results && (
        <>
          <p className="garden-band" role="status">找到 {Object.values(results).reduce((total, rows) => total + rows.length, 0)} 项</p>
          <Group name="词汇" count={results.vocab.length}>
            {results.vocab.slice(0, LIMIT).map(row => <li key={row.id}>
              <a href={`#/vocab?q=${encodeURIComponent(row.ko)}`}>{row.ko}</a>
              <span className="garden-meta">{row.zh || '释义待补'}</span>
            </li>)}
          </Group>
          <Group name="语法" count={results.grammar.length}>
            {results.grammar.slice(0, LIMIT).map(row => <li key={row.id}>
              <a href={`#/grammar?point=${encodeURIComponent(row.id)}`}>{row.pattern}</a>
              <span className="garden-meta">{row.meaningZh || '释义待补'}</span>
            </li>)}
          </Group>
          <Group name="题目" count={results.questions.length}>
            {results.questions.slice(0, LIMIT).map(row => <li key={row.id}>
              <a href={row.readingId ? readingHref(row.readingId) : `#/practice?question=${row.id}`}>{row.stem}</a>
              <span className="garden-meta">{row.qtype} · {row.source}</span>
            </li>)}
          </Group>
          <Group name="资料" count={results.personal.length + results.public.length}>
            {results.public.slice(0, LIMIT).map(row => <li key={row.url}>
              <a href={row.url} target="_blank" rel="noreferrer">{row.title}</a>
              <span className="garden-meta">{row.description}</span>
            </li>)}
            {results.personal.slice(0, LIMIT - Math.min(LIMIT, results.public.length)).map(row => <li key={row.id}>
              <details>
                <summary>{row.title}</summary>
                {row.note && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{row.note}</p>}
                {row.url && <p><a href={row.url} target="_blank" rel="noreferrer">打开链接</a></p>}
                <a href="#/resources">在学习资料库中管理</a>
              </details>
            </li>)}
          </Group>
        </>
      )}
    </>
  )
}
