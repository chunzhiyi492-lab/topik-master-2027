// TOPIK MASTER 2027 — 发音层（T0）
// 浏览器 speechSynthesis，lang ko-KR，免费，无需 API Key。
// 注意：韩语语音来自设备系统（iPhone / Windows 自带语音），
// 不同设备、不同浏览器可用语音数量与音质不同，不承诺离线神经网络音质。

export interface KoreanVoiceInfo {
  name: string
  lang: string
  localService: boolean
  default: boolean
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * 列出可用韩语语音。未找到时返回空数组并给出原因，不静默失败。
 * 注意：Chrome 等浏览器首次调用 getVoices() 可能返回空列表，
 * 需等 voiceschanged 事件后再取；本函数返回当时能取到的列表，
 * 调用方应在 voiceschanged 后重新调用一次。
 */
export function listKoreanVoices(): { voices: KoreanVoiceInfo[]; reason: string } {
  if (!isSpeechSupported()) {
    return { voices: [], reason: '当前浏览器不支持 speechSynthesis' }
  }
  const all = window.speechSynthesis.getVoices()
  if (all.length === 0) {
    return { voices: [], reason: '语音列表为空：浏览器语音尚未加载完成，请稍候再试（等 voiceschanged 事件）' }
  }
  const ko = all.filter((v) => v.lang.toLowerCase().startsWith('ko'))
  if (ko.length === 0) {
    return {
      voices: [],
      reason: `设备上没有韩语语音（共 ${all.length} 个语音，语言：${[...new Set(all.map((v) => v.lang))].join('、') || '未知'}）。iPhone 请在“设置 → 辅助功能 → 朗读内容 → 嗓音 → 韩语”下载；Windows 请在“设置 → 语音”添加韩语语音包。`,
    }
  }
  return {
    voices: ko.map((v) => ({
      name: v.name,
      lang: v.lang,
      localService: v.localService,
      default: v.default,
    })),
    reason: '',
  }
}

export interface SpeakOptions {
  /** 语速，0.5–1.5，默认 0.9（学习用稍慢） */
  rate?: number
  /** 音调，默认 1 */
  pitch?: number
  /** 音量 0–1，默认 1 */
  volume?: number
}

/** 朗读韩文文本。无韩语语音时仍会尝试用默认语音朗读，调用方应先用 listKoreanVoices() 检查并提示。 */
export function speakKorean(text: string, options: SpeakOptions = {}): { ok: boolean; reason: string } {
  if (!isSpeechSupported()) return { ok: false, reason: '当前浏览器不支持 speechSynthesis' }
  if (!text.trim()) return { ok: false, reason: '文本为空' }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ko-KR'
  utterance.rate = options.rate ?? 0.9
  utterance.pitch = options.pitch ?? 1
  utterance.volume = options.volume ?? 1
  const { voices } = listKoreanVoices()
  const preferred = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith('ko'))
  if (preferred) utterance.voice = preferred
  window.speechSynthesis.speak(utterance)
  return {
    ok: true,
    reason: voices.length > 0 ? `使用语音：${preferred?.name ?? '系统默认'}` : '未找到韩语语音，已用系统默认语音尝试朗读（效果可能不准）',
  }
}
