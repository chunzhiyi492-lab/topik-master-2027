// TOPIK MASTER 2027 — 应用入口（第一阶段：hash 路由）
// 原先 9 个 useState 布尔值切换页面，刷新 / 返回 / 直访全部丢失；
// 现改为 hash 路由（见 src/lib/router.ts），刷新与直访均可恢复当前页。
// 各功能页不改数据结构与业务逻辑，只把 onBack 改为回首页。

import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Vocab from './pages/Vocab'
import Review from './pages/Review'
import Stats from './pages/Stats'
import Plan from './pages/Plan'
import Focus from './pages/Focus'
import Practice from './pages/Practice'
import MockExam from './pages/MockExam'
import WrongQuestions from './pages/WrongQuestions'
import Settings from './pages/Settings'
import Grammar from './pages/Grammar'
import { go, parseHash, type Route } from './lib/router'

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function App() {
  const route = useRoute()

  // 进新页面时回到顶部（首页一屏除外，本身无滚动）。
  // 例外：?mode=random 时 Practice 挂载后要定位到随机抽题区，
  // 子组件 effect 先跑、父组件 effect 后跑，这里再 scrollTo(0,0) 会把它顶回顶部。
  useEffect(() => {
    if (route.query.get('mode') === 'random') return
    window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.path])

  const backHome = () => go('/')

  switch (route.path) {
    case '/vocab':
      return <Vocab onBack={backHome} />
    case '/review':
      return <Review onBack={backHome} />
    case '/stats':
      return <Stats onBack={backHome} />
    case '/plan':
      return <Plan onBack={backHome} />
    case '/focus':
      return <Focus onBack={backHome} />
    case '/practice':
      // key 随 query 变化：#/practice?qtype=听力 与 #/practice?mode=random
      // 每次带不同参数进入都重新挂载，初始筛选才生效。
      return (
        <Practice
          key={route.query.toString()}
          onBack={backHome}
          initialQtype={route.query.get('qtype') ?? undefined}
          initialMode={route.query.get('mode') ?? undefined}
        />
      )
    case '/mock':
      return <MockExam onBack={backHome} />
    case '/wrong':
      return <WrongQuestions onBack={backHome} />
    case '/settings':
      return <Settings onBack={backHome} />
    case '/grammar':
      return <Grammar onBack={backHome} />
    case '/':
    default:
      return <Home />
  }
}

export default App
