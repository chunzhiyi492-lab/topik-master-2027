// TOPIK MASTER 2027 — 应用入口（第一阶段：hash 路由）
// 原先 9 个 useState 布尔值切换页面，刷新 / 返回 / 直访全部丢失；
// 现改为 hash 路由（见 src/lib/router.ts），刷新与直访均可恢复当前页。
// 各功能页不改数据结构与业务逻辑，只把 onBack 改为回首页。

import { Component, lazy, Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import Home from './pages/Home'
import { StudyDirectory, StudyNavigation, type StudyTab } from './components/StudyNavigation'
import { GardenNotice } from './components/GardenUI'
import { PlanHome, PlanWizard, StudyPlanDay } from './components/PersonalStudy'
import { loadPersonalPlan, PERSONAL_PLAN_KEY, storePersonalPlan, type PersonalPlan } from './lib/personal-plan'
import { useStudyDay } from './lib/study-clock'
import './silver-home.css'
import './garden-feature.css'
import Vocab from './pages/Vocab'
import Review from './pages/Review'
import Stats from './pages/Stats'
import Plan from './pages/Plan'
import Focus from './pages/Focus'
import Practice from './pages/Practice'
import MockExam from './pages/MockExam'
import WrongQuestions from './pages/WrongQuestions'
import Settings from './pages/Settings'
import Textbook from './pages/Textbook'
import Resources from './pages/Resources'
import StageTest from './pages/StageTest'
import WritingHistory from './pages/WritingHistory'
import { go, parseHash, type Route } from './lib/router'

const Grammar = lazy(() => import('./pages/Grammar'))
const Search = lazy(() => import('./pages/Search'))
const Reading = lazy(() => import('./pages/Reading'))
const Writing = lazy(() => import('./pages/Writing'))

class DeferredPage extends Component<{ children: ReactNode; onBack: () => void }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <>
          <p role="alert">暂时无法加载此页。请联网后重试。</p>
          <button type="button" onClick={() => window.location.reload()}>重试加载</button>{' '}
          <button type="button" className="secondary" onClick={this.props.onBack}>返回首页</button>
        </>
      )
    }
    return <Suspense fallback={<p role="status">正在加载页面……</p>}>{this.props.children}</Suspense>
  }
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function readPlan() {
  try {
    return { plan: loadPersonalPlan(), error: false }
  } catch {
    return { plan: undefined, error: true }
  }
}

function subscribeToConnection(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function GardenShell({ active, home, children }: { active: StudyTab; home?: boolean; children: ReactNode }) {
  const online = useSyncExternalStore(subscribeToConnection, () => navigator.onLine)
  return (
    <div className={home ? 'silver-shell silver-shell-home' : 'silver-shell'}>
      <main>
        {!online && <div className="garden-connection"><GardenNotice tone="status">当前离线，仍可使用本机已缓存的学习内容。</GardenNotice></div>}
        {children}
      </main>
      <StudyNavigation active={active} />
    </div>
  )
}

function App() {
  const route = useRoute()
  const today = useStudyDay()
  const [{ plan, error: planError }, setPlan] = useState(readPlan)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PERSONAL_PLAN_KEY || event.key === null) setPlan(readPlan())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (route.query.get('mode') !== 'random') window.scrollTo(0, 0)
  }, [route.path, route.query])

  function savePlan(next: PersonalPlan) {
    if (planError) throw new Error('Existing plan could not be read')
    storePersonalPlan(next)
    setPlan({ plan: next, error: false })
  }

  if (route.path === '/' || route.path === '/menu') {
    const group = route.query.get('section')
    const section = group === 'exam' || group === 'profile' ? group : 'study'
    const isHome = route.path === '/'
    return (
      <GardenShell active={isHome ? 'home' : section} home={isHome}>
        {isHome ? plan ? <PlanHome plan={plan} today={today} />
          : <Home trial={route.query.get('view') === 'trial'} planError={planError} />
          : <StudyDirectory section={section} />}
      </GardenShell>
    )
  }

  if (['/my-plan', '/today', '/week'].includes(route.path)) {
    const wizard = route.path === '/my-plan' || !plan
    return (
      <GardenShell active={route.path === '/week' ? 'profile' : 'study'}>
        {wizard
          ? <PlanWizard plan={plan} today={today} onSave={next => { savePlan(next); go('/') }} />
          : <StudyPlanDay key={route.path} plan={plan} today={today} week={route.path === '/week'} onChange={savePlan} />}
      </GardenShell>
    )
  }

  const gardenFeature = [
    '/reading', '/writing', '/writing-history',
    '/practice', '/wrong', '/mock',
    '/stats', '/focus', '/plan',
    '/settings', '/search', '/resources',
  ].includes(route.path)
  const pageClass = gardenFeature ? 'app-content garden-feature garden-feature--' + route.path.slice(1) : 'app-content'
  return <main className={pageClass}><FeaturePage route={route} plan={plan} /></main>
}

function FeaturePage({ route, plan }: { route: Route; plan?: PersonalPlan }) {
  const backHome = () => go('/')

  switch (route.path) {
    case '/vocab':
      return <Vocab key={route.query.toString()} onBack={backHome} initialKeyword={route.query.get('q') ?? ''} />
    case '/review':
      return <Review onBack={backHome} />
    case '/stats':
      return <Stats onBack={backHome} />
    case '/plan':
      return <Plan onBack={backHome} personalPlan={plan} />
    case '/textbook':
      return <Textbook onBack={() => go('/plan')} />
    case '/resources':
      return <Resources onBack={() => go('/plan')} />
    case '/stage':
      return <StageTest onBack={() => go('/plan')} />
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
          initialQuestion={route.query.get('question') ?? undefined}
        />
      )
    case '/mock':
      return <MockExam onBack={backHome} />
    case '/reading':
      return <DeferredPage key="reading" onBack={backHome}><Reading passageId={route.query.get('passage') ?? undefined} /></DeferredPage>
    case '/writing-history':
      return <WritingHistory onBack={() => go('/practice')} />
    case '/writing':
      return <DeferredPage key="writing" onBack={backHome}><Writing /></DeferredPage>
    case '/wrong':
      return <WrongQuestions onBack={backHome} />
    case '/settings':
      return <Settings onBack={backHome} />
    case '/grammar':
      return <DeferredPage key="grammar" onBack={backHome}>
        <Grammar key={route.query.toString()} onBack={backHome} initialPoint={route.query.get('point') ?? undefined} />
      </DeferredPage>
    case '/search':
      return <DeferredPage key="search" onBack={backHome}><Search onBack={backHome} /></DeferredPage>
    case '/':
    default:
      return null
  }
}

export default App
