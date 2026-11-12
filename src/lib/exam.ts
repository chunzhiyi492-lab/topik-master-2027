import { db, type Attempt, type TopikDB } from './db.ts'
import { canPauseExam, EXAM_PROFILES, SECTION_TYPES, type ExamAnswer, type ExamMode, type ExamSession, type SectionKey } from './exam-model.ts'
import { isVerifiedObjective } from './scoring.ts'

export async function loadExam(database: TopikDB = db): Promise<ExamSession | undefined> {
  return database.transaction('r', database.examSessions, async () =>
    await database.examSessions.where('status').equals('running').first() ??
    await database.examSessions.orderBy('updatedAt').last(),
  )
}

export async function getExamHistory(database: TopikDB = db): Promise<ExamSession[]> {
  return (await database.examSessions.where('status').equals('done').toArray())
    .sort((a, b) => b.updatedAt - a.updatedAt)
}


export async function startExam(
  paperId: number, durations: Record<SectionKey, number>, database: TopikDB = db, now = Date.now(),
  options?: { mode: ExamMode; scope?: SectionKey },
): Promise<ExamSession> {
  return database.transaction('rw', [database.examSessions, database.papers, database.questions], async () => {
    const existing = await database.examSessions.where('status').equals('running').first()
    if (existing) return existing
    if (!await database.papers.get(paperId)) throw new Error('找不到试卷')
    const qs = await database.questions.where('paperId').equals(paperId).toArray()
    qs.sort((a, b) => a.order - b.order || a.id! - b.id!)
    const preset = options && options.mode !== 'practice' ? EXAM_PROFILES[options.mode] : undefined
    const scope = options?.mode === 'practice' ? options.scope : undefined
    const plan = preset?.sections ?? (scope ? [scope] : Object.keys(SECTION_TYPES) as SectionKey[])
      .map(key => ({ key, minutes: durations[key] }))
    const sections = plan.flatMap(({ key, minutes }) => {
      const questionIds = qs.filter(q => q.qtype === SECTION_TYPES[key]).map(q => q.id!)
      if (!questionIds.length) {
        if (preset || scope) throw new Error('试卷缺少' + SECTION_TYPES[key] + '题，请更换试卷或选择可用科目')
        return []
      }
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) throw new Error('环节时长无效')
      return [{ key, minutes, questionIds }]
    })
    if (!sections.length) throw new Error('这份试卷没有听力、阅读或写作题')
    const session: ExamSession = {
      id: crypto.randomUUID(), paperId, status: 'running', sections, sectionIdx: 0, questionIdx: 0,
      sectionStartedAt: now, sectionEndAt: now + sections[0].minutes * 60000,
      updatedAt: now, answers: {}, summaries: [],
      ...(options ? { mode: options.mode, grades: {} } : {}),
      ...(scope ? { scope } : {}),
      otherCount: qs.length - sections.reduce((n, sec) => n + sec.questionIds.length, 0),
    }
    await database.examSessions.add(session)
    return session
  })
}

function currentSection(session: ExamSession | undefined, sectionIdx: number): ExamSession {
  if (!session || session.status !== 'running' || session.sectionIdx !== sectionIdx) {
    throw new Error('考试环节已变化，请重新打开模考以载入当前进度')
  }
  return session
}

export async function saveExamAnswer(
  sessionId: string, sectionIdx: number, questionId: number, answer: ExamAnswer,
  database: TopikDB = db, now = Date.now(),
): Promise<ExamSession> {
  return database.transaction('rw', [database.examSessions, database.questions], async () => {
    const session = currentSection(await database.examSessions.get(sessionId), sectionIdx)
    if (session.pausedAt !== undefined) throw new Error('练习已暂停')
    if (now < session.sectionStartedAt || now >= session.sectionEndAt) throw new Error('本环节已结束，未保存这次输入')
    if (!session.sections[sectionIdx].questionIds.includes(questionId)) throw new Error('题目不在当前环节')
    const q = await database.questions.get(questionId)
    if (!q || q.paperId !== session.paperId) throw new Error('题目已不可用')
    if (q.options.length > 0) {
      if (!Number.isInteger(answer.selected) || answer.selected! < 0 || answer.selected! >= q.options.length ||
          answer.text !== undefined || answer.seconds !== undefined) throw new Error('选项无效')
    } else if (q.qtype !== '写作' || typeof answer.text !== 'string' ||
               !Number.isSafeInteger(answer.seconds) || answer.seconds! < 0 || answer.selected !== undefined) {
      throw new Error('写作答案无效')
    }
    if ((session.answers[questionId]?.enteredAt ?? -1) > now) return session
    session.answers[questionId] = { ...answer, enteredAt: now }
    session.updatedAt = Math.max(session.updatedAt, now)
    await database.examSessions.put(session)
    return session
  })
}

export async function moveExamCursor(
  sessionId: string, sectionIdx: number, questionIdx: number, database: TopikDB = db, now = Date.now(),
): Promise<ExamSession> {
  return database.transaction('rw', database.examSessions, async () => {
    const session = currentSection(await database.examSessions.get(sessionId), sectionIdx)
    if (!Number.isInteger(questionIdx) || questionIdx < 0 ||
        questionIdx >= session.sections[sectionIdx].questionIds.length) throw new Error('题号无效')
    session.questionIdx = questionIdx
    session.updatedAt = Math.max(session.updatedAt, now)
    await database.examSessions.put(session)
    return session
  })
}

export async function checkpointExam(
  sessionId: string, sectionIdx: number, now: number, database: TopikDB = db,
): Promise<void> {
  await database.transaction('rw', database.examSessions, async () => {
    const session = await database.examSessions.get(sessionId)
    if (session?.status === 'running' && session.sectionIdx === sectionIdx &&
        session.pausedAt === undefined && now > session.updatedAt) {
      session.updatedAt = now
      await database.examSessions.put(session)
    }
  })
}

export async function setExamPaused(
  sessionId: string, sectionIdx: number, paused: boolean, now: number, database: TopikDB = db,
): Promise<ExamSession> {
  return database.transaction('rw', database.examSessions, async () => {
    const session = currentSection(await database.examSessions.get(sessionId), sectionIdx)
    if (!canPauseExam(session)) throw new Error('只有单科练习可以暂停')
    now = Math.max(now, session.updatedAt)
    if (paused && session.pausedAt === undefined) {
      if (now >= session.sectionEndAt) throw new Error('练习时间已结束')
      session.pausedAt = now
    } else if (!paused && session.pausedAt !== undefined) {
      const elapsed = now - session.pausedAt
      session.sectionStartedAt += elapsed
      session.sectionEndAt += elapsed
      delete session.pausedAt
    } else {
      return session
    }
    session.updatedAt = now
    await database.examSessions.put(session)
    return session
  })
}

export async function submitExamSection(
  sessionId: string, expectedSection: number, database: TopikDB = db, now = Date.now(),
): Promise<ExamSession> {
  return database.transaction('rw', [database.examSessions, database.questions, database.attempts], async () => {
    const session = await database.examSessions.get(sessionId)
    if (!session) throw new Error('找不到考试会话')
    // 同一环节已经提交：重试、超时或另一标签页都只能读回结果。
    if (session.summaries.length > expectedSection) return session
    currentSection(session, expectedSection)
    if (session.pausedAt !== undefined) throw new Error('请先继续练习，再交卷')
    now = Math.max(now, session.updatedAt)
    const section = session.sections[expectedSection]
    const qs = await database.questions.bulkGet(section.questionIds)
    const rows: Attempt[] = []
    let answered = 0
    const grades = session.grades ??= {}
    const submittedAt = Math.min(now, session.sectionEndAt)
    const answeredAt = new Date(submittedAt)
    for (const q of qs) {
      if (!q || q.paperId !== session.paperId) throw new Error('试卷已变更，无法提交本环节')
      const a = session.answers[q.id!]
      if (a?.selected !== undefined || a?.text?.trim()) answered++
      grades[q.id!] = q.qtype === '写作' && !q.options.length
        ? (a?.text?.trim() ? 'written' : 'unwritten')
        : !isVerifiedObjective(q) ? 'excluded'
          : a?.selected === undefined ? 'unanswered'
            : a.selected === q.answerIndex ? 'correct' : 'wrong'
      if (!a || grades[q.id!] === 'excluded') continue
      const common = { questionId: q.id!, paperId: session.paperId, answeredAt }
      if (a.selected !== undefined) {
        const selectedAnswer = q.options[a.selected]
        if (selectedAnswer === undefined) throw new Error('题目选项已变更，无法提交')
        rows.push({ ...common, selectedAnswer, correct: a.selected === q.answerIndex })
      } else if (a.text?.trim()) {
        rows.push({ ...common, selectedAnswer: a.text, correct: false, subjective: true, writingSeconds: a.seconds ?? 0 })
      }
    }
    await database.attempts.bulkAdd(rows)
    session.summaries.push({
      key: section.key, label: SECTION_TYPES[section.key], answered,
      unanswered: section.questionIds.length - answered,
      seconds: Math.floor(Math.max(0, Math.min(now, session.sectionEndAt) - session.sectionStartedAt) / 1000),
    })
    if (expectedSection + 1 === session.sections.length) {
      session.status = 'done'
    } else {
      session.sectionIdx += 1
      session.questionIdx = 0
      session.sectionStartedAt = submittedAt
      session.sectionEndAt = session.sectionStartedAt + session.sections[session.sectionIdx].minutes * 60000
    }
    session.updatedAt = now
    await database.examSessions.put(session)
    return session
  })
}

export async function submitExpiredExam(
  session: ExamSession, now: number, database: TopikDB = db,
): Promise<ExamSession> {
  while (session.status === 'running' && session.pausedAt === undefined && now >= session.sectionEndAt) {
    session = await submitExamSection(session.id, session.sectionIdx, database, now)
  }
  return session
}