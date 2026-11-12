import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import original from '../../data/writing-original.json'
import { db, importQuestionBank, type Question } from '../lib/db'
import { WRITING_FORMS, WRITING_GUIDE, writingForm, type WritingDraft } from '../lib/writing-model'

export default function Writing() {
  const [data, setData] = useState<{ questions: Question[]; drafts: WritingDraft[]; completed: Set<number> }>()
  const [filter, setFilter] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const subscription = liveQuery(() => db.transaction('r', [db.questions, db.writingDrafts, db.attempts], async () => {
      const questions = (await db.questions.where('qtype').equals('写作').toArray()).filter(question => !question.options.length)
      const drafts = await db.writingDrafts.toArray()
      const submitted = drafts.filter(draft => draft.lastAttemptId !== undefined)
      const versions = await db.attempts.bulkGet(submitted.map(draft => draft.lastAttemptId!))
      const completed = new Set(submitted.filter((draft, i) => versions[i]?.selectedAnswer === draft.text).map(draft => draft.questionId))
      return { questions, drafts, completed }
    })).subscribe({ next: setData, error: () => setError('无法读取写作题和草稿。') })
    return () => subscription.unsubscribe()
  }, [])
  const visible = data?.questions.filter(question => !filter || question.order === Number(filter))
  return <>
    <p className="garden-navline"><a href="#/">← 返回首页</a><a href="#/writing-history">写作历史与自评</a></p>
    <h1>TOPIK II 写作练习</h1>
    <p>按纸笔考试题型练习。题目来源会单独标出，自评仅供学习参考。 <a href={WRITING_GUIDE} target="_blank" rel="noreferrer">官方题型与答题指南</a></p>
    <label className="garden-field">按写作题型筛选 <select value={filter} onChange={event => setFilter(event.target.value)}>
      <option value="">全部题型</option>
      {Object.entries(WRITING_FORMS).map(([number, form]) => <option key={number} value={number}>第 {number} 题 · {form.title}</option>)}
    </select></label>
    <p className="garden-actions"><button type="button" disabled={busy} onClick={() => {
      setBusy(true); setError(''); setMessage('')
      void importQuestionBank(JSON.stringify(original)).then(result => {
        if (result.errors.length) setError(result.errors.join('；'))
        else setMessage(`新增 ${result.questionsAdded} 题，已有 ${result.questionsSkipped} 题。`)
      }).catch(() => setError('原创题未加载，请重试。')).finally(() => setBusy(false))
    }}>加载 51–54 项目原创题</button>{' '}
    <a href="#/practice?qtype=写作">导入本地试卷或查看试卷练习</a></p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {visible?.length === 0 && <p>此题型暂无题目，可加载原创题或导入有依据的本地试卷。</p>}
    <ul className="garden-entries">{visible?.map(question => {
      const draft = data?.drafts.find(row => row.questionId === question.id)
      const form = writingForm(question.order)
      return <li key={question.id}>
        <a href={`#/practice?question=${question.id}`}>{form ? `第 ${question.order} 题 · ` : ''}{question.stem.split('\n')[0]}</a>
        <span className="garden-meta">{question.source} · {data?.completed.has(question.id!) ? '已完成，可继续修改' : draft?.text.trim() ? '继续编辑' : draft?.lastAttemptId ? '已有历史版本' : '可开始练习'}</span>
      </li>
    })}</ul>
  </>
}
