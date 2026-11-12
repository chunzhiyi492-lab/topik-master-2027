import { liveQuery } from 'dexie'
import { useEffect, useRef, useState } from 'react'
import original from '../../data/reading-original.json'
import { db } from '../lib/db'
import { getReadingPassages, importReadingPassages, readPassage, saveReadingChoice, saveReadingPosition, submitReading } from '../lib/reading'
import { isScoredReadingQuestion, READING_DIFFICULTIES, readingHref, type ReadingPassage } from '../lib/reading-model'

function Passage({ id }: { id: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof readPassage>> | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const pending = useRef(false)
  const lastPosition = useRef(-1)
  const [anchor, setAnchor] = useState<number>()
  useEffect(() => {
    const subscription = liveQuery(() => readPassage(id)).subscribe({
      next: value => { setData(value); if (value) setAnchor(previous => previous ?? value.passage.paragraph) },
      error: () => setError('无法读取阅读篇章。'),
    })
    return () => subscription.unsubscribe()
  }, [id])
  useEffect(() => {
    if (anchor === undefined) return
    lastPosition.current = anchor
    if (anchor) document.getElementById(`reading-paragraph-${anchor}`)?.scrollIntoView()
    const observer = new IntersectionObserver(entries => {
      const visible = entries.find(entry => entry.isIntersecting)
      if (!visible) return
      const index = Number((visible.target as HTMLElement).dataset.paragraph)
      if (lastPosition.current === index) return
      lastPosition.current = index
      void saveReadingPosition(id, index).catch(() => setError('阅读位置未保存。'))
    }, { rootMargin: '-10% 0px -65% 0px' })
    document.querySelectorAll('[data-paragraph]').forEach(paragraph => observer.observe(paragraph))
    return () => observer.disconnect()
  }, [id, anchor])

  const save = async (work: () => Promise<unknown>) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try { await work(); setConfirming(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试。') }
    finally { pending.current = false; setBusy(false) }
  }

  if (!data) return <p role={error ? 'alert' : 'status'}>{error || (data === null ? '正在读取篇章……' : '找不到这篇文章。')}</p>
  const { passage, questions } = data
  const scored = questions.filter(isScoredReadingQuestion)
  const answered = scored.filter(question => passage.choices[question.id!] !== undefined).length
  const correct = scored.filter(question => passage.choices[question.id!] === question.answerIndex).length
  return <>
    <h1 lang="ko">{passage.title}</h1>
    <p className="garden-meta">{passage.difficulty} · {passage.sourceKind} · 来源 {passage.source}</p>
    <button className="secondary" type="button" aria-pressed={passage.favorite} disabled={busy}
      onClick={() => void save(() => db.readingPassages.update(id, { favorite: !passage.favorite }))}>
      {passage.favorite ? '取消收藏篇章' : '收藏篇章'}
    </button>
    <article className="reading-text" lang="ko" aria-label="阅读正文">
      {passage.paragraphs.map((paragraph, index) => <p key={index} id={`reading-paragraph-${index}`} data-paragraph={index}>{paragraph}</p>)}
    </article>
    <h2>篇章作答</h2>
    <p>{answered} / {scored.length} 道可评分题已作答 · {questions.length - scored.length} 道待核实</p>
    {passage.finishedAt && <p role="status">本篇已完成 · 答对 {correct} / {scored.length} 道 · {new Date(passage.finishedAt).toLocaleString()}</p>}
    {questions.map(question => {
      const graded = isScoredReadingQuestion(question)
      const choice = passage.choices[question.id!]
      return <fieldset key={question.id} className="reading-question" disabled={busy || !!passage.finishedAt}>
        <legend lang="ko">{question.order}. {question.stem}</legend>
        {!graded && <p>答案或解析待核实，选项可练习，此题不计分。</p>}
        {question.options.map((option, index) => <label key={index}>
          <input type="radio" name={`reading-${question.id}`} checked={choice === index}
            onChange={() => void save(() => saveReadingChoice(id, question.id!, index))} /> <span lang="ko">{option}</span>
        </label>)}
        {passage.finishedAt && graded && <p>{choice === question.answerIndex ? '答对' : '答错'} · 正确答案 {question.options[question.answerIndex!]}<br />解析：{question.explanation}</p>}
      </fieldset>
    })}
    {error && <p role="alert" className="fail">{error}</p>}
    {!passage.finishedAt && !!scored.length && (confirming ? <p>
      提交后本轮答案将锁定，错题可在错题本复练。{' '}
      <button type="button" disabled={busy} onClick={() => void save(() => submitReading(id))}>确认提交</button>{' '}
      <button className="secondary" type="button" disabled={busy} onClick={() => setConfirming(false)}>继续检查</button>
    </p> : <button type="button" disabled={busy || answered !== scored.length} onClick={() => setConfirming(true)}>检查并提交</button>)}
    {passage.finishedAt && <p><a href="#/wrong">前往错题本</a> · <a href="#/stats">查看学习统计</a></p>}
  </>
}

function ReadingList() {
  const [passages, setPassages] = useState<ReadingPassage[]>()
  const [keyword, setKeyword] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [favorites, setFavorites] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const subscription = liveQuery(() => getReadingPassages()).subscribe({ next: setPassages, error: () => setError('无法读取篇章。') })
    return () => subscription.unsubscribe()
  }, [])
  const load = async (source: Promise<string>) => {
    setBusy(true)
    setError('')
    setMessage('')
    try { setMessage(`已导入 ${await importReadingPassages(await source)} 篇。`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败。') }
    finally { setBusy(false) }
  }
  const visible = passages?.filter(p => (!difficulty || p.difficulty === difficulty) && (!favorites || p.favorite) &&
    [p.title, p.source, ...p.paragraphs].join(' ').normalize('NFKC').includes(keyword.trim().normalize('NFKC')))
  return <>
    <h1>阅读篇章</h1>
    <p>按篇章阅读和作答。已有试卷可从<a href="#/practice?qtype=阅读">原试卷阅读练习</a>继续。</p>
    <div className="garden-filters">
    <label>搜索篇章 <input type="search" value={keyword} onChange={event => setKeyword(event.target.value)} /></label>{' '}
    <label>难度 <select value={difficulty} onChange={event => setDifficulty(event.target.value)}>
      <option value="">全部</option>{READING_DIFFICULTIES.map(value => <option key={value}>{value}</option>)}
    </select></label>{' '}
    <label><input type="checkbox" checked={favorites} onChange={event => setFavorites(event.target.checked)} /> 仅看收藏篇章</label>
    </div>
    {passages && <p>已完成 {passages.filter(p => p.finishedAt).length} / {passages.length} 篇</p>}
    {!visible?.length && <p>{passages ? '没有符合条件的篇章。' : '正在读取篇章……'}</p>}
    <ul className="garden-entries">{visible?.map(p => <li key={p.id}>
      <a href={readingHref(p.id)} lang="ko">{p.title}</a>
      <span className="garden-meta">{p.difficulty} · {p.sourceKind} · {p.finishedAt ? '已完成' : Object.keys(p.choices).length || p.paragraph ? '继续学习' : '未开始'}</span>
    </li>)}</ul>
    <button type="button" disabled={busy || original.every(row => passages?.some(p => p.id === row.id))}
      onClick={() => void load(Promise.resolve(JSON.stringify(original.filter(row => !passages?.some(p => p.id === row.id)))))}>加载项目原创篇章</button>
    <p><label>导入本地篇章 JSON <input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
      const file = event.target.files?.[0]
      if (file) void load(file.text())
      event.target.value = ''
    }} /></label></p>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="fail">{error}</p>}
  </>
}

export default function Reading({ passageId }: { passageId?: string }) {
  return <>
    <p className="garden-navline"><a href={passageId ? '#/reading' : '#/'}>{passageId ? '← 返回篇章列表' : '← 返回首页'}</a></p>
    {passageId ? <Passage key={passageId} id={passageId} /> : <ReadingList />}
  </>
}
