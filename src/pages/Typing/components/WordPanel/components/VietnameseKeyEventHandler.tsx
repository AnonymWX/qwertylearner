import type { WordUpdateAction } from './InputHandler'
import { TypingContext } from '@/pages/Typing/store'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EXPLICIT_SPACE } from '@/constants'

// ─────────────────────────────────────────────────────────────────────────────
// 反向转换：越南语单词 → Telex 按键序列 + 字符阶段信息
// ─────────────────────────────────────────────────────────────────────────────

type CharInfo = {
  charIndex: number
  stages: string[]
  keyPerStage: string[]
}

type TelexBuildResult = {
  keys: string
  keyIndexToCharStage: Array<{ charIndex: number; stage: number }>
  charInfos: Map<number, CharInfo>
}

const TONE_MARKS = ['\u0300', '\u0301', '\u0303', '\u0309', '\u0323']

function buildTelexKeys(word: string): TelexBuildResult {
  const chars = Array.from(word)
  const allKeys: string[] = []
  const keyIndexToCharStage: Array<{ charIndex: number; stage: number }> = []
  const charInfos = new Map<number, CharInfo>()

  let i = 0
  while (i < chars.length) {
    if (chars[i] === ' ') {
      allKeys.push(' ')
      keyIndexToCharStage.push({ charIndex: i, stage: 0 })
      charInfos.set(i, { charIndex: i, stages: [' '], keyPerStage: [' '] })
      i++
      continue
    }

    let end = i
    while (end < chars.length && chars[end] !== ' ') end++

    let pendingTone: { key: string; charIndex: number; stage: number } | null = null

    for (let j = i; j < end; j++) {
      const c = chars[j]
      const nfd = c.normalize('NFD')
      const base = nfd[0]
      const marks = nfd.slice(1)
      const lower = c.toLowerCase()

      const hasCircumflex = marks.includes('\u0302')
      const hasBreve = marks.includes('\u0306')
      const hasHorn = marks.includes('\u031B')
      const isD = lower === 'đ'

      let baseKeys: string
      if (isD) {
        baseKeys = c === 'Đ' ? 'DD' : 'dd'
      } else if (hasBreve) {
        baseKeys = base === 'A' ? 'AW' : 'aw'
      } else if (hasHorn) {
        if (base.toLowerCase() === 'o') baseKeys = base === 'O' ? 'OW' : 'ow'
        else baseKeys = base === 'U' ? 'UW' : 'uw'
      } else if (hasCircumflex) {
        const b = base.toLowerCase()
        if (b === 'a') baseKeys = base === 'A' ? 'AA' : 'aa'
        else if (b === 'e') baseKeys = base === 'E' ? 'EE' : 'ee'
        else if (b === 'o') baseKeys = base === 'O' ? 'OO' : 'oo'
        else baseKeys = base
      } else {
        baseKeys = base
      }

      let toneKey: string | null = null
      for (const m of marks) {
        if (m === '\u0301') toneKey = 's'
        else if (m === '\u0300') toneKey = 'f'
        else if (m === '\u0309') toneKey = 'r'
        else if (m === '\u0303') toneKey = 'x'
        else if (m === '\u0323') toneKey = 'j'
      }

      const stages: string[] = []
      const keyPerStage: string[] = []

      if (baseKeys.length === 1) {
        stages.push(base)
        keyPerStage.push(baseKeys)
      } else {
        stages.push(base)
        keyPerStage.push(baseKeys[0])
        const withMark = nfd
          .filter((m) => !TONE_MARKS.includes(m))
          .join('')
          .normalize('NFC')
        stages.push(withMark)
        keyPerStage.push(baseKeys[1])
      }

      if (toneKey) {
        stages.push(c)
        keyPerStage.push(toneKey)
      }

      charInfos.set(j, { charIndex: j, stages, keyPerStage })

      const basicStageCount = toneKey ? stages.length - 1 : stages.length
      for (let s = 0; s < basicStageCount; s++) {
        allKeys.push(keyPerStage[s])
        keyIndexToCharStage.push({ charIndex: j, stage: s })
      }

      if (toneKey) {
        pendingTone = { key: toneKey, charIndex: j, stage: stages.length - 1 }
      }
    }

    if (pendingTone) {
      allKeys.push(pendingTone.key)
      keyIndexToCharStage.push({ charIndex: pendingTone.charIndex, stage: pendingTone.stage })
    }

    i = end
  }

  return { keys: allKeys.join(''), keyIndexToCharStage, charInfos }
}

// ─────────────────────────────────────────────────────────────────────────────
// 根据当前 rawBuffer，计算应显示的越南语前缀
// ─────────────────────────────────────────────────────────────────────────────

function computeDisplay(
  rawBuffer: string,
  wordName: string,
  keyIndexToCharStage: Array<{ charIndex: number; stage: number }>,
  charInfos: Map<number, CharInfo>,
): string {
  const charMaxStage = new Map<number, number>()
  for (let k = 0; k < rawBuffer.length; k++) {
    const info = keyIndexToCharStage[k]
    if (!info) continue
    const current = charMaxStage.get(info.charIndex) ?? -1
    if (info.stage > current) charMaxStage.set(info.charIndex, info.stage)
  }

  const wordChars = Array.from(wordName)
  let display = ''
  for (let i = 0; i < wordChars.length; i++) {
    const maxStage = charMaxStage.get(i)
    if (maxStage === undefined || maxStage < 0) continue
    const info = charInfos.get(i)
    if (!info) continue
    const char = info.stages[maxStage]
    display += char === ' ' ? EXPLICIT_SPACE : char
  }
  return display
}

// ─────────────────────────────────────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────────────────────────────────────

export default function VietnameseKeyEventHandler({
  updateInput,
  wordName,
  viResetSignal,
}: {
  updateInput: (updateObj: WordUpdateAction) => void
  wordName: string
  viResetSignal?: number
}) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const rawBufferRef = useRef('')
  const [debugInfo, setDebugInfo] = useState('')

  const telexBuild = useMemo(() => buildTelexKeys(wordName), [wordName])

  useEffect(() => {
    rawBufferRef.current = ''
    setDebugInfo('')
  }, [viResetSignal, wordName])

  const onKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (!state.isTyping) return
      if (e.altKey || e.ctrlKey || e.metaKey) return

      if (e.key === 'Backspace') {
        e.preventDefault()
        rawBufferRef.current = rawBufferRef.current.slice(0, -1)
        const display = computeDisplay(rawBufferRef.current, wordName, telexBuild.keyIndexToCharStage, telexBuild.charInfos)
        setDebugInfo(`backspace → "${display}"`)
        updateInput({ type: 'replace', value: display })
        return
      }

      if (e.key.length !== 1) return

      e.preventDefault()

      const newRaw = rawBufferRef.current + e.key
      const expected = telexBuild.keys

      // 前缀比对（忽略大小写）
      if (!expected.toLowerCase().startsWith(newRaw.toLowerCase())) {
        setDebugInfo(`REJECT: "${newRaw}" not prefix of "${expected}"`)
        rawBufferRef.current = ''
        updateInput({ type: 'reject' })
        return
      }

      rawBufferRef.current = newRaw
      const display = computeDisplay(newRaw, wordName, telexBuild.keyIndexToCharStage, telexBuild.charInfos)
      setDebugInfo(`raw: "${newRaw}" | done: "${display}"`)
      updateInput({ type: 'replace', value: display })
    },
    [state.isTyping, updateInput, wordName, telexBuild],
  )

  useEffect(() => {
    if (!state.isTyping) {
      rawBufferRef.current = ''
      setDebugInfo('')
      return
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [onKeydown, state.isTyping])

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: '#0f0',
          padding: '8px 12px',
          fontSize: '12px',
          fontFamily: 'monospace',
          zIndex: 9999,
          borderRadius: '4px',
          pointerEvents: 'none',
          maxWidth: '90vw',
          wordBreak: 'break-all',
        }}
      >
        {debugInfo || `keys: "${telexBuild.keys}"`}
      </div>
    </>
  )
}
