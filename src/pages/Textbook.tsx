import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { getTextbookProgress, setTextbookProgress } from '../lib/db'
import {
  TEXTBOOK_LESSON_NUMBERS,
  TEXTBOOK_STATUS_LABELS,
  TEXTBOOK_VOLUMES,
  textbookLessonId,
  type TextbookProgress,
  type TextbookStatus,
} from '../lib/textbook-model'

export default function Textbook({ onBack }: { onBack: () => void }) {
  const [volume, setVolume] = useState(1)
  const [records, setRecords] = useState<TextbookProgress[]>()
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const subscription = liveQuery(() => getTextbookProgress()).subscribe({
      next: setRecords,
      error: () => setError('无法读取教材进度，请重新打开此页。'),
    })
    return () => subscription.unsubscribe()
  }, [])

  const byId = new Map(records?.map(record => [record.id, record.status]))
  const lessons = TEXTBOOK_LESSON_NUMBERS.map(number => {
    const id = textbookLessonId(volume, number)
    return { id, number, status: byId.get(id) ?? 'not-started' }
  })
  const completed = lessons.filter(lesson => lesson.status === 'completed').length
  const nextLesson = lessons.find(lesson => lesson.status === 'in-progress')
    ?? lessons.find(lesson => lesson.status === 'not-started')
  const totalCompleted = records?.filter(record => record.status === 'completed').length ?? 0

  const save = async (id: string, number: number, status: TextbookStatus) => {
    setError('')
    setNote('')
    setSaving(true)
    try {
      await setTextbookProgress(id, status)
      setNote(`已保存第 ${volume} 册第 ${number} 课的状态。`)
    } catch (e) {
      setError(`进度未保存：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" className="secondary" onClick={onBack}>← 返回学习计划</button>
      <h1>教材进度</h1>
      <p>按册记录《新延世韩国语》每课的学习状态。由你手动更新，进度会随学习备份保存。公开版提供编号与进度记录，教材正文和课名请查阅你的教材。</p>
      <p>
        <label htmlFor="textbook-volume">选择教材</label>{' '}
        <select id="textbook-volume" value={volume} onChange={event => {
          setVolume(Number(event.target.value))
          setNote('')
        }}>
          {TEXTBOOK_VOLUMES.map(number => <option key={number} value={number}>第 {number} 册</option>)}
        </select>
      </p>
      {error && <p role="alert" className="fail">{error}</p>}
      {records === undefined && !error && <p role="status">正在读取教材进度……</p>}
      {records !== undefined && (
        <>
          <p>六册合计完成 {totalCompleted} / {TEXTBOOK_VOLUMES.length * TEXTBOOK_LESSON_NUMBERS.length} 课</p>
          <p>第 {volume} 册完成 {completed} / {lessons.length} 课</p>
          <progress aria-label={`第 ${volume} 册完成进度`} value={completed} max={lessons.length} />
          <p>{nextLesson ? `可接着学第 ${nextLesson.number} 课` : '本册所有课程已完成。'}</p>
          {saving ? <p role="status">正在保存……</p> : note && <p role="status">{note}</p>}
          <ul>
            {lessons.map(lesson => (
              <li key={lesson.id}>
                <label htmlFor={lesson.id}>第 {lesson.number} 课状态</label>{' '}
                <select id={lesson.id} value={lesson.status} disabled={saving} onChange={event =>
                  void save(lesson.id, lesson.number, event.target.value as TextbookStatus)
                }>
                  {Object.entries(TEXTBOOK_STATUS_LABELS).map(([status, label]) =>
                    <option key={status} value={status}>{label}</option>,
                  )}
                </select>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
