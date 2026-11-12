import { expect, test } from '@playwright/test'

const dbModule = '/topik-master-2027/src/lib/db.ts'
const reviewModule = '/topik-master-2027/src/lib/review.ts'
const FONTS = /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//
const grades = ['不认识', '模糊', '认识', '很熟']

test.beforeEach(async ({ context }) => {
  await context.route(FONTS, route => route.abort())
})

async function seedWords(page, words) {
  await page.goto('./#/vocab')
  return page.evaluate(async ({ dbModule, words }) => {
    const { db } = await import(dbModule)
    return db.vocab.bulkAdd(words.map(word => ({
      pos: '', zh: '', source: '课程参考', source_level: '', yonsei_lesson: '',
      status: '待核实', example_ko: '', example_zh: '', favorite: false, isTestData: false,
      ...word,
    })), { allKeys: true })
  }, { dbModule, words })
}

async function expectNoHorizontalOverflow(page, width) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
}

test('珍珠词卡可用键盘展开，播放韩语，刷新保留收藏并兼容长文本与空内容', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    window.spokenWords = []
    Object.defineProperty(window, 'speechSynthesis', {
      value: Object.assign(new EventTarget(), {
        speaking: false,
        cancel() {},
        getVoices: () => [{ name: '测试韩语', lang: 'ko-KR', localService: true, default: true }],
        speak: utterance => window.spokenWords.push({ text: utterance.text, lang: utterance.lang }),
      }),
    })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        constructor(text) { this.text = text }
      },
    })
  })
  const ko = '한글어휘읽기연습'.repeat(6)
  const zh = '用来核对窄屏换行和连续阅读的中文释义。'.repeat(6)
  const exampleKo = '길을 천천히 걸으며 한국어 단어를 연습해요. '.repeat(5).trim()
  const exampleZh = '我们边慢慢走边练习韩语单词。'.repeat(4)
  await seedWords(page, [{
    ko, zh, pos: '명사', source_level: '课程-2级参考', yonsei_lesson: '1册1课', status: '已核实',
    example_ko: exampleKo, example_zh: exampleZh,
  }, { ko: '빈칸' }])

  const card = page.locator('.pearl-word-card')
  const selectWord = word => page.getByRole('button', { name: '学习此词 ' + word, exact: true }).click()
  await selectWord(ko)
  await expect(card.getByRole('heading', { name: ko, exact: true })).toBeVisible()
  await expect(card).toContainText('명사')
  await expect(card).toContainText('课程参考')
  await expect(card).toContainText('1册1课')

  const speak = card.getByRole('button', { name: '朗读 ' + ko, exact: true })
  await speak.click()
  await expect.poll(() => page.evaluate(() => window.spokenWords)).toEqual([{ text: ko, lang: 'ko-KR' }])

  const reveal = card.getByRole('button', { name: '显示释义', exact: true })
  await expect(reveal).toHaveAttribute('aria-expanded', 'false')
  const panelId = await reveal.getAttribute('aria-controls')
  expect(panelId).toBeTruthy()
  const panel = page.locator('[id="' + panelId + '"]')
  await reveal.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(reveal).toBeFocused()
  await expect.poll(() => reveal.evaluate(button => getComputedStyle(button).outlineStyle)).not.toBe('none')
  await page.keyboard.press('Enter')

  const collapse = card.getByRole('button', { name: '收起释义', exact: true })
  await expect(collapse).toHaveAttribute('aria-expanded', 'true')
  await expect(panel).toContainText(zh)
  await expect(panel.locator('[lang="ko"]')).toContainText(exampleKo)
  await expect(panel).toContainText(exampleZh)
  await expect(collapse).toBeFocused()
  const activeAnimations = await card.evaluate(node => node.getAnimations({ subtree: true }).length)
  expect(activeAnimations).toBe(0)

  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 820 })
    await expectNoHorizontalOverflow(page, width)
    await expect(panel.getByText(exampleZh, { exact: true })).toBeVisible()
  }
  await page.keyboard.press('Space')
  await expect(reveal).toHaveAttribute('aria-expanded', 'false')
  await expect(reveal).toBeFocused()

  await card.getByRole('button', { name: '收藏', exact: true }).click()
  await expect(card.getByRole('button', { name: '取消收藏', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await selectWord(ko)
  await expect(card.getByRole('button', { name: '取消收藏', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.setViewportSize({ width: 320, height: 820 })
  await selectWord('빈칸')
  await expect(card.getByRole('heading', { name: '빈칸', exact: true })).toBeVisible()
  await reveal.click()
  await expect(card).toContainText('待补')
  await expect(card).toContainText('暂无例句')
  await expectNoHorizontalOverflow(page, 320)
})

test('窄屏 FSRS 四档按钮保留原到期映射，连点单张只记一次', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.clock.setFixedTime(new Date('2027-01-15T09:00:00+08:00'))
  const words = ['첫째', '둘째', '셋째', '넷째']
  const ids = await seedWords(page, words.map(ko => ({ ko, zh: '复习测试释义' })))
  const previews = await page.evaluate(async ({ reviewModule, id }) => {
    const { previewGrades, formatDue } = await import(reviewModule)
    return (await previewGrades(id)).map(({ grade, dueAt }) => [grade, { timestamp: dueAt.toISOString(), text: '下次' + formatDue(dueAt) }])
  }, { reviewModule, id: ids[0] })
  const expectedDue = new Map(previews)
  const savedReviews = () => page.evaluate(async dbModule => {
    const { db } = await import(dbModule)
    return (await db.reviews.toArray()).map(({ vocabId, grade, dueAt }) => ({
      vocabId, grade, dueAt: dueAt.toISOString(),
    }))
  }, dbModule)

  await page.goto('./#/review')
  await page.getByRole('button', { name: '到期复习', exact: true }).click()
  const card = page.locator('.pearl-word-card').first()
  const scoring = page.getByRole('group', { name: 'FSRS 四档评分' })
  const buttons = scoring.getByRole('button')
  await expect(buttons).toHaveCount(4)
  await expectNoHorizontalOverflow(page, 320)
  const dimensions = await buttons.evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect()
    return { width: box.width, height: box.height }
  }))
  for (const { width, height } of dimensions) {
    expect(width).toBeGreaterThanOrEqual(44)
    expect(height).toBeGreaterThanOrEqual(44)
  }
  await card.getByRole('button', { name: '显示释义', exact: true }).click()
  await expect(card.getByText('复习测试释义', { exact: true })).toBeVisible()
  expect(await savedReviews()).toEqual([])

  for (const [index, grade] of grades.entries()) {
    await expect(card.getByRole('heading', { name: words[index], exact: true })).toBeVisible()
    const score = scoring.getByRole('button', { name: new RegExp('^' + grade) })
    await expect(score.locator('span')).toHaveText(expectedDue.get(grade).text)
    if (index === 0) {
      await score.evaluate(button => { button.click(); button.click() })
    } else {
      await score.click()
    }
    await expect.poll(savedReviews).toHaveLength(index + 1)
  }
  await page.reload()
  expect(await savedReviews()).toEqual(grades.map((grade, index) => ({
    vocabId: ids[index], grade, dueAt: expectedDue.get(grade).timestamp,
  })))
})

test('公开版对缺少的教材语法显示说明且保留原创条目', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 })
  await page.goto('./#/grammar?point=g1-1-01-03')
  await expect(page.getByRole('heading', { name: '语法学习' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('此语法条目未收录在公开版')
  await expect(page.getByText(/8 条原创语法说明/)).toBeVisible()
  await expect(page.locator('details[open]')).toHaveCount(0)
  await expectNoHorizontalOverflow(page, 320)
})
