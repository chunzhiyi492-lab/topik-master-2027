import { useState } from 'react'
import SelfTest from './pages/SelfTest'
import Vocab from './pages/Vocab'
import Review from './pages/Review'
import Stats from './pages/Stats'
import Plan from './pages/Plan'
import Focus from './pages/Focus'
import Practice from './pages/Practice'
import MockExam from './pages/MockExam'
import WrongQuestions from './pages/WrongQuestions'
import Settings from './pages/Settings'

// TOPIK MASTER 2027 — T0 首页
// 只有项目说明 + 自测入口。词汇浏览、复习页是 T1 及以后任务，T0 不做。
function App() {
  const [showVocab, setShowVocab] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const [showFocus, setShowFocus] = useState(false)
  const [showPractice, setShowPractice] = useState(false)
  const [showMockExam, setShowMockExam] = useState(false)
  const [showWrongQuestions, setShowWrongQuestions] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  if (showVocab) {
    return <Vocab onBack={() => setShowVocab(false)} />
  }

  if (showReview) {
    return <Review onBack={() => setShowReview(false)} />
  }

  if (showStats) {
    return <Stats onBack={() => setShowStats(false)} />
  }

  if (showPlan) {
    return <Plan onBack={() => setShowPlan(false)} />
  }

  if (showFocus) {
    return <Focus onBack={() => setShowFocus(false)} />
  }

  if (showPractice) {
    return <Practice onBack={() => setShowPractice(false)} />
  }

  if (showMockExam) {
    return <MockExam onBack={() => setShowMockExam(false)} />
  }

  if (showWrongQuestions) {
    return <WrongQuestions onBack={() => setShowWrongQuestions(false)} />
  }

  if (showSettings) {
    return <Settings onBack={() => setShowSettings(false)} />
  }

  return (
    <>
      <h1>TOPIK MASTER 2027</h1>
      <p>个人韩语 TOPIK 备考系统。目标：2027 年 4 月 TOPIK II，保 4 冲 5。</p>
      <p>
        本地优先：学习数据只存在本机浏览器（IndexedDB），不上传任何第三方。
        发音用浏览器自带韩语语音，复习用 FSRS 算法。
      </p>
      <div className="note">
        当前版本：P7 考试闭环与收尾。词汇导入、搜索筛选、每日背词计划、FSRS 复习、随机抽词、
        掌握度标记、收藏与错词本、词条发音、学习统计、打卡日历、每日学习计划、番茄钟、
        TOPIK 目标进度、试题系统模型与导入器、听力音频、阅读计时、写作练习、模拟考试计时、
        答题卡与自动计分、错题复练、本地备份与恢复、离线使用与安装已开发；24 项固定功能全部落地。
        题库为空、等官方真题本地导入。
        词汇分级规则：不标“官方 TOPIK X 级”，只用 NIKL-A/B/C、TOPIK-초급/중급、课程-X级参考三类来源标注。
        全部种子只进待核实池；无中文释义的词显示“待补”，不编造。
      </div>
      <p>
        <button type="button" onClick={() => setShowVocab(true)}>
          词汇
        </button>{' '}
        <button type="button" onClick={() => setShowReview(true)}>
          复习
        </button>{' '}
        <button type="button" onClick={() => setShowStats(true)}>
          统计
        </button>{' '}
        <button type="button" onClick={() => setShowPlan(true)}>
          计划
        </button>{' '}
        <button type="button" onClick={() => setShowFocus(true)}>
          专注
        </button>{' '}
        <button type="button" onClick={() => setShowPractice(true)}>
          练习
        </button>{' '}
        <button type="button" onClick={() => setShowMockExam(true)}>
          模拟考试
        </button>{' '}
        <button type="button" onClick={() => setShowWrongQuestions(true)}>
          错题复练
        </button>{' '}
        <button type="button" onClick={() => setShowSettings(true)}>
          设置（备份 / 离线与安装）
        </button>
      </p>
      <SelfTest />
    </>
  )
}

export default App
