import { useEffect, useRef, useState } from 'react'
import type { Question } from './db.ts'
import type { WritingDraft } from './writing-model.ts'
import { clearWritingJournal, journalWritingDraft, loadWritingDraft, readWritingJournal, saveWritingDraft } from './writing.ts'

export function useWritingDraft(question: Question, enabled: boolean) {
  const [ready, setReady] = useState(!enabled)
  const [initial, setInitial] = useState<WritingDraft>()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const current = useRef<WritingDraft | undefined>(undefined)
  useEffect(() => {
    if (!enabled || question.id === undefined) return
    let mounted = true
    void loadWritingDraft(question).then(saved => {
      if (!mounted) return
      current.current = saved
      setInitial(saved)
      if (saved) setStatus(`最近保存 ${new Date(saved.updatedAt).toLocaleString()}`)
      setReady(true)
    }).catch(() => {
      if (!mounted) return
      const journal = readWritingJournal(question)
      current.current = journal
      setInitial(journal)
      setError('无法读取数据库草稿。已有应急文本会显示，可复制或重试。')
      setReady(true)
    })
    return () => { mounted = false }
  }, [enabled, question])

  const prepare = (text: string, seconds: number) => {
    const now = Date.now()
    const pending = readWritingJournal(question)
    const draft = { questionId: question.id!, text, seconds: (initial?.seconds ?? 0) + seconds,
      revision: Math.max(now, (current.current?.revision ?? 0) + 1, (pending?.revision ?? 0) + 1),
      token: crypto.randomUUID(), updatedAt: new Date(now).toISOString() }
    current.current = draft
    journalWritingDraft(draft, question)
    setError('')
    setStatus('正在保存草稿……')
    return draft
  }

  const markSaved = (draft: WritingDraft) => {
    clearWritingJournal(question, draft)
    if (current.current?.token === draft.token) setStatus(`最近保存 ${new Date(draft.updatedAt).toLocaleString()}`)
  }

  const persist = async (text: string, seconds: number) => {
    const draft = prepare(text, seconds)
    try {
      const saved = await saveWritingDraft(draft)
      if (saved.token !== draft.token && current.current?.token === draft.token) {
        current.current = saved
        setStatus('草稿未保存')
        setError('其他页面保存了更新版本。当前输入仍可复制，核对后可重新保存。')
        return false
      }
      markSaved(draft)
      return true
    } catch {
      if (current.current?.token === draft.token) {
        setStatus('草稿未保存')
        setError('草稿未写入数据库。输入仍在，可复制或重试。')
      }
      return false
    }
  }
  return { ready, initial, status, error, prepare, markSaved, persist }
}
