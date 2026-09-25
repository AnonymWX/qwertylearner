import type { WordUpdateAction } from './InputHandler'
import { TypingContext } from '@/pages/Typing/store'
import { processInputByMethod } from 'gotiengviet'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { EXPLICIT_SPACE } from '@/constants'

const TELEX_RULE = {
  toneRules: {
    s: 1,
    f: 2,
    r: 3,
    x: 4,
    j: 5,
    z: 0,
  },
  markRules: {
    aa: 'â',
    aw: 'ă',
    ee: 'ê',
    oo: 'ô',
    ow: 'ơ',
    uw: 'ư',
    dd: 'đ',
    AA: 'Â',
    AW: 'Ă',
    EE: 'Ê',
    OO: 'Ô',
    OW: 'Ơ',
    UW: 'Ư',
    DD: 'Đ',
  },
}

// 变音字母 → 必须包含的触发键
const MARK_TRIGGER_MAP: Record<string, string> = {
  'ơ': 'w',
  'Ơ': 'w',
  'ư': 'w',
  'Ư': 'w',
  'ă': 'w',
  'Ă': 'w',
  'â': 'a',
  'Â': 'a',
  'ê': 'e',
  'Ê': 'e',
  'ô': 'o',
  'Ô': 'o',
  'đ': 'd',
  'Đ': 'd',
}

export default function VietnameseKeyEventHandler({
  updateInput,
  viResetSignal,
}: {
  updateInput: (updateObj: WordUpdateAction) => void
  viResetSignal?: number
}) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const rawBufferRef = useRef('')
  const [debugInfo, setDebugInfo] = useState('')

  useEffect(() => {
    rawBufferRef.current = ''
    setDebugInfo('')
  }, [viResetSignal])

  const onKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (!state.isTyping) return
      if (e.altKey || e.ctrlKey || e.metaKey) return

      if (e.key === 'Backspace') {
        e.preventDefault()
        rawBufferRef.current = rawBufferRef.current.slice(0, -1)
        const converted = processInputByMethod(rawBufferRef.current, TELEX_RULE)
        const normalized = converted.replace(/ /g, EXPLICIT_SPACE).normalize('NFC')
        setDebugInfo(`backspace → ${normalized}`)
        updateInput({ type: 'replace', value: normalized })
        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        rawBufferRef.current += ' '
        const converted = processInputByMethod(rawBufferRef.current, TELEX_RULE)
        const normalized = converted.replace(/ /g, EXPLICIT_SPACE).normalize('NFC')
        setDebugInfo(`space → ${normalized}`)
        updateInput({ type: 'replace', value: normalized })
        return
      }

      if (e.key.length !== 1) return

      e.preventDefault()
      rawBufferRef.current += e.key
      const converted = processInputByMethod(rawBufferRef.current, TELEX_RULE)
      const normalized = converted.replace(/ /g, EXPLICIT_SPACE).normalize('NFC')

      // 校验：转换结果里的每个变音字母，原始输入里必须有对应的触发键
      const rawLower = rawBufferRef.current.toLowerCase()
      let hasInvalidMark = false

      for (const [markChar, triggerKey] of Object.entries(MARK_TRIGGER_MAP)) {
        if (normalized.includes(markChar) && !rawLower.includes(triggerKey)) {
          hasInvalidMark = true
          break
        }
      }

      if (hasInvalidMark) {
        setDebugInfo(`invalid mark: ${normalized}`)
        updateInput({ type: 'replace', value: normalized })
        return
      }

      setDebugInfo(`raw: ${rawBufferRef.current} | converted: ${normalized}`)
      updateInput({ type: 'replace', value: normalized })
    },
    [state.isTyping, updateInput],
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
          fontSize: '14px',
          fontFamily: 'monospace',
          zIndex: 9999,
          borderRadius: '4px',
          pointerEvents: 'none',
        }}
      >
        {debugInfo || 'waiting...'}
      </div>
    </>
  )
}
