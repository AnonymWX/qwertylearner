import type { WordUpdateAction } from './InputHandler'
import { TypingContext } from '@/pages/Typing/store'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EXPLICIT_SPACE } from '@/constants'

/**
 * 把越南语单词反向转换为 Telex 按键序列
 *
 * 例：'tạm biệt' → { keys: 'tamj bieetj', keyToCharIndex: [0,1,2,1,3,4,5,6,6,7,6] }
 *
 * keyToCharIndex[i] 表示第 i 个按键对应到原单词的第几个字符。
 * 空格对应原单词里的空格索引。
 */
function toTelexKeys(word: string): { keys: string; keyToCharIndex: number[] } {
  const keys: string[] = []
  const keyToCharIndex: number[] = []
  let toneKey: string | null = null
  let toneCharIndex = -1

  const chars = Array.from(word)

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]

    if (char === ' ') {
      // 音节分隔：先把当前音节的声调键追加进去
      if (toneKey) {
        keys.push(toneKey)
        keyToCharIndex.push(toneCharIndex)
        toneKey = null
        toneCharIndex = -1
      }
      keys.push(' ')
      keyToCharIndex.push(i)
      continue
    }

    const nfd = char.normalize('NFD')
    const base = nfd[0]
    const marks = nfd.slice(1)
    const lowerChar = char.toLowerCase()

    const hasCircumflex = marks.includes('\u0302')
    const hasBreve = marks.includes('\u0306')
    const hasHorn = marks.includes('\u031B')

    let baseKeys: string
    if (lowerChar === 'đ') {
      baseKeys = char === 'Đ' ? 'DD' : 'dd'
    } else if (hasBreve) {
      baseKeys = char === 'Ă' ? 'AW' : 'aw'
    } else if (hasHorn) {
      if (base.toLowerCase() === 'o') baseKeys = char === 'Ơ' ? 'OW' : 'ow'
      else baseKeys = char === 'Ư' ? 'UW' : 'uw'
    } else if (hasCircumflex) {
      const b = base.toLowerCase()
      if (b === 'a') baseKeys = char === 'Â' ? 'AA' : 'aa'
      else if (b === 'e') baseKeys = char === 'Ê' ? 'EE' : 'ee'
      else if (b === 'o') baseKeys = char === 'Ô' ? 'OO' : 'oo'
      else baseKeys = char
    } else {
      baseKeys = char
    }

    for (const k of baseKeys) {
      keys.push(k)
      keyToCharIndex.push(i)
    }

    const toneMap: Record<string, string> = {
      '\u0301': 's', // 锐声
      '\u0300': 'f', // 玄声
      '\u0309': 'r', // 问声
      '\u0303': 'x', // 跌声
      '\u0323': 'j', // 重声
    }

    for (const m of marks) {
      if (toneMap[m]) {
        toneKey = toneMap[m]
        toneCharIndex = i
      }
    }
  }

  // 末尾还有未追加的声调键
  if (toneKey) {
    keys.push(toneKey)
    keyToCharIndex.push(toneCharIndex)
  }

  return { keys: keys.join(''), keyToCharIndex }
}

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

  const telexInfo = useMemo(() => toTelexKeys(wordName), [wordName])

  useEffect(() => {
    rawBufferRef.current = ''
    setDebugInfo('')
  }, [viResetSignal, wordName])

  const computeDisplaySoFar = useCallback(
    (raw: string) => {
      let maxCharIndex = -1
      for (let i = 0; i < raw.length; i++) {
        const ci = telexInfo.keyToCharIndex[i]
        if (ci > maxCharIndex) maxCharIndex = ci
      }

      let display = ''
      for (let i = 0; i <= maxCharIndex; i++) {
        const c = wordName[i]
        display += c === ' ' ? EXPLICIT_SPACE : c
      }
      return display
    },
    [telexInfo, wordName],
  )

  const onKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (!state.isTyping) return
      if (e.altKey || e.ctrlKey || e.metaKey) return

      if (e.key === 'Backspace') {
        e.preventDefault()
        rawBufferRef.current = rawBufferRef.current.slice(0, -1)
        const display = computeDisplaySoFar(rawBufferRef.current)
        setDebugInfo(`backspace → ${display}`)
        updateInput({ type: 'replace', value: display })
        return
      }

      if (e.key.length !== 1) return

      e.preventDefault()

      const newRaw = rawBufferRef.current + e.key
      const expected = telexInfo.keys

      // 前缀比对：用户按下的字符序列，必须是 expected 的前缀
      if (!expected.toLowerCase().startsWith(newRaw.toLowerCase())) {
        setDebugInfo(`REJECT: "${newRaw}" vs "${expected}"`)
        updateInput({ type: 'reject' })
        return
      }

      rawBufferRef.current = newRaw
      const display = computeDisplaySoFar(newRaw)
      setDebugInfo(`raw: "${newRaw}" | done: "${display}"`)
      updateInput({ type: 'replace', value: display })
    },
    [state.isTyping, updateInput, telexInfo, computeDisplaySoFar],
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
        {debugInfo || `keys: "${telexInfo.keys}"`}
      </div>
    </>
  )
}
