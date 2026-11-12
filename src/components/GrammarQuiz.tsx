import { useId, useRef, useState } from 'react'
import { recordGrammarAnswer } from '../lib/db'
import { GRAMMAR_POINTS, type GrammarPoint } from '../lib/grammar-content'
import { buildGrammarQuiz, type GrammarQuizQuestion } from '../lib/grammar-model'

export default function GrammarQuiz({ points, focused }: { points: GrammarPoint[]; focused?: GrammarPoint }) {
  const titleId = useId()
  const [quiz, setQuiz] = useState<GrammarQuizQuestion[]>(() => focused ? buildGrammarQuiz([focused], GRAMMAR_POINTS) : [])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string>()
  const [answered, setAnswered] = useState<boolean>()
  const [correct, setCorrect] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const current = quiz[index]
  const Title = focused ? 'h3' : 'h2'
  const QuestionTitle = focused ? 'h4' : 'h3'

  const start = () => {
    const next = buildGrammarQuiz(points, GRAMMAR_POINTS)
    setError(next.length ? '' : '当前范围没有足够的已收录释义。请换个分册或清除筛选。')
    setQuiz(next)
    setIndex(0)
    setSelected(undefined)
    setAnswered(undefined)
    setCorrect(0)
  }

  const submit = async () => {
    if (!current || selected === undefined || answered !== undefined || saving.current) return
    saving.current = true
    setBusy(true)
    setError('')
    const right = selected === current.meaning
    try {
      await recordGrammarAnswer(current.id, right)
      setAnswered(right)
      if (right) setCorrect(count => count + 1)
    } catch (e) {
      setError(`答案未保存：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return (
    <section className={focused ? 'grammar-v4-quiz grammar-v4-quiz-focused' : 'grammar-v4-quiz study-panel'} aria-labelledby={titleId}>
      <Title id={titleId}>{focused ? '本条语法练习' : '语法释义练习'}</Title>
      <p className="grammar-v4-meta">{focused ? '结合语境辨认本条语法的用法。' : '从当前筛选范围抽取最多 5 道题，只使用已有中文释义。'}</p>
      {error && <p role="alert" className="grammar-v4-feedback">{error}</p>}
      {!current && (
        <>
          {quiz.length > 0 && <p role="status" className="grammar-v4-feedback">练习完成，答对 {correct} / {quiz.length} 道。</p>}
          <button type="button" className="study-primary" onClick={start}>开始语法练习</button>
        </>
      )}
      {current && (
        <>
          <QuestionTitle className="grammar-v4-question">第 {index + 1} / {quiz.length} 题 · <span lang="ko">{current.pattern}</span></QuestionTitle>
          {focused && <p className="grammar-v4-context" lang="ko">{focused.exampleKo}</p>}
          <fieldset className="grammar-v4-options" disabled={busy || answered !== undefined}>
            <legend>选择最符合本条语法的中文释义</legend>
            {current.options.map((option, optionIndex) => (
              <label className="grammar-v4-option" key={option}>
                <input type="radio" name={`${titleId}-meaning`} value={optionIndex} checked={selected === option}
                  onChange={() => setSelected(option)} />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
          {answered !== undefined && <p role="status" className="grammar-v4-feedback">
            {answered ? '答对了。' : '答错了。'}释义：{current.meaning}
          </p>}
          <div className="grammar-v4-actions">
            {answered === undefined ? (
              <button type="button" className="study-primary" disabled={busy || selected === undefined}
                onClick={() => void submit()}>提交语法答案</button>
            ) : (
              <button type="button" className="study-primary" onClick={() => {
                setSelected(undefined)
                setAnswered(undefined)
                setIndex(index + 1)
              }}>{index + 1 === quiz.length ? '查看练习成绩' : '下一道语法题'}</button>
            )}
            <button type="button" className="study-secondary" disabled={busy} onClick={() => {
              setQuiz([])
              setError('')
            }}>退出练习</button>
          </div>
        </>
      )}
    </section>
  )
}
