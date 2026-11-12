import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { updateQuestionAudio, type Question } from '../lib/db'

const FilesContext = createContext<{ files: File[]; setFiles: (files: File[]) => void } | undefined>(undefined)
const ACCEPT = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus'
const isAudio = (file: File) => file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i.test(file.name)

export function ListeningFilesProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<File[]>([])
  return <FilesContext.Provider value={{ files, setFiles }}>{children}</FilesContext.Provider>
}

function LocalAudioPlayer({ file }: { file: File }) {
  const player = useRef<HTMLAudioElement>(null)
  const [playback, setPlayback] = useState<{ file: File; message: string; failed: boolean }>()
  const state = playback?.file === file ? playback : undefined
  const setStatus = (message: string, failed = false) => setPlayback({ file, message, failed })

  useEffect(() => {
    const element = player.current
    if (!element) return
    const url = URL.createObjectURL(file)
    element.src = url
    return () => {
      element.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [file])

  return (
    <>
      <p>当前文件：{file.name}</p>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={player} controls preload="metadata"
        onLoadedMetadata={() => setStatus('音频已加载，可以播放。')}
        onPlaying={() => setStatus('正在播放。')}
        onEnded={() => setStatus('播放结束。')}
        onError={() => setStatus('音频无法播放，请换一个文件。', true)} />
      {state && <p role={state.failed ? 'alert' : 'status'}>{state.message}</p>}
    </>
  )
}

export default function ListeningAudio({ question }: { question: Pick<Question, 'id' | 'audio'> }) {
  const library = useContext(FilesContext)
  const [localFile, setLocalFile] = useState<File>()
  const [track, setTrack] = useState<File | null>()
  const [audioRef, setAudioRef] = useState(question.audio ?? '')
  const [error, setError] = useState('')
  const files = library?.files ?? []
  const matches = audioRef ? files.filter(file => file.name === audioRef) : []
  const matched = matches.length === 1 ? matches[0] : undefined
  const chosen = localFile ?? (track === undefined ? matched : track ?? undefined)
  const selectedIndex = chosen ? files.indexOf(chosen) : -1

  const chooseSingle = async (file?: File) => {
    if (!file) return
    setError('')
    if (!isAudio(file)) {
      setError('请选择音频文件。')
      return
    }
    setLocalFile(file)
    setTrack(undefined)
    if (question.id === undefined) return
    try {
      await updateQuestionAudio(question.id, file.name)
      setAudioRef(file.name)
    } catch (e) {
      setError(`可以播放，但音频文件名未保存：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <section className="note garden-listening" aria-label="听力音频">
      <h3>听力音频</h3>
      {audioRef && <p>本题音频引用：{audioRef}</p>}
      <p>可一次选择多段本地音频。本次练习内可切换，刷新或退出后需重新选择。</p>
      {library && (
        <>
          <p><label>选择本场听力音频 <input type="file" multiple accept={ACCEPT} onChange={event => {
            const selection = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (!selection.length) return
            const audio = selection.filter(isAudio).sort((a, b) => a.name.localeCompare(b.name, 'zh', { numeric: true }))
            setError(audio.length === selection.length ? '' : '已跳过非音频文件。请先解压 ZIP，再选择其中的音频。')
            if (!audio.length) return
            library.setFiles(audio)
            setLocalFile(undefined)
            setTrack(undefined)
          }} /></label></p>
          {files.length > 0 && (
            <p><label>播放本场音频 <select value={selectedIndex < 0 ? '' : String(selectedIndex)} onChange={event => {
              setLocalFile(undefined)
              setTrack(event.target.value === '' ? null : files[Number(event.target.value)])
            }}>
              <option value="">选择音轨</option>
              {files.map((file, index) => <option key={index} value={index}>{file.webkitRelativePath || file.name}</option>)}
            </select></label> · 已选 {files.length} 段</p>
          )}
        </>
      )}
      <p><label>单独选择本题音频 <input type="file" accept={ACCEPT} onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        void chooseSingle(file)
      }} /></label></p>
      {matches.length > 1 && track === undefined && !localFile && <p>找到多个同名音轨，请手动选择。</p>}
      {chosen ? <LocalAudioPlayer file={chosen} /> : <p>尚未选择本题的播放音轨。</p>}
      {error && <p className="fail" role="alert">{error}</p>}
    </section>
  )
}
