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

// ─── 规则引擎 ─────────────────────────────────────────────────────────────
// 变音字母 → 必须包含的按键序列
const MARK_RULES: Record<string, string[]> = {
  'ă': ['aw'],
  'â': ['aa'],
  'ê': ['ee'],
  'ô': ['oo'],
  'ơ': ['ow'],
  'ư': ['uw'],
  'đ': ['dd'],
  'Ă': ['aw', 'AW'],
  'Â': ['aa', 'AA'],
  'Ê': ['ee', 'EE'],
  'Ô': ['oo', 'OO'],
  'Ơ': ['ow', 'OW'],
  'Ư': ['uw', 'UW'],
  'Đ': ['dd', 'DD'],
}

/**
 * 规则引擎：校验转换结果里的变音字母，是否由正确的按键序列触发
 *
 * 例：converted 里有 'ơ'，rawBuffer 里必须有 'ow'
 *     否则说明 gotiengviet 错误地把 'o' + 非 w 键处理成了 'ơ'
 */
function validateMarkSequence(rawBuffer: string, converted: string): boolean {
  const rawLower = rawBuffer.toLowerCase()
  const convertedNfc = converted.normalize('NFC')

  for (const [markChar, validTriggers] of Object.entries(MARK_RULES)) {
    if (convertedNfc.includes(markChar)) {
      const hasValidTrigger = validTriggers.some((trigger) => rawLower.includes(trigger.toLowerCase()))
      if (!hasValidTrigger) {
        return false
      }
    }
  }

  return true
}
// ──────────────────────────────────────────────────────────────────────────

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

      // 规则引擎校验
      if (!validateMarkSequence(rawBufferRef.current, normalized)) {
        setDebugInfo(`REJECT: ${normalized}`)
        updateInput({ type: 'reject' })
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
