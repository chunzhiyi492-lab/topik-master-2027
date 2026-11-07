import { useState } from 'react'
import SelfTest from './pages/SelfTest'
import Vocab from './pages/Vocab'
import Review from './pages/Review'
import MetalPrototype from './pages/MetalPrototype'
import CloverDreamcore from './pages/CloverDreamcore'

// TOPIK MASTER 2027 — T0 首页
// 只有项目说明 + 自测入口。词汇浏览、复习页是 T1 及以后任务，T0 不做。
// 冷金属风原型入口（prototype/metal-design 分支）：仅切换显示原型页，不引入路由库；
// 加 ?metal=1 可直接打开原型，方便截图验收。
// 四叶草·梦核原型入口（prototype/clover-dreamcore 分支）：同理，
// 加 ?clover=1 可直接打开原型。两个原型入口共存，互不影响。
function App() {
  const [showVocab, setShowVocab] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showMetal, setShowMetal] = useState(
    () => new URLSearchParams(window.location.search).get('metal') === '1',
  )
  const [showClover, setShowClover] = useState(
    () => new URLSearchParams(window.location.search).get('clover') === '1',
  )

  if (showVocab) {
    return <Vocab onBack={() => setShowVocab(false)} />
  }

  if (showReview) {
    return <Review onBack={() => setShowReview(false)} />
  }

  if (showMetal) {
    return <MetalPrototype onBack={() => setShowMetal(false)} />
  }

  if (showClover) {
    return <CloverDreamcore onBack={() => setShowClover(false)} />
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
        当前版本：P2 复习核心。词汇导入、搜索筛选、每日背词计划、FSRS 复习、随机抽词、
        掌握度标记、收藏与错词本已开发；统计功能尚未开发。
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
        <button type="button" onClick={() => setShowMetal(true)}>
          金属风原型（预览）
        </button>{' '}
        <button type="button" onClick={() => setShowClover(true)}>
          四叶草·梦核原型（预览）
        </button>
      </p>
      <SelfTest />
    </>
  )
}

export default App
