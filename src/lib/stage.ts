import { db, type TopikDB } from './db.ts'
import { isVerifiedObjective, scoreItems } from './scoring.ts'
import { isStudyStage, STAGE_MAX_QUESTIONS, type StageRun, type StudyStage } from './stage-model.ts'

export function getStageRuns(database: TopikDB = db): Promise<StageRun[]> {
  return database.stageRuns.orderBy('startedAt').reverse().toArray()
}

export async function startStageRun(stage: StudyStage, paperId: number, database: TopikDB = db): Promise<StageRun> {
  if (!isStudyStage(stage)) throw new Error('请选择有效的阶段')
  return database.transaction('rw', [database.stageRuns, database.papers, database.questions], async () => {
    const active = await database.stageRuns.filter(run => !run.finishedAt).first()
    if (active) return active
    const paper = await database.papers.get(paperId)
    if (!paper) throw new Error('这份试卷已不在题库中')
    const fromPaper = await database.questions.where('paperId').equals(paperId).toArray()
    const questions = fromPaper
      .filter(isVerifiedObjective)
      .sort((a, b) => a.order - b.order || a.id! - b.id!)
      .slice(0, STAGE_MAX_QUESTIONS)
      .map(q => ({
        questionId: q.id!, qtype: q.qtype, stem: q.stem, source: q.source,
        options: q.options, answerIndex: q.answerIndex!, explanation: q.explanation, audio: q.audio,
      }))
    if (questions.length === 0) throw new Error('该试卷没有可评分的客观题，请换一份试卷。')
    const run: StageRun = {
      id: crypto.randomUUID(), stage, paperTitle: paper.title, startedAt: new Date().toISOString(),
      cursor: 0, questions, answers: questions.map(() => null),
    }
    await database.stageRuns.add(run)
    return run
  })
}

async function updateStageRun(
  id: string, update: (run: StageRun) => void, database: TopikDB,
): Promise<void> {
  await database.transaction('rw', database.stageRuns, async () => {
    const run = await database.stageRuns.get(id)
    if (!run) throw new Error('找不到这次阶段测试')
    if (run.finishedAt) return
    update(run)
    await database.stageRuns.put(run)
  })
}

export function moveStageCursor(id: string, index: number, database: TopikDB = db): Promise<void> {
  return updateStageRun(id, run => {
    if (!Number.isInteger(index) || index < 0 || index >= run.questions.length) throw new Error('题号无效')
    run.cursor = index
  }, database)
}

export function saveStageAnswer(id: string, index: number, selected: number, database: TopikDB = db): Promise<void> {
  return updateStageRun(id, run => {
    const question = run.questions[index]
    if (!question || !Number.isInteger(selected) || selected < 0 || selected >= question.options.length) {
      throw new Error('答案无效')
    }
    run.answers[index] = selected
  }, database)
}

export function submitStageRun(id: string, database: TopikDB = db): Promise<void> {
  return updateStageRun(id, run => {
    run.finishedAt = new Date(Math.max(Date.now(), new Date(run.startedAt).getTime())).toISOString()
  }, database)
}

export function discardStageRun(id: string, database: TopikDB = db): Promise<void> {
  return database.transaction('rw', database.stageRuns, async () => {
    const run = await database.stageRuns.get(id)
    if (run && !run.finishedAt) await database.stageRuns.delete(id)
  })
}

export function scoreStageRun(run: StageRun) {
  return scoreItems(run.questions.map((question, index) => ({
    questionId: question.questionId, qtype: question.qtype, objective: true,
    answered: run.answers[index] !== null, correct: run.answers[index] === question.answerIndex,
    subjectiveAnswered: false,
  })))
}
