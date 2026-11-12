// TOPIK MASTER 2027 — 极简 hash 路由（第一阶段）
// GitHub Pages 是纯静态托管，BrowserRouter 刷新 / 直访会 404，
// 故用 hash 路由：URL 形如 …/topik-master-2027/#/vocab，
// hash 永不到服务器，刷新 / 直访 / 浏览器返回全部原生可用，
// 与 PWA 的 navigateFallback 不冲突。不引入 react-router。

export interface Route {
  /** 不含 query 的路径，如 '/vocab'；首页为 '/'。 */
  path: string
  /** hash 中 ? 之后的参数，如 ?qtype=听力。 */
  query: URLSearchParams
}

export const ROUTES = [
  '/',
  '/menu',
  '/my-plan',
  '/today',
  '/week',
 // 首页
  '/vocab',
  '/review',
  '/practice',
  '/reading',
  '/mock',
  '/writing-history',
  '/writing',
  '/wrong',
  '/plan',
  '/textbook',
  '/resources',
  '/stage',
  '/focus',
  '/stats',
  '/settings',
  '/search',
  '/grammar',
] as const

/** 解析当前 location.hash；未知路径回首页。 */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const [pathPart, queryPart] = raw.split('?')
  const path = pathPart === '' ? '/' : pathPart
  const query = new URLSearchParams(queryPart ?? '')
  if ((ROUTES as readonly string[]).includes(path)) {
    return { path, query }
  }
  return { path: '/', query: new URLSearchParams() }
}

/** 跳转：写 location.hash（只改 hash，不刷新页面；浏览器返回键可用）。 */
export function go(path: string): void {
  const target = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`
  if (window.location.hash !== target) {
    window.location.hash = target
  }
}

/** 回首页。 */
export function goHome(): void {
  go('/')
}
