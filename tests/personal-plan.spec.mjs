import { expect, test } from '@playwright/test'
import { join } from 'node:path'

test.use({ timezoneId: 'Asia/Shanghai', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })

const monday = new Date('2027-01-04T04:00:00Z')

async function screenshot(page, name) {
  if (process.env.TOPIK_SCREENSHOTS) {
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.screenshot({ path: join(process.env.TOPIK_SCREENSHOTS, name + '.png'), fullPage: true })
  }
}

const cases = [
  { name: '零基础入门', level: '刚开始学韩语', minutes: '15', task: '韩文入门词汇', path: '#/vocab' },
  { name: '日常韩语', level: '会读韩文，学过基础词句', minutes: '25', note: '旅行时能用韩语点餐', task: '学习新词', path: '#/vocab' },
  { name: 'TOPIK II 备考', level: '能读简单文章，想继续提高', minutes: '40', date: '2027-04-01', task: '阅读篇章', path: '#/reading' },
]

for (const profile of cases) {
  test(profile.name + '可制定、预览、保存并继续自己的学习计划', async ({ page, context }) => {
    await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => route.abort())
    await page.clock.setFixedTime(monday)
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'TOPIK MASTER', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '先体验' })).toBeVisible()
    if (profile.date) await screenshot(page, '01-home-new')
    await page.getByRole('link', { name: '制定我的计划' }).click()
    const option = page.getByRole('radio', { name: new RegExp(profile.name) })
    await page.getByText(profile.name, { exact: true }).click()
    await expect(option).toBeChecked()
    if (profile.note) await page.getByLabel('我的学习目标').fill(profile.note)
    if (profile.date) {
      await page.getByLabel('目标等级').selectOption('5')
      await page.getByLabel('个人考试日期').fill(profile.date)
      await screenshot(page, '02a-plan-goal')
    }
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByText(profile.level, { exact: true }).click()
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByLabel('每天学习时长').fill(profile.minutes)
    await page.getByText('周五', { exact: true }).click()
    await page.getByText('周六', { exact: true }).click()
    if (profile.date) await screenshot(page, '02-plan-settings')
    await page.getByRole('button', { name: '预览计划' }).click()
    await expect(page.getByRole('heading', { name: '计划预览' })).toBeFocused()
    await expect(page.getByText('周一、周二、周三、周四、周六', { exact: true })).toBeVisible()
    await expect(page.getByText(new RegExp('每天 ' + profile.minutes + ' 分钟'))).toBeVisible()
    await expect(page.getByText('休息日', { exact: true })).toHaveCount(2)
    if (profile.date) {
      await expect(page.getByText('TOPIK II 备考 · 目标 5 级', { exact: true })).toBeVisible()
      await expect(page.locator('time[datetime="' + profile.date + '"]')).toBeVisible()
      await screenshot(page, '03-plan-preview')
    }
    await page.getByRole('button', { name: '保存计划' }).click()
    await page.reload()
    await expect(page.getByText(profile.note ?? profile.name, { exact: true })).toBeVisible()
    if (profile.date) {
      await expect(page.getByText('D−87', { exact: true })).toBeVisible()
      await screenshot(page, '04-home-with-plan')
    } else {
      await expect(page.locator('.personal-countdown')).toHaveCount(0)
    }
    const lesson = page.getByRole('link', { name: new RegExp(profile.task) })
    await expect(lesson).toHaveAttribute('href', profile.path)
    await lesson.click()
    await expect(page).toHaveURL(url => url.hash === profile.path)
    await page.goBack()
    await page.getByRole('link', { name: '开始今日学习' }).click()
    await expect(page.getByRole('heading', { name: '今日学习', exact: true })).toBeVisible()
    await page.getByRole('button', { name: profile.task + '，标记完成' }).click()
    await expect(page.getByRole('button', { name: profile.task + '，取消完成' })).toHaveAttribute('aria-pressed', 'true')
    if (profile.date) await screenshot(page, '05-today')
    await page.reload()
    await expect(page.getByRole('button', { name: profile.task + '，取消完成' })).toBeVisible()
    if (profile.date) {
      await page.clock.setFixedTime(new Date('2027-01-05T04:00:00Z'))
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await page.getByRole('link', { name: '本周计划', exact: true }).click()
      await expect(page.getByText(/漏学任务/)).toBeVisible()
      await screenshot(page, '06-week')
      await page.getByRole('button', { name: '重排剩余任务' }).click()
      await expect(page.getByRole('status')).toContainText('已安排')
      await expect(page.getByRole('button', { name: '重排剩余任务' })).toHaveCount(0)
      await page.reload()
      await expect(page.getByText(/漏学任务/)).toHaveCount(0)
      await expect(page.getByRole('link', { name: '调整计划' })).toBeVisible()
    }
    await page.setViewportSize({ width: 320, height: 720 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    const duration = await page.evaluate(() => getComputedStyle(document.querySelector('.personal-tasks a')).transitionDuration)
    expect(duration).toBe('0s')
  })
}

test('计划向导可键盘操作、回退和校验，保存失败后可以安全重试', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    window.planWrites = 0
    Storage.prototype.setItem = function (key, value) {
      if (key === 'topik-master-personal-plan-v1' && ++window.planWrites === 1) {
        throw new DOMException('Injected local storage failure', 'QuotaExceededError')
      }
      return original.call(this, key, value)
    }
  })
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('./#/my-plan')
  await expect(page.getByText('TOPIK I 暂未提供专属计划。')).toBeVisible()
  const steps = page.getByRole('list', { name: '计划步骤' })
  await expect(steps.locator('[aria-current="step"]')).toHaveText('1目标')
  await page.getByRole('button', { name: '下一步' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '你的韩语基础如何？' })).toBeFocused()
  await page.getByRole('button', { name: '下一步' }).click()
  const duration = page.getByLabel('每天学习时长')
  const preset = page.getByRole('button', { name: '30 分钟' })
  await preset.click()
  await expect(duration).toHaveValue('30')
  await expect(preset).toHaveAttribute('aria-pressed', 'true')
  await expect(preset).toHaveCSS('transition-duration', '0s')
  await duration.fill('9')
  await page.getByRole('button', { name: '预览计划' }).click()
  await expect(page.getByRole('alert')).toContainText('10–120 分钟')
  await expect(duration).toHaveValue('9')
  await preset.click()
  await page.getByRole('button', { name: '上一步' }).click()
  await page.getByRole('button', { name: '下一步' }).click()
  await expect(duration).toHaveValue('30')
  await page.getByRole('button', { name: '预览计划' }).click()
  await expect(steps.locator('[aria-current="step"]')).toHaveText('4预览')
  await expect(page.getByText(/每天 30 分钟/)).toBeVisible()
  const save = page.getByRole('button', { name: '保存计划' })
  await save.click()
  await expect(page.getByRole('alert')).toContainText('计划未保存')
  await save.evaluate(button => { button.click(); button.click() })
  await expect(page.getByRole('heading', { name: '学习记录' })).toBeVisible()
  expect(await page.evaluate(() => window.planWrites)).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})
