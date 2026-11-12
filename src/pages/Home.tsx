import { DailyStudySummary } from '../components/DailyStudySummary'
import { GardenBrand, GardenNotice } from '../components/GardenUI'
import { StudyReminder } from '../components/StudyReminder'
import { IconChevron } from '../components/icons'

export default function Home({ trial, planError }: { trial: boolean; planError: boolean }) {
  if (trial) return (
    <div className="silver-home trial-home">
      <GardenBrand edition>
        <p className="silver-brand-line">天使花园</p>
        <a className="personal-text-link" href="#/my-plan">制定我的计划 <IconChevron size={15} /></a>
      </GardenBrand>
      <DailyStudySummary><StudyReminder /></DailyStudySummary>
    </div>
  )

  return (
    <div className="silver-home personal-welcome">
      <GardenBrand>
        <p className="silver-brand-line">天使花园</p>
      </GardenBrand>
      <section className="personal-welcome-actions" aria-label="开始学习">
        <svg className="personal-clover" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12c-10 1-10-9-4-8 3 0 4 3 4 8 1-10 11-10 10-4 0 3-4 4-10 4 10 1 10 11 4 10-3 0-4-4-4-10-1 10-11 10-10 4 0-3 4-4 10-4Z" fill="currentColor"/>
        </svg>
        <p>按你的基础和时间，安排每天的韩语学习</p>
        {planError && <GardenNotice tone="error">无法读取本机的学习计划。可先体验课程。</GardenNotice>}
        <a href="#/my-plan" className="personal-primary">制定我的计划</a>
        <a href="#/?view=trial" className="personal-text-link">先体验 <IconChevron size={15} /></a>
      </section>
      <StudyReminder />
    </div>
  )
}
