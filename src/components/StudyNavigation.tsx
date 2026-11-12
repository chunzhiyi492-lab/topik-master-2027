import { useEffect, useRef } from 'react'
import { IconChevron, IconExam, IconHome, IconProfile, IconReading, IconRepeat } from './icons'
import { GardenPageTitle } from './GardenUI'

const GROUPS = {
  study: {
    label: '学习',
    links: [
      ['/vocab', '单词与收藏'],
      ['/grammar', '语法学习'],
      ['/practice?qtype=听力', '听力训练'],
      ['/reading', '阅读篇章'],
      ['/writing', '写作练习'],
      ['/focus', '番茄钟'],
      ['/resources', '学习资料库'],
    ],
  },
  exam: {
    label: '考试',
    links: [
      ['/mock', '模拟考试'],
      ['/practice', '真题练习与题目收藏'],
      ['/practice?mode=random', '随机刷题'],
      ['/stage', '阶段测试'],
      ['/wrong', '错题复练'],
    ],
  },
  profile: {
    label: '个人中心',
    links: [
      ['/week', '本周计划'],
      ['/stats', '学习统计与日历'],
      ['/plan', '学习计划与目标'],
      ['/textbook', '教材进度'],
      ['/writing-history', '写作历史与自评'],
      ['/search', '全局搜索'],
      ['/settings', '设置与备份'],
    ],
  },
} as const

const TABS = [
  { id: 'home', label: '首页', href: '#/', icon: IconHome },
  { id: 'study', label: '学习', href: '#/menu?section=study', icon: IconReading },
  { id: 'review', label: '复习', href: '#/review', icon: IconRepeat },
  { id: 'exam', label: '考试', href: '#/menu?section=exam', icon: IconExam },
  { id: 'profile', label: '个人中心', href: '#/menu?section=profile', icon: IconProfile },
] as const

export type StudyTab = 'home' | keyof typeof GROUPS

export function StudyNavigation({ active }: { active: StudyTab }) {
  return (
    <nav className="silver-nav" aria-label="主导航">
      <ul>
        {TABS.map(({ id, label, href, icon: Icon }) => (
          <li key={id}>
            <a href={href} aria-current={id === active ? 'page' : undefined}>
              <span className="silver-nav-icon"><Icon size={22} /></span>
              <span>{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function StudyDirectory({ section }: { section: keyof typeof GROUPS }) {
  const { label, links } = GROUPS[section]
  const title = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    title.current?.focus({ preventScroll: true })
  }, [section])

  return (
    <section className="silver-directory" aria-labelledby="directory-title">
      <GardenPageTitle id="directory-title" titleRef={title}>{label}</GardenPageTitle>
      <ul>
        {links.map(([path, name]) => (
          <li key={path}>
            <a href={'#' + path}>{name}<IconChevron size={16} /></a>
          </li>
        ))}
      </ul>
    </section>
  )
}
