import { db, type Attempt, type TopikDB } from './db.ts'
import { getVocabularyActivity } from './review.ts'
import { calcStreak, localDateKey, studyEventDate } from './streak.ts'
import { calendarWeek, type WeeklyTargets } from './study-goals.ts'
import { isVerifiedObjective } from './scoring.ts'
import { STUDY_STAGES } from './stage-model.ts'

export interface DayStats {
  date: string
  newWords: number
  /** Saved FSRS ratings. A word can be rated more than once. */
  reviewedWords: number
  distinctReviewedWords: number
  correctCount: number
  accuracy: number | null
  minutes: number
  objectiveAnswers: number
  objectiveScored: number
  objectiveCorrect: number
  wrongAnswers: number
  corrections: number
  mockExams: number
  writingAnswers: number
  writingQuestionsCompleted: number
  writingAssessments: number
  stageTests: number
  readingPassages: number
  studied: boolean
}

export interface WeekStats {
  days: DayStats[]
  newWords: number
  reviewedWords: number
  distinctReviewedWords: number
  correctCount: number
  accuracy: number | null
  minutes: number
}

interface ActivityEvent {
  id: string
  kind: 'review' | 'objective' | 'writing' | 'assessment' | 'stage' | 'reading' | 'mock'
  at: string
  title: string
  outcome: string
}

export interface DayActivity {
  summary: DayStats
  objectiveAnswers: number
  objectiveCorrect: number
  writingAnswers: number
  writingQuestionsCompleted: number
  stageTests: number
  readingPassages: number
  events: ActivityEvent[]
}

interface DayBucket {
  summary: DayStats
  reviews: Set<number>
  writing: Set<number>
  events: ActivityEvent[]
}

function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return localDateKey(new Date(y, m - 1, d + delta))
}

function emptyDay(date: string): DayBucket {
  return {
    summary: {
      date, newWords: 0, reviewedWords: 0, distinctReviewedWords: 0, correctCount: 0, accuracy: null,
      minutes: 0, objectiveAnswers: 0, objectiveScored: 0, objectiveCorrect: 0, wrongAnswers: 0,
      corrections: 0, mockExams: 0, writingAnswers: 0, writingQuestionsCompleted: 0,
      writingAssessments: 0, stageTests: 0, readingPassages: 0, studied: false,
    },
    reviews: new Set(), writing: new Set(), events: [],
  }
}

function datesEnding(end: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(end, i - 6))
}

/** Rebuild a projection from saved events. The only available source for focus minutes is the legacy daily total. */
function readActivity(dates: string[], database: TopikDB, detailsDate?: string) {
  return database.transaction('r', [
    database.reviews, database.vocab, database.daily_stats, database.attempts, database.questions,
    database.examSessions, database.stageRuns, database.readingPassages, database.papers,
  ], async () => {
    const [vocabulary, daily, rawAttempts, exams, stages, passages] = await Promise.all([
      getVocabularyActivity(database), database.daily_stats.toArray(), database.attempts.toArray(),
      database.examSessions.where('status').equals('done').toArray(), database.stageRuns.toArray(),
      database.readingPassages.toArray(),
    ])
    const days = new Map(dates.map(date => [date, emptyDay(date)]))
    const audit = { ignoredReviews: vocabulary.ignoredReviews, undatedEvents: 0,
      duplicateDailyRows: 0, duplicateFocusIds: 0, reviewSummaryDifferences: [] as string[] }
    const onDate = (at: Date) => days.get(localDateKey(at))
    const addEvent = (day: DayBucket, at: Date, event: Omit<ActivityEvent, 'at'>) => {
      day.summary.studied = true
      if (day.summary.date === detailsDate) day.events.push({ ...event, at: at.toISOString() })
    }

    const firstReviews = new Map<number, Date>()
    const reviewDays = new Set<string>()
    for (const review of vocabulary.reviews) {
      const at = review.reviewedAt
      const first = firstReviews.get(review.vocabId)
      if (!first || at < first) firstReviews.set(review.vocabId, at)
      reviewDays.add(localDateKey(at))
      const day = onDate(at)
      if (!day) continue
      day.reviews.add(review.vocabId)
      day.summary.reviewedWords++
      if (review.grade === '认识' || review.grade === '很熟') day.summary.correctCount++
      addEvent(day, at, {
        id: 'review-' + review.id, kind: 'review', title: vocabulary.vocab.get(review.vocabId)!.ko, outcome: review.grade,
      })
    }
    for (const at of firstReviews.values()) {
      const day = onDate(at)
      if (day) day.summary.newWords++
    }

    const dailyByDate = new Map<string, typeof daily[number]>()
    const focusIds = new Set<string>()
    for (const row of daily) {
      if (dailyByDate.has(row.date)) audit.duplicateDailyRows++
      else dailyByDate.set(row.date, row)
      for (const id of row.focusSessionIds ?? []) {
        if (focusIds.has(id)) audit.duplicateFocusIds++
        focusIds.add(id)
      }
    }
    for (const [date, day] of days) {
      const row = dailyByDate.get(date)
      const s = day.summary
      s.minutes = Number.isFinite(row?.minutes) && row!.minutes > 0 ? row!.minutes : 0
      s.studied ||= s.minutes > 0
      s.distinctReviewedWords = day.reviews.size
      s.accuracy = s.reviewedWords ? s.correctCount / s.reviewedWords : null
      if ((row?.reviewedWords ?? 0) !== s.reviewedWords || (row?.correctCount ?? 0) !== s.correctCount) {
        audit.reviewSummaryDifferences.push(date)
      }
    }

    const attempts = rawAttempts.flatMap(attempt => {
      const at = studyEventDate(attempt.answeredAt)
      if (!at) audit.undatedEvents++
      return at ? [{ attempt, at }] : []
    }).sort((a, b) => +a.at - +b.at || (a.attempt.id ?? 0) - (b.attempt.id ?? 0))
    const questionIds = [...new Set(rawAttempts.map(attempt => attempt.questionId).filter(Number.isSafeInteger))]
    const questionRows = await database.questions.bulkGet(questionIds)
    const questions = new Map(questionIds.map((id, i) => [id, questionRows[i]]))
    const priorAnswers = new Map<number, Attempt>()
    for (const { attempt, at } of attempts) {
      const question = questions.get(attempt.questionId)
      const title = question?.stem ?? '题目 #' + attempt.questionId
      const day = onDate(at)
      if (attempt.subjective) {
        if (!attempt.selectedAnswer?.trim()) continue
        if (day) {
          day.summary.writingAnswers++
          day.writing.add(attempt.questionId)
          addEvent(day, at, { id: 'attempt-' + attempt.id, kind: 'writing', title, outcome: '已保存作答' })
        }
        continue
      }
      const scored = isVerifiedObjective(question)
      const previous = priorAnswers.get(attempt.questionId)
      if (scored) priorAnswers.set(attempt.questionId, attempt)
      if (!day) continue
      day.summary.objectiveAnswers++
      let outcome = '已作答，未计分'
      if (scored) {
        day.summary.objectiveScored++
        if (attempt.correct) {
          day.summary.objectiveCorrect++
          if (previous?.correct === false) day.summary.corrections++
          outcome = previous?.correct === false ? '答对，已纠正' : '答对'
        } else {
          day.summary.wrongAnswers++
          outcome = '答错'
        }
      }
      addEvent(day, at, { id: 'attempt-' + attempt.id, kind: 'objective', title, outcome })
    }
    for (const attempt of rawAttempts) {
      if (!attempt.subjective || !attempt.selectedAnswer?.trim() || !attempt.writingAssessment) continue
      const at = studyEventDate(attempt.writingAssessment.updatedAt)
      if (!at) audit.undatedEvents++
      const day = at && onDate(at)
      if (at && day) {
        day.summary.writingAssessments++
        addEvent(day, at, { id: 'assessment-' + attempt.id, kind: 'assessment',
          title: questions.get(attempt.questionId)?.stem ?? '写作版本 #' + attempt.id, outcome: '已保存自评' })
      }
    }

    for (const run of stages) {
      if (run.finishedAt == null) continue
      const at = studyEventDate(run.finishedAt)
      if (!at) audit.undatedEvents++
      const day = at && onDate(at)
      if (!at || !day) continue
      day.summary.stageTests++
      addEvent(day, at, { id: 'stage-' + run.id, kind: 'stage', title: STUDY_STAGES[run.stage] + ' · ' + run.paperTitle, outcome: '已交卷' })
    }
    for (const passage of passages) {
      if (passage.finishedAt == null) continue
      const at = studyEventDate(passage.finishedAt)
      if (!at) audit.undatedEvents++
      const day = at && onDate(at)
      if (!at || !day) continue
      day.summary.readingPassages++
      addEvent(day, at, { id: 'reading-' + passage.id, kind: 'reading', title: passage.title, outcome: '已提交篇章' })
    }
    const paperIds = [...new Set(exams.map(exam => exam.paperId))]
    const papers = await database.papers.bulkGet(paperIds)
    const paperTitles = new Map(paperIds.map((id, i) => [id, papers[i]?.title]))
    for (const exam of exams) {
      // updatedAt is when the final transaction observed completion, which may be after the deadline.
      const at = studyEventDate(new Date(Math.min(exam.sectionEndAt, exam.updatedAt)))
      if (!at) audit.undatedEvents++
      const day = at && onDate(at)
      if (!at || !day) continue
      day.summary.mockExams++
      addEvent(day, at, { id: 'mock-' + exam.id, kind: 'mock', title: paperTitles.get(exam.paperId) ?? '试卷 #' + exam.paperId, outcome: '已交卷' })
    }

    for (const day of days.values()) {
      day.summary.writingQuestionsCompleted = day.writing.size
      day.events.sort((a, b) => b.at.localeCompare(a.at))
    }
    return { days, audit, reviewDays: [...reviewDays] }
  })
}

function weekFrom(days: DayBucket[]): WeekStats {
  const stats = days.map(day => day.summary)
  const sum = (key: 'newWords' | 'reviewedWords' | 'correctCount' | 'minutes') =>
    stats.reduce((total, day) => total + day[key], 0)
  const reviewedWords = sum('reviewedWords')
  const correctCount = sum('correctCount')
  return {
    days: stats, newWords: sum('newWords'), reviewedWords, correctCount, minutes: sum('minutes'),
    distinctReviewedWords: new Set(days.flatMap(day => [...day.reviews])).size,
    accuracy: reviewedWords ? correctCount / reviewedWords : null,
  }
}

function activityFrom(day: DayBucket): DayActivity {
  const { objectiveAnswers, objectiveCorrect, writingAnswers, writingQuestionsCompleted, stageTests, readingPassages } = day.summary
  return { summary: day.summary, objectiveAnswers, objectiveCorrect, writingAnswers, writingQuestionsCompleted,
    stageTests, readingPassages, events: day.events }
}

export async function getDayStats(date: string, database: TopikDB = db): Promise<DayStats> {
  const { days } = await readActivity([date], database)
  return days.get(date)!.summary
}

export async function getWeekStats(endDate = localDateKey(new Date()), database: TopikDB = db): Promise<WeekStats> {
  const { days } = await readActivity(datesEnding(endDate), database)
  return weekFrom([...days.values()])
}

export async function getStudyOverview(date: string, database: TopikDB = db) {
  const { days, reviewDays } = await readActivity([date], database)
  return { day: days.get(date)!.summary, streak: calcStreak(reviewDays, new Date(date + 'T12:00:00')) }
}

export async function getStudyGoalActivity(now = new Date(), database: TopikDB = db) {
  const { start, end } = calendarWeek(now)
  const startDate = localDateKey(start)
  const endDate = localDateKey(end)
  const today = localDateKey(now)
  const dates = Array.from({ length: (now.getDay() + 6) % 7 + 1 }, (_, index) => addDays(startDate, index))
  const projection = await readActivity(dates, database)
  const days = [...projection.days.values()].map(({ summary }) => ({ ...summary, practice: summary.objectiveAnswers }))
  const totals: WeeklyTargets = {
    newWords: days.reduce((sum, day) => sum + day.newWords, 0),
    reviews: days.reduce((sum, day) => sum + day.reviewedWords, 0),
    practice: days.reduce((sum, day) => sum + day.practice, 0),
    minutes: days.reduce((sum, day) => sum + day.minutes, 0),
  }
  return { startDate, endDate, days, today: days.find(day => day.date === today)!, totals }
}

export interface MonthCell {
  date: string
  day: number
  isSunday: boolean
  isToday: boolean
  studied: boolean
}

function monthDates(year: number, month: number): string[] {
  return Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) =>
    localDateKey(new Date(year, month - 1, i + 1)))
}

function monthFrom(dates: string[], days: Map<string, DayBucket>, today: string): MonthCell[] {
  return dates.map((date, i) => ({
    date, day: i + 1, isToday: date === today, studied: days.get(date)!.summary.studied,
    isSunday: new Date(date + 'T12:00:00').getDay() === 0,
  }))
}

export async function getMonthCells(year: number, month: number, database: TopikDB = db): Promise<MonthCell[]> {
  const dates = monthDates(year, month)
  const { days } = await readActivity(dates, database)
  return monthFrom(dates, days, localDateKey(new Date()))
}

export async function getDayActivity(date: string, database: TopikDB = db): Promise<DayActivity> {
  const { days } = await readActivity([date], database, date)
  return activityFrom(days.get(date)!)
}

export async function getStatsOverview(today: string, selected: string, database: TopikDB = db) {
  const [year, month] = selected.split('-').map(Number)
  const weekDates = datesEnding(today)
  const monthKeys = monthDates(year, month)
  const { days, reviewDays, audit } = await readActivity([...new Set([...weekDates, ...monthKeys])], database, selected)
  return {
    today, selected, week: weekFrom(weekDates.map(key => days.get(key)!)),
    month: monthFrom(monthKeys, days, today), activity: activityFrom(days.get(selected)!),
    streak: calcStreak(reviewDays, new Date(today + 'T12:00:00')), audit,
  }
}

/** Recalculation and a read-only reconciliation report for the selected date. */
export async function buildDailyExport(date: string, database: TopikDB = db) {
  const { days, audit, reviewDays } = await readActivity(datesEnding(date), database, date)
  const activity = activityFrom(days.get(date)!)
  return {
    app: 'topik-master-2027', exportedAt: new Date().toISOString(), date,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    day: activity.summary, week: weekFrom([...days.values()]),
    streak: calcStreak(reviewDays, new Date(date + 'T12:00:00')), activity, audit,
  }
}
