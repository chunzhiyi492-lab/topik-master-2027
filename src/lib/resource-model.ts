export interface ResourceFields {
  title: string
  url: string
  note: string
}

export interface LearningResource extends ResourceFields {
  id?: number
  updatedAt: string
}

export const RESOURCE_LIMITS = { title: 120, url: 2048, note: 5000 } as const

export const PUBLIC_RESOURCE_LINKS = [
  { title: 'TOPIK 官网', url: 'https://www.topik.go.kr/', description: '考试信息与学习资料入口' },
  { title: '韩国国立国语院基础韩语词典', url: 'https://krdict.korean.go.kr/', description: '查词与例句，提供中韩词典入口' },
  { title: 'Nuri 世宗学堂', url: 'https://nuri.iksi.or.kr/', description: '韩语学习资料' },
]

export function isResourceUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    const url = new URL(value)
    return !!url.hostname && !url.username && !url.password
  } catch {
    return false
  }
}

export function normalizeResource(fields: ResourceFields): ResourceFields {
  const { title, url, note } = { title: fields.title.trim(), url: fields.url.trim(), note: fields.note.trim() }
  if (!title || title.length > RESOURCE_LIMITS.title) throw new Error('标题需为 1–120 个字符')
  if (!url && !note) throw new Error('请填写链接或笔记')
  if (url && (url.length > RESOURCE_LIMITS.url || !isResourceUrl(url))) throw new Error('请填写有效的 HTTP 或 HTTPS 链接')
  if (note.length > RESOURCE_LIMITS.note) throw new Error('笔记最多 5000 个字符')
  return { title, url, note }
}
