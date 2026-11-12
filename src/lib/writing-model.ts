export const WRITING_GUIDE = 'https://exam.topik.go.kr/nasdata/webnas/raonkeditordata/uploadId/2024/02/20240227_175504804_07236.pdf'
export const MANUSCRIPT_GUIDE = 'https://exam.topik.go.kr/nasdata/webnas/raonkeditordata/uploadId/2024/02/20240227_175447974_51977.pdf'

export const WRITING_FORMS = {
  51: { title: '短文填空 · 实用文', instruction: '阅读上下文，在㉠和㉡各填一句，留意语体与语气。', range: null },
  52: { title: '短文填空 · 说明文', instruction: '在㉠和㉡各填一句，使因果或说明自然衔接。', range: null },
  53: { title: '资料说明', instruction: '依据题目资料描述主要变化和对比，避免加入资料未提供的事实。按卷面要求决定是否写标题。', range: [200, 300] },
  54: { title: '主题论述', instruction: '逐项回应题目要求，提出观点并以理由或例子支持，按段组织。避免照抄题干。', range: [600, 700] },
} as const

export function writingForm(order: number) {
  return WRITING_FORMS[order as keyof typeof WRITING_FORMS]
}

export const WRITING_CRITERIA = [
  ['requirements', '逐项回应题目要求'], ['content', '内容充分且忠实于题目材料'],
  ['structure', '结构与论述逻辑清楚'], ['vocabulary', '词汇使用恰当'],
  ['grammar', '检查语法与拼写'], ['cohesion', '句段衔接、语体与表达连贯'],
  ['length', '对照题目与稿纸规则检查篇幅'],
] as const

export interface WritingAssessment { checks: string[]; note: string; updatedAt: string }
export interface WritingDraft {
  questionId: number
  text: string
  seconds: number
  revision: number
  token: string
  updatedAt: string
  lastAttemptId?: number
}

export function compareDrafts(a: WritingDraft, b: WritingDraft) {
  return a.revision - b.revision || a.token.localeCompare(b.token)
}

export function writingCounts(text: string) {
  const chars = [...text.normalize('NFC').replace(/\r\n?/gu, '\n')]
  return { visible: chars.filter(char => !/\s/u.test(char)).length, approximate: chars.filter(char => char !== '\n').length }
}
