import { liveQuery } from 'dexie'
import { useEffect, useMemo, useState } from 'react'
import { GRAMMAR_POINTS as mainPoints, matchesGrammar } from '../lib/grammar-content'
import { getGrammarFavorites, getGrammarStudy, setGrammarFavorite, setGrammarLearned } from '../lib/db'
import type { GrammarStudy } from '../lib/grammar-model'
import { GardenBack, GardenPageTitle } from '../components/GardenUI'
import GrammarQuiz from '../components/GrammarQuiz'
import { IconChevron } from '../components/icons'
import { StudyHeart } from '../components/StudyCard'
import '../grammar-v4.css'

export default function Grammar({ onBack, initialPoint }: { onBack: () => void; initialPoint?: string }) {
  const [stage, setStage] = useState('全部')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [focusedId, setFocusedId] = useState<string>()
  const initialPattern = mainPoints.find(point => point.id === initialPoint)?.pattern
  const [keyword, setKeyword] = useState(initialPattern ?? '')
  const [study, setStudy] = useState<GrammarStudy[]>()
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const subscription = liveQuery(() => Promise.all([getGrammarStudy(), getGrammarFavorites()])).subscribe({
      next: ([progress, favorites]) => { setStudy(progress); setFavoriteIds(favorites) },
      error: () => setError('无法读取语法学习状态，请重新打开语法页。'),
    })
    return () => subscription.unsubscribe()
  }, [])

  const studyById = new Map(study?.map(item => [item.id, item]))
  const learnedCount = mainPoints.filter(point => studyById.get(point.id)?.learned).length
  const saveGrammar = async (save: () => Promise<void>) => {
    setMarking(true)
    setError('')
    try {
      await save()
    } catch (e) {
      setError(`语法记录未保存：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setMarking(false)
    }
  }

  const filtered = useMemo(() => {
    return mainPoints.filter(p => (stage === '全部' || p.stage === stage) &&
      (!favoritesOnly || favoriteIds.includes(p.id)) &&
      (keyword === initialPattern ? p.id === initialPoint : matchesGrammar(p, keyword)))
  }, [stage, keyword, favoritesOnly, favoriteIds, initialPattern, initialPoint])

  return (
    <div className="v4-study v4-grammar">
      <header className="grammar-v4-header">
        <GardenBack onClick={onBack}>返回首页</GardenBack>
        <GardenPageTitle>语法学习</GardenPageTitle>
        <p>公开版收录原创语法说明与例句。教材摘录及分册检索在此版本不可用。</p>
        <div className="grammar-v4-overview">
          <span><strong>{mainPoints.length}</strong> 条原创语法说明</span>
        </div>
        {initialPoint && initialPattern === undefined && (
          <p className="grammar-v4-feedback" role="status">此语法条目未收录在公开版。已保存的学习记录仍可通过原版本查看。</p>
        )}
        {study && <p className="grammar-v4-progress">已标记学完 {learnedCount} / {mainPoints.length} 个语法点。</p>}
      </header>
      <section className="grammar-v4-filters study-panel" aria-label="查找语法">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索语法、释义、例句或场景"
          aria-label="搜索语法"
        />
        <div className="grammar-v4-selects">
          <label>学习阶段
            <select value={stage} aria-label="按学习阶段筛选" onChange={event => setStage(event.target.value)}>
              {['全部', '初级', '中级', '高级'].map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <label className="grammar-v4-check"><input type="checkbox" checked={favoritesOnly} onChange={event => setFavoritesOnly(event.target.checked)} /> 仅看语法收藏</label>
      </section>
      {error && <p className="grammar-v4-feedback" role="alert">{error}</p>}
      <div className="grammar-v4-layout">
        <GrammarQuiz points={filtered} />
        <section className="grammar-v4-library" aria-labelledby="grammar-library-title">
          <header className="grammar-v4-list-head">
            <h2 id="grammar-library-title">语法条目</h2>
            <span>共 {filtered.length} 点</span>
          </header>
          {filtered.length === 0 && <div className="grammar-v4-empty study-panel">
            <p>没有符合条件的语法点。</p>
            <button className="study-secondary" type="button" onClick={() => {
              setKeyword('')
              setStage('全部')
              setFavoritesOnly(false)
            }}>清除筛选</button>
          </div>}
          <div className="grammar-v4-list">
            {filtered.map(p => {
              const progress = studyById.get(p.id)
              const saved = favoriteIds.includes(p.id)
              return (
                <details key={p.id} className="grammar-v4-item" open={p.id === initialPoint ? true : undefined}>
                  <summary>
                    <span className="grammar-v4-item-head">
                      <strong lang="ko">{p.pattern}</strong>
                      <span className="grammar-v4-meta">{p.stage}</span>
                    </span>
                    <IconChevron size={17} className="grammar-v4-chevron" />
                  </summary>
                  <div className="grammar-v4-detail">
                    <p className="grammar-v4-meaning">{p.meaningZh}</p>
                    <div className="grammar-v4-supplement">
                      <p><strong>使用场景：</strong>{p.usageZh}</p>
                      <p><strong>原创例句：</strong><span lang="ko">{p.exampleKo}</span> · {p.exampleZh}</p>
                      <p className="grammar-v4-meta">释义与场景参考 <a href={p.sourceUrl} target="_blank" rel="noreferrer">韩国国立国语院《韩国语基础词典》</a> 编写。</p>
                    </div>
                    <div className="grammar-v4-record">
                      <label className="grammar-v4-check"><input type="checkbox" checked={progress?.learned ?? false}
                        disabled={marking || !study} onChange={event => {
                          const learned = event.target.checked
                          void saveGrammar(() => setGrammarLearned(p.id, learned))
                        }} /> 标记已学</label>
                      {!!progress?.attempts && <span className="grammar-v4-meta">练习答对 {progress.correct} / {progress.attempts} 次</span>}
                    </div>
                    <div className="grammar-v4-actions">
                      <StudyHeart saved={saved} disabled={marking || !study}
                        label={saved ? '取消收藏语法' : '收藏语法'} showLabel
                        onClick={() => void saveGrammar(() => setGrammarFavorite(p.id, !saved))} />
                      {p.meaningZh && <button type="button" className="study-secondary" aria-expanded={focusedId === p.id}
                        onClick={() => setFocusedId(focusedId === p.id ? undefined : p.id)}>
                        {focusedId === p.id ? '收起关联练习' : '练习这条语法'}
                      </button>}
                    </div>
                    {focusedId === p.id && <GrammarQuiz points={[p]} focused={p} />}
                  </div>
                </details>
              )
            })}
          </div>
        </section>
      </div>
      <footer className="grammar-v4-source">
        <p>学习阶段为项目参考。语法收藏、已学记录与练习成绩保存在本机。</p>
      </footer>
    </div>
  )
}
