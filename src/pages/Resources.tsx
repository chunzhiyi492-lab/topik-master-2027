import { liveQuery } from 'dexie'
import { useEffect, useState, type FormEvent } from 'react'
import { deleteLearningResource, getLearningResources, saveLearningResource } from '../lib/db'
import { PUBLIC_RESOURCE_LINKS, RESOURCE_LIMITS, type LearningResource, type ResourceFields } from '../lib/resource-model'
const EMPTY: ResourceFields = { title: '', url: '', note: '' }

export default function Resources({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<LearningResource[]>()
  const [fields, setFields] = useState<ResourceFields>(EMPTY)
  const [editing, setEditing] = useState<number>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const subscription = liveQuery(() => getLearningResources()).subscribe({
      next: setItems,
      error: () => setError('无法读取资料，请重新打开此页。'),
    })
    return () => subscription.unsubscribe()
  }, [])

  const update = (key: keyof ResourceFields, value: string) => setFields(current => ({ ...current, [key]: value }))
  const resetForm = () => {
    setFields(EMPTY)
    setEditing(undefined)
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setMessage('')
    setBusy(true)
    try {
      await saveLearningResource(fields, editing)
      resetForm()
      setMessage('资料已保存。')
    } catch (e) {
      setError(`资料未保存：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (item: LearningResource) => {
    if (busy || !window.confirm(`删除「${item.title}」吗？`)) return
    setError('')
    setMessage('')
    setBusy(true)
    try {
      await deleteLearningResource(item.id!)
      if (editing === item.id) resetForm()
      setMessage('已删除这条资料。')
    } catch (e) {
      setError(`删除失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="secondary garden-back" onClick={onBack}>← 返回学习计划</button>
      <h1>学习资料库</h1>
      <h2>公共资源</h2>
      <ul className="garden-entries garden-resource-links">{PUBLIC_RESOURCE_LINKS.map(link => (
        <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.title}</a>
          <span className="garden-meta">{link.description}</span></li>
      ))}</ul>
      <h2>我的资料</h2>
      <p>收藏链接或记录学习笔记。个人资料保存在当前设备，也会随学习备份导出。</p>
      <form className="note garden-resource-form" onSubmit={event => void save(event)}>
        <h3>{editing === undefined ? '添加资料' : '编辑资料'}</h3>
        <p><label className="garden-field">标题 <input value={fields.title} required maxLength={RESOURCE_LIMITS.title} disabled={busy}
          onChange={event => update('title', event.target.value)} /></label></p>
        <p><label className="garden-field">链接（可选） <input type="url" value={fields.url} maxLength={RESOURCE_LIMITS.url} disabled={busy}
          onChange={event => update('url', event.target.value)} /></label></p>
        <p><label className="garden-field">笔记（可选） <textarea value={fields.note} maxLength={RESOURCE_LIMITS.note} disabled={busy}
          onChange={event => update('note', event.target.value)} /></label></p>
        <p className="garden-actions">
          <button type="submit" disabled={busy}>保存资料</button>{' '}
          {editing !== undefined && <button type="button" className="secondary" disabled={busy} onClick={() => {
            resetForm()
            setError('')
            setMessage('')
          }}>取消编辑</button>}
        </p>
      </form>
      {error && <p className="fail" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {items === undefined && !error && <p role="status">正在读取个人资料……</p>}
      {items?.length === 0 && <p>还没有个人资料，可以先添加一条链接或笔记。</p>}
      <ul className="garden-entries">{items?.map(item => (
        <li key={item.id}>
          <h3>{item.title}</h3>
          {item.url && <p><a href={item.url} target="_blank" rel="noreferrer">打开链接</a></p>}
          {item.note && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.note}</p>}
          <p className="garden-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => {
              setEditing(item.id)
              setFields({ title: item.title, url: item.url, note: item.note })
              setError('')
              setMessage('')
            }}>编辑</button>{' '}
            <button type="button" className="secondary" disabled={busy} onClick={() => void remove(item)}>删除</button>
          </p>
        </li>
      ))}</ul>
    </>
  )
}
