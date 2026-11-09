// TOPIK MASTER 2027 — 首页（第一阶段：ANGELIC DREAM GARDEN）
// 一屏完整画面（杂志封面感），不列全部功能：
// 顶部品牌 / 中央主视觉（真实花园摄影 + CSS 雾面/颗粒/光晕）/
// 今日学习区（全部真实数据，无数据时显示空状态，不编造）/
// 四叶草导航（点开展开，10 个入口全部真实可用）/ 底部短句。
// 复习双入口：① 今日学习卡片内「今日待复习」显示真实到期数；
// ② 四叶草内「智能复习」进完整复习页；两处共用 countDue() 与 Review 页。

import { useEffect, useState } from 'react'
import { countDue, getStudyStreak } from '../lib/review'
import { getDayStats, type DayStats } from '../lib/stats'
import { localDateKey } from '../lib/streak'
import { go } from '../lib/router'
import {
  IconBook,
  IconChart,
  IconClover,
  IconHeadphones,
  IconPen,
  IconReading,
  IconReview,
  IconShuffle,
  IconTarget,
  IconTimer,
  IconWriting,
} from '../components/icons'

interface CloverEntry {
  en: string
  zh: string
  icon: React.ReactNode
  to: string
}

const CLOVER_ENTRIES: CloverEntry[] = [
  { en: 'VOCABULARY', zh: '词汇', icon: <IconBook size={22} />, to: '/vocab' },
  { en: 'GRAMMAR', zh: '语法', icon: <IconPen size={22} />, to: '/grammar' },
  { en: 'LISTENING', zh: '听力', icon: <IconHeadphones size={22} />, to: '/practice?qtype=听力' },
  { en: 'READING', zh: '阅读', icon: <IconReading size={22} />, to: '/practice?qtype=阅读' },
  { en: 'WRITING', zh: '写作', icon: <IconWriting size={22} />, to: '/practice?qtype=写作' },
  { en: 'MOCK TEST', zh: '模拟考试', icon: <IconTarget size={22} />, to: '/mock' },
  { en: 'RANDOM PRACTICE', zh: '随机练习', icon: <IconShuffle size={22} />, to: '/practice?mode=random' },
  { en: 'STUDY TIMER', zh: '番茄钟', icon: <IconTimer size={22} />, to: '/focus' },
  { en: 'LEARNING RECORD', zh: '学习记录', icon: <IconChart size={22} />, to: '/stats' },
  { en: 'SMART REVIEW', zh: '智能复习', icon: <IconReview size={22} />, to: '/review' },
]

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatToday(): string {
  const now = new Date()
  return `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAY[now.getDay()]}`
}

export default function Home() {
  const [cloverOpen, setCloverOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState<DayStats | null>(null)
  const [due, setDue] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const today = localDateKey(new Date())
      const [d, dueCount, streakCount] = await Promise.all([
        getDayStats(today),
        countDue(),
        getStudyStreak(),
      ])
      if (cancelled) return
      setDay(d)
      setDue(dueCount)
      setStreak(streakCount)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const hasActivity =
    day !== null && (day.newWords > 0 || day.reviewedWords > 0 || day.minutes > 0)

  // 主视觉：真实花园摄影（public/images/garden-hero.jpg，Unsplash 免费许可，见 README）；
  // 图片加载失败时下层深绿渐变仍在，不会全黑。雾面与颗粒是独立覆盖层，文字在最上层不模糊。
  const heroStyle: React.CSSProperties = {
    backgroundImage: `url(${import.meta.env.BASE_URL}images/garden-hero.jpg), linear-gradient(160deg, #31402f 0%, #202820 55%, #141a14 100%)`,
  }

  return (
    <div className="home">
      <div className="home-band" aria-hidden="true" />
      <header className="home-brand">
        <p className="home-brand-small">ANGELIC DREAM GARDEN</p>
        <h1 className="home-title">
          TOPIK MASTER <span className="home-year">2027</span>
        </h1>
        <p className="home-subtitle">
          <i>“A little dream, a little progress.”</i>
        </p>
        <p className="home-brand-zh">在属于自己的花园里，慢慢积累每一份进步。</p>
      </header>

      <section className="home-hero" style={heroStyle} aria-label="Angel Garden · 暗调花园">
        <div className="home-hero-fog" aria-hidden="true" />
        <div className="home-hero-grain" aria-hidden="true" />
        <p className="home-hero-caption">Angel Garden · 暗调花园</p>
      </section>

      <section className="home-today" aria-label="今日学习计划">
        <div className="home-today-head">
          <h2>
            TODAY&rsquo;S STUDY <span>今日学习计划</span>
          </h2>
          <p className="home-today-date">{formatToday()}</p>
        </div>
        {loading ? (
          <p className="home-today-empty">正在读取今日学习数据……</p>
        ) : (
          <>
            <div className="home-stats">
              <div>
                <b>{day?.newWords ?? 0}</b>
                <span>今日新词</span>
              </div>
              <div>
                <b>{day?.reviewedWords ?? 0}</b>
                <span>今日复习</span>
              </div>
              <div>
                <b>{day?.accuracy === null ? '—' : `${Math.round((day?.accuracy ?? 0) * 100)}%`}</b>
                <span>正确率</span>
              </div>
              <div>
                <b>{day?.minutes ?? 0}</b>
                <span>学习分钟</span>
              </div>
              <div>
                <b>{streak}</b>
                <span>打卡天数</span>
              </div>
            </div>
            {!hasActivity && (
              <p className="home-today-empty">今天还没有学习记录，先从复习或背词开始吧。</p>
            )}
            {due > 0 ? (
              <button type="button" className="home-review-btn" onClick={() => go('/review')}>
                去复习 · 今日待复习 {due} 张
              </button>
            ) : (
              <p className="home-review-done">今日待复习已完成（0 张到期）</p>
            )}
          </>
        )}
      </section>

      <section className="home-clover" aria-label="功能导航">
        <button
          type="button"
          className="home-clover-btn"
          onClick={() => setCloverOpen((v) => !v)}
          aria-expanded={cloverOpen}
        >
          <IconClover size={56} />
          <span>{cloverOpen ? '收起导航' : '四叶草导航 · 点开展开'}</span>
        </button>
        {cloverOpen && (
          <div className="home-clover-panel">
            {CLOVER_ENTRIES.map((e) => (
              <button
                key={e.en}
                type="button"
                className="home-clover-entry"
                onClick={() => go(e.to)}
              >
                <span className="home-clover-icon">{e.icon}</span>
                <span className="home-clover-text">
                  <span className="home-clover-en">{e.en}</span>
                  <span className="home-clover-zh">{e.zh}</span>
                </span>
              </button>
            ))}
            <p className="home-clover-more">
              <button type="button" onClick={() => go('/wrong')}>
                错题复练
              </button>
              {' · '}
              <button type="button" onClick={() => go('/plan')}>
                学习计划
              </button>
              {' · '}
              <button type="button" onClick={() => go('/settings')}>
                设置
              </button>
            </p>
          </div>
        )}
      </section>

      <footer className="home-foot">
        <p className="home-foot-title">A LITTLE NOTE FOR TODAY</p>
        <p className="home-foot-ko">천천히, 하지만 꾸준히.</p>
        <p className="home-foot-zh">慢慢来，但不要停下来。</p>
        <p className="home-foot-meta">TOPIK MASTER 2027 · 本地优先 · 学习数据只存本机</p>
      </footer>
    </div>
  )
}
