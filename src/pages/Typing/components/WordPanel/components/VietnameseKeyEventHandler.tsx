import type { WordUpdateAction } from './InputHandler'
import { TypingContext } from '@/pages/Typing/store'
import { processInputByMethod } from 'gotiengviet'
import { useCallback, useContext, useEffect, useRef } from 'react'
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

  // 输入错误重置时，清空原始按键缓冲区
  useEffect(() => {
    rawBufferRef.current = ''
  }, [viResetSignal])

  const onKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (!state.isTyping) return
      if (e.altKey || e.ctrlKey || e.metaKey) return

      if (e.key === 'Backspace') {
        e.preventDefault()
        rawBufferRef.current = rawBufferRef.current.slice(0, -1)
        const converted = processInputByMethod(rawBufferRef.current, TELEX_RULE)
        updateInput({ type: 'replace', value: converted })
        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        rawBufferRef.current = ''
        updateInput({ type: 'add', value: ' ', event: e })
        return
      }

      if (e.key.length !== 1) return
        e.preventDefault()
        rawBufferRef.current += e.key
        const converted = processInputByMethod(rawBufferRef.current, TELEX_RULE)
        updateInput({ type: 'replace', value: converted })
      },
    [state.isTyping, updateInput],
  )

  useEffect(() => {
    if (!state.isTyping) {
      rawBufferRef.current = ''
      return
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [onKeydown, state.isTyping])

  return <></>
}
