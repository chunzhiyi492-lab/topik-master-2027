import { useEffect, useRef, useState } from 'react'
import { deleteTestData, getAllVocab, seedTestData } from '../lib/db'
import { listKoreanVoices, isSpeechSupported, speakKorean } from '../lib/speech'
import { newSrsCard, reviewSrsCard, serializeCard, deserializeCard } from '../lib/srs'

// TOPIK MASTER 2027 — T0 自测页
// 打开即自动跑，每项显示 PASS / FAIL / 未测，结果同时写 localStorage
//（key: topik-master-t0-selftest），方便在 iPhone 上截图 / 导出对照。

export type CheckStatus = 'PASS' | 'FAIL' | '未测'

export interface SelfTestItem {
  name: string
  status: CheckStatus
  detail: string
}

export interface SelfTestResult {
  ranAt: string
  userAgent: string
  items: SelfTestItem[]
  koreanVoices: { name: string; lang: string; localService: boolean; default: boolean }[]
  voiceReason: string
}

const STORAGE_KEY = 'topik-master-t0-selftest'

export default function SelfTest() {
  const [result, setResult] = useState<SelfTestResult | null>(null)
  const [running, setRunning] = useState(false)
  const [speakMsg, setSpeakMsg] = useState('')
  const ranRef = useRef(false)

  async function run() {
    setRunning(true)
    const items: SelfTestItem[] = []
    const now = new Date()
    let koreanVoices: SelfTestResult['koreanVoices'] = []
    let voiceReason = ''

    // 1. IndexedDB 读写
    try {
      // 先清掉上次残留的测试数据，再写 3 条、读回、核对数量
      await deleteTestData().catch(() => undefined)
      const ids = await seedTestData()
      const all = await getAllVocab()
      const testRows = all.filter((v) => v.isTestData)
      if (ids.length === 3 && testRows.length === 3) {
        items.push({ name: 'IndexedDB 可用并读写成功', status: 'PASS', detail: `写入 3 条测试数据，读回 ${testRows.length} 条（ko：${testRows.map((v) => v.ko).join('、')}），随后已清理。` })
      } else {
        items.push({ name: 'IndexedDB 可用并读写成功', status: 'FAIL', detail: `写入 ${ids.length} 条，读回测试数据 ${testRows.length} 条，数量不符。` })
      }
      await deleteTestData()
    } catch (err) {
      items.push({ name: 'IndexedDB 可用并读写成功', status: 'FAIL', detail: `异常：${err instanceof Error ? err.message : String(err)}` })
    }

    // 2. ts-fsrs 调度
    try {
      const base = new Date('2026-11-07T00:00:00.000Z')
      const good = await reviewSrsCard(await newSrsCard(base), '认识', base)
      const again = await reviewSrsCard(await newSrsCard(base), '不认识', base)
      const goodDue = new Date(good.card.dueAt).getTime()
      const againDue = new Date(again.card.dueAt).getTime()
      // 序列化往返：存 JSON 再恢复，dueAt 不变
      const restored = deserializeCard(serializeCard(good.card))
      const roundTripOk = new Date(restored.dueAt).getTime() === goodDue
      if (goodDue > againDue && roundTripOk) {
        items.push({
          name: 'ts-fsrs 调度正常',
          status: 'PASS',
          detail: `认识 → 下次 ${good.card.dueAt}（约 ${good.card.scheduledDays.toFixed(2)} 天后）；不认识 → 下次 ${again.card.dueAt}；认识的间隔大于不认识，序列化往返正常。`,
        })
      } else {
        items.push({
          name: 'ts-fsrs 调度正常',
          status: 'FAIL',
          detail: `认识 due=${good.card.dueAt}，不认识 due=${again.card.dueAt}，序列化往返=${roundTripOk}。`,
        })
      }
    } catch (err) {
      items.push({ name: 'ts-fsrs 调度正常', status: 'FAIL', detail: `异常：${err instanceof Error ? err.message : String(err)}` })
    }

    // 3. speechSynthesis 存在
    if (isSpeechSupported()) {
      items.push({ name: 'speechSynthesis 存在', status: 'PASS', detail: 'window.speechSynthesis 可用。' })
    } else {
      items.push({ name: 'speechSynthesis 存在', status: 'FAIL', detail: '当前浏览器不支持 speechSynthesis，无法发音。' })
    }

    // 4. ko-KR 语音列表（等 voiceschanged 再取一次，避免首次为空）
    try {
      const first = listKoreanVoices()
      let listed = first
      if (first.voices.length === 0 && isSpeechSupported()) {
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(() => resolve(), 1500)
          const onChange = () => {
            window.clearTimeout(timer)
            window.speechSynthesis.removeEventListener('voiceschanged', onChange)
            resolve()
          }
          window.speechSynthesis.addEventListener('voiceschanged', onChange)
        })
        listed = listKoreanVoices()
      }
      koreanVoices = listed.voices
      voiceReason = listed.reason
      if (listed.voices.length > 0) {
        items.push({
          name: 'ko-KR 语音可用',
          status: 'PASS',
          detail: `找到 ${listed.voices.length} 个韩语语音：${listed.voices.map((v) => `${v.name}（${v.lang}，${v.localService ? '本地' : '在线'}）`).join('、')}。`,
        })
      } else {
        items.push({
          name: 'ko-KR 语音可用',
          status: 'FAIL',
          detail: listed.reason || '未找到韩语语音。',
        })
      }
    } catch (err) {
      items.push({ name: 'ko-KR 语音可用', status: 'FAIL', detail: `异常：${err instanceof Error ? err.message : String(err)}` })
    }

    // 5. Service Worker 注册状态
    try {
      if (!('serviceWorker' in navigator)) {
        items.push({ name: 'Service Worker 已注册', status: 'FAIL', detail: '当前浏览器不支持 Service Worker。' })
      } else {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.active) {
          items.push({ name: 'Service Worker 已注册', status: 'PASS', detail: `已激活，scope：${reg.scope}。` })
        } else if (reg) {
          items.push({ name: 'Service Worker 已注册', status: '未测', detail: `已注册但尚未激活（state：${reg.installing?.state ?? reg.waiting?.state ?? '未知'}），刷新一次后再看。` })
        } else {
          items.push({ name: 'Service Worker 已注册', status: '未测', detail: '本次打开未取到注册信息（开发模式下 vite-plugin-pwa 不注册 SW，属正常；生产构建后刷新再看）。' })
        }
      }
    } catch (err) {
      items.push({ name: 'Service Worker 已注册', status: 'FAIL', detail: `异常：${err instanceof Error ? err.message : String(err)}` })
    }

    // 6. manifest 存在（必须带 base 子路径取，根路径 /manifest.webmanifest 在
    //    GitHub Pages 子路径部署下是 404；BASE_URL 构建时为 /topik-master-2027/）
    const manifestUrl = `${import.meta.env.BASE_URL}manifest.webmanifest`
    try {
      const res = await fetch(manifestUrl)
      if (res.ok) {
        const manifest = (await res.json()) as { name?: string }
        items.push({
          name: 'manifest 存在',
          status: 'PASS',
          detail: `GET ${manifestUrl} 返回 ${res.status}，name：${manifest.name ?? '未知'}。`,
        })
      } else {
        items.push({ name: 'manifest 存在', status: 'FAIL', detail: `GET ${manifestUrl} 返回 ${res.status}。` })
      }
    } catch (err) {
      items.push({ name: 'manifest 存在', status: 'FAIL', detail: `异常：${err instanceof Error ? err.message : String(err)}` })
    }

    const next: SelfTestResult = {
      ranAt: now.toISOString(),
      userAgent: navigator.userAgent,
      items,
      koreanVoices,
      voiceReason,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next, null, 2))
    } catch {
      // localStorage 不可用时不阻塞自测结果显示
    }
    setResult(next)
    setRunning(false)
  }

  useEffect(() => {
    if (!ranRef.current) {
      ranRef.current = true
      void run()
    }
    // 只在打开时自动跑一次；点“重新跑”可手动再跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section>
      <h2>T0 自测</h2>
      <p>打开本页会自动跑一遍。结果同时存到 localStorage（key：<code>topik-master-t0-selftest</code>）。</p>
      <p>
        <button type="button" onClick={() => void run()} disabled={running}>
          {running ? '自测进行中…' : '重新跑一遍'}
        </button>{' '}
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const r = speakKorean('안녕하세요', { rate: 0.9 })
            setSpeakMsg(r.ok ? `已朗读 안녕하세요。${r.reason}` : `发音失败：${r.reason}`)
          }}
        >
          测试发音（读 안녕하세요）
        </button>
      </p>
      {speakMsg && <p>{speakMsg}</p>}
      {result ? (
        <>
          <p>
            测试时间：<code>{result.ranAt}</code>
            <br />
            userAgent：<code>{result.userAgent}</code>
          </p>
          <table>
            <thead>
              <tr><th>检查项</th><th>结果</th><th>详情</th></tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td className={item.status === 'PASS' ? 'pass' : item.status === 'FAIL' ? 'fail' : 'unchecked'}>
                    {item.status}
                  </td>
                  <td>{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">
            注意：本页结果只代表当前这台设备 + 当前这个浏览器的实测情况。
            iPhone Safari 与 Windows 浏览器需要在真机上各打开一次本页核对，
            不能用一台设备的结果代替另一台。
          </p>
        </>
      ) : (
        <p>自测进行中…</p>
      )}
    </section>
  )
}
