import SelfTest from './pages/SelfTest'

// TOPIK MASTER 2027 — T0 首页
// 只有项目说明 + 自测入口。词汇浏览、复习页是 T1 及以后任务，T0 不做。
function App() {
  return (
    <>
      <h1>TOPIK MASTER 2027</h1>
      <p>个人韩语 TOPIK 备考系统。目标：2027 年 4 月 TOPIK II，保 4 冲 5。</p>
      <p>
        本地优先：学习数据只存在本机浏览器（IndexedDB），不上传任何第三方。
        发音用浏览器自带韩语语音，复习用 FSRS 算法。
      </p>
      <div className="note">
        当前版本：T0 项目初始化与技术架构验证。词汇、复习、统计功能尚未开发。
        词汇分级规则：不标“官方 TOPIK X 级”，只用 NIKL-A/B/C、TOPIK-초급/중급、课程-X级参考三类来源标注。
      </div>
      <SelfTest />
    </>
  )
}

export default App
