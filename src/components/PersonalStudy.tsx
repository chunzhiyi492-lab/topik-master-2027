import { useEffect, useRef, useState } from 'react'
import { DailyStudySummary } from './DailyStudySummary'
import { GardenBack, GardenBrand, GardenNotice, GardenPageTitle, GardenProgress } from './GardenUI'
import { IconCalendar, IconChevron, IconClock } from './icons'
import { StudyReminder } from './StudyReminder'
import {
  dateLabel, daysTo, DEFAULT_SETTINGS, goalLabel, GOALS, lessonDetails, LEVELS, moveMissedTasks,
  planWeek, scheduledWeek, validSettings, WEEKDAYS, type PersonalPlan, type PlanSettings, type PlanTask,
} from '../lib/personal-plan'

const GOAL_COPY = {
  beginner: '从韩文读音、常见词汇和简单句子开始。',
  daily: '练习听懂和说清生活里的常用表达。',
  topik: '按阅读、听力和写作科目安排备考。',
}

const WIZARD_STEPS = [
  { label: '目标', title: '你想学到什么？' },
  { label: '基础', title: '你的韩语基础如何？' },
  { label: '时间', title: '你每周有多少时间？' },
  { label: '预览', title: '计划预览' },
]

const LEARNING_MINUTE_PRESETS = [10, 20, 30, 45]

export function PlanWizard({ plan, today, onSave }: {
  plan?: PersonalPlan
  today: string
  onSave: (plan: PersonalPlan) => void
}) {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...plan?.settings }))
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const title = useRef<HTMLHeadingElement>(null)
  const saved = useRef(false)
  const readySettings = settings.goal === 'topik' ? settings : { ...settings, examDate: '' }
  const update = (patch: Partial<PlanSettings>) => {
    setError('')
    setSettings(current => ({ ...current, ...patch }))
  }

  useEffect(() => {
    title.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [step])

  function showStep(nextStep: number) {
    setError('')
    setStep(nextStep)
  }

  function next() {
    if (step === 0 && !validSettings({ ...readySettings, minutes: DEFAULT_SETTINGS.minutes, weekdays: DEFAULT_SETTINGS.weekdays })) {
      setError('请输入有效的个人考试日期，或将日期留空。')
      return
    }
    if (step === 2 && !validSettings(readySettings)) {
      setError('请选择至少一个学习日，并填写 10–120 分钟的整数时长。')
      return
    }
    showStep(step + 1)
  }

  function save() {
    if (saved.current) return
    if (!validSettings(readySettings)) {
      setError('请返回检查学习目标、时长和学习日。')
      return
    }
    saved.current = true
    try {
      onSave({ startsOn: today, completed: [], moved: [], ...plan, settings: readySettings })
    } catch {
      saved.current = false
      setError('计划未保存。请检查浏览器存储后重试。')
    }
  }

  return (
    <section className="personal-page personal-wizard">
      <div className="personal-top">
        {step ? <GardenBack onClick={() => showStep(step - 1)}>上一步</GardenBack>
          : <GardenBack href={plan ? '#/week' : '#/'}>返回</GardenBack>}
        <span className="personal-wizard-meta">{plan ? '调整学习计划' : '制定学习计划'}</span>
      </div>
      <ol className="personal-steps" aria-label="计划步骤">
        {WIZARD_STEPS.map(({ label }, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined} data-done={index < step}>
            <span aria-hidden="true">{index < step ? '✓' : index + 1}</span>{label}
          </li>
        ))}
      </ol>
      <GardenPageTitle titleRef={title}>{WIZARD_STEPS[step].title}</GardenPageTitle>
      {step === 0 && (
        <>
          <p className="personal-caption">选择适合你现在的方向。</p>
          <fieldset className="personal-options">
            <legend className="personal-sr">学习目标</legend>
            {(Object.keys(GOALS) as PlanSettings['goal'][]).map(goal => (
              <label className="personal-choice" key={goal}>
                <input type="radio" name="goal" checked={settings.goal === goal} onChange={() => update({ goal })} />
                <span><strong>{GOALS[goal]}</strong><small>{GOAL_COPY[goal]}</small></span>
                <span className="personal-check" aria-hidden="true">✓</span>
              </label>
            ))}
          </fieldset>
          <p className="personal-field-hint personal-goal-availability">TOPIK I 暂未提供专属计划。</p>
          {settings.goal === 'topik' ? (
            <div className="personal-fields">
              <label>目标等级 <select value={settings.targetLevel} onChange={event => update({ targetLevel: event.target.value })}>
                {['3', '4', '5', '6'].map(level => <option value={level} key={level}>{level} 级</option>)}
              </select></label>
              <label>个人考试日期（可选）
                <input type="date" max="9999-12-31" value={settings.examDate} aria-describedby="personal-exam-date-hint"
                  aria-invalid={error ? true : undefined} onChange={event => update({ examDate: event.target.value })} />
              </label>
              <p id="personal-exam-date-hint" className="personal-field-hint">填写日期后，首页会显示倒计时。</p>
            </div>
          ) : (
            <div className="personal-fields">
              <label>我的学习目标（可选）
                <input value={settings.note} maxLength={60} aria-describedby="personal-goal-hint"
                  onChange={event => update({ note: event.target.value })} placeholder="例如：旅行时能用韩语点餐" />
              </label>
              <p id="personal-goal-hint" className="personal-field-hint">首页会显示这个目标，任务仍按上方所选方向安排。</p>
            </div>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <p className="personal-caption">计划会根据你的基础调整部分学习任务。</p>
          <fieldset className="personal-options">
            <legend className="personal-sr">韩语基础</legend>
            {(Object.keys(LEVELS) as PlanSettings['level'][]).map(level => (
              <label className="personal-choice" key={level}>
                <input type="radio" name="level" checked={settings.level === level} onChange={() => update({ level })} />
                <strong>{LEVELS[level]}</strong><span className="personal-check" aria-hidden="true">✓</span>
              </label>
            ))}
          </fieldset>
        </>
      )}
      {step === 2 && (
        <div className="personal-time-fields">
          <div>
            <label className="personal-field">每天学习时长（分钟）
              <input type="number" inputMode="numeric" min={10} max={120} step={1} value={Number.isNaN(settings.minutes) ? '' : settings.minutes}
                aria-describedby="personal-minutes-hint" onChange={event => update({ minutes: event.target.valueAsNumber })} />
            </label>
            <div className="personal-time-presets" role="group" aria-label="常用学习时长">
              {LEARNING_MINUTE_PRESETS.map(minutes => (
                <button type="button" key={minutes} aria-pressed={settings.minutes === minutes}
                  onClick={() => update({ minutes })}>{minutes} 分钟</button>
              ))}
            </div>
            <p id="personal-minutes-hint" className="personal-field-hint">可直接填写 10–120 分钟。</p>
          </div>
          <fieldset className="personal-days">
            <legend>每周学习日</legend>
            {WEEKDAYS.map((day, index) => (
              <label key={day}>
                <input type="checkbox" checked={settings.weekdays.includes(index)} onChange={event => update({
                  weekdays: event.target.checked ? [...settings.weekdays, index] : settings.weekdays.filter(value => value !== index),
                })} />
                <span>{day}</span><span className="personal-day-check" aria-hidden="true">✓</span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
      {step === 3 && (
        <>
          <div className="personal-preview">
            <div className="personal-summary">
              <strong>{goalLabel(settings)}</strong>
              <p>{LEVELS[settings.level]} · 每天 {settings.minutes} 分钟</p>
              <p>{WEEKDAYS.filter((_, index) => settings.weekdays.includes(index)).join('、')}</p>
              {settings.goal === 'topik' && settings.examDate && <p>个人考试日期 <time dateTime={settings.examDate}>{settings.examDate}</time></p>}
            </div>
            <ol className="personal-week">
              {scheduledWeek(settings, today).map(day => (
                <li key={day.date}>
                  <div className="personal-day-heading"><strong>{day.label}</strong><span>{day.tasks.length ? settings.minutes + ' 分钟' : '休息日'}</span></div>
                  {day.tasks.length > 0 && <p>{day.tasks.map(task => lessonDetails(task.lesson).name).join(' · ')}</p>}
                </li>
              ))}
            </ol>
          </div>
          <GardenNotice>计划保存在当前浏览器。完成任务后可手动标记。</GardenNotice>
        </>
      )}
      {error && <GardenNotice tone="error">{error}</GardenNotice>}
      <div className="personal-controls">
        {step === 3 ? <>
          <button type="button" className="personal-secondary" onClick={() => showStep(0)}>调整设置</button>
          <button type="button" className="personal-primary" onClick={save}>保存计划</button>
        </> : <button key={step} type="button" className="personal-primary" onClick={event => {
          if (event.detail <= 1) next()
        }}>{step === 2 ? '预览计划' : '下一步'}</button>}
      </div>
    </section>
  )
}

function taskList(tasks: PlanTask[], plan: PersonalPlan, onToggle?: (task: PlanTask) => void) {
  const done = new Set(plan.completed.map(task => task.id))
  return (
    <ul className="personal-tasks">
      {tasks.map(task => {
        const lesson = lessonDetails(task.lesson)
        const completed = done.has(task.id)
        return (
          <li key={task.id}>
            <a href={lesson.href}>
              <strong>{lesson.name}</strong><span>{task.minutes} 分钟 <span className="garden-tag" data-complete={completed}>{completed ? '已完成' : '待完成'}</span></span>
              <IconChevron size={15} />
            </a>
            {onToggle && <button type="button" aria-pressed={completed} aria-label={lesson.name + (completed ? '，取消完成' : '，标记完成')}
              onClick={() => onToggle(task)}>{completed ? '✓' : '○'}</button>}
          </li>
        )
      })}
    </ul>
  )
}

export function PlanHome({ plan, today }: { plan: PersonalPlan; today: string }) {
  const day = planWeek(plan, today).find(item => item.date === today)!
  const date = plan.settings.goal === 'topik' ? plan.settings.examDate : ''
  const remaining = date ? daysTo(date, today) : 0
  return (
    <div className="silver-home personalized-home">
      <GardenBrand compact edition>
        <div className="personal-brand-details">
          <p className="personal-goal">{plan.settings.goal === 'topik' ? GOALS.topik : goalLabel(plan.settings)}</p>
          {date && <p className="personal-countdown"><IconCalendar size={16} /><span>个人考试</span>
            <strong>{remaining === 0 ? '考试日' : remaining > 0 ? 'D−' + remaining : '考试日已过'}</strong></p>}
        </div>
      </GardenBrand>
      <section className="personal-home-card" aria-labelledby="personal-home-today">
        <div className="personal-day-heading"><h2 id="personal-home-today">今日学习</h2><span>{dateLabel(today)}</span></div>
        {day.tasks.length > 0 ? <>
          <GardenProgress label="今日任务进度" max={day.tasks.length} value={day.completed}>{day.completed} / {day.tasks.length} 项</GardenProgress>
          {taskList(day.tasks, plan)}
        </> : <GardenNotice>今天是休息日。也可以背单词或复习到期卡片。</GardenNotice>}
        <div className="personal-home-actions">
          {day.tasks.length > 0 && <a href="#/today" className="personal-primary">{day.completed === day.tasks.length ? '查看今日学习' : day.completed ? '继续学习' : '开始今日学习'}</a>}
          <a className="personal-text-link" href="#/week">查看本周计划 <IconChevron size={15} /></a>
        </div>
      </section>
      <DailyStudySummary heading="学习记录" />
      <div className="personal-home-reminder"><StudyReminder /></div>
    </div>
  )
}

export function StudyPlanDay({ plan, today, week, onChange }: {
  plan: PersonalPlan
  today: string
  week: boolean
  onChange: (plan: PersonalPlan) => void
}) {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const days = planWeek(plan, today)
  const current = days.find(day => day.date === today)!
  const missed = days.filter(day => day.date < today).reduce((total, day) => total + day.tasks.length - day.completed, 0)

  function update(next: PersonalPlan) {
    try {
      onChange(next)
      setError('')
      return true
    } catch {
      setError('进度未保存。请检查浏览器存储后重试。')
      return false
    }
  }

  function reschedule() {
    const moved = moveMissedTasks(plan, today)
    if (!moved) {
      setMessage('本周没有剩余的学习日。可先调整计划，再重排任务。')
      return
    }
    if (update(moved)) setMessage('剩余任务已安排到本周接下来的学习日。')
  }

  return (
    <section className="personal-page">
      <div className="personal-top">
        <GardenBack href="#/">首页</GardenBack>
        {week ? <a href="#/my-plan">调整计划</a> : <a href="#/week">本周计划</a>}
      </div>
      <GardenPageTitle>{week ? '本周计划' : '今日学习'}</GardenPageTitle>
      <p className="personal-caption">{week ? dateLabel(days[0].date) + ' – ' + dateLabel(days[6].date) : dateLabel(today)} · {goalLabel(plan.settings)}</p>
      {week && plan.settings.goal === 'topik' && plan.settings.examDate &&
        <p className="personal-caption">个人考试日期 <time dateTime={plan.settings.examDate}>{plan.settings.examDate}</time></p>}
      {week ? <>
        {missed > 0 && <div className="personal-missed"><p>本周有 {missed} 项漏学任务。</p>
          <button type="button" className="personal-secondary" onClick={reschedule}>重排剩余任务</button></div>}
        {message && <GardenNotice tone="status">{message}</GardenNotice>}
        <ol className="personal-week">
          {days.map(day => {
            const status = !day.tasks.length ? (day.date < plan.startsOn ? '计划开始前' : '休息日')
              : day.completed === day.tasks.length ? '已完成'
                : day.date < today ? '漏学' : day.date === today ? '待完成' : '待学习'
            const minutes = day.tasks.reduce((total, task) => total + task.minutes, 0)
            return <li key={day.date}>
              <div className="personal-day-heading">
                <strong>{day.label} <time dateTime={day.date}>{dateLabel(day.date)}</time></strong>
                <span className="garden-tag" data-complete={status === '已完成'}>{day.date === today ? '今天 · ' : ''}{status}</span>
              </div>
              {minutes > 0 && <p><IconClock size={15} />预计 {minutes} 分钟</p>}
              {day.tasks.length > 0 && taskList(day.tasks, plan)}
            </li>
          })}
        </ol>
      </> : current.tasks.length > 0 ? <>
        {taskList(current.tasks, plan, task => {
          const done = plan.completed.some(item => item.id === task.id)
          update({ ...plan, completed: done ? plan.completed.filter(item => item.id !== task.id) : [...plan.completed, task] })
        })}
        <p className="personal-caption">完成一项后，点击任务旁的圆圈记录进度。</p>
      </> : <div className="personal-summary"><strong>今天是休息日</strong><p>可查看本周安排，或调整你的学习日。</p></div>}
      {error && <GardenNotice tone="error">{error}</GardenNotice>}
    </section>
  )
}
