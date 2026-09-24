import type { WordUpdateAction } from './InputHandler'
import { TypingContext } from '@/pages/Typing/store'
import { processInputByMethod } from 'gotiengviet'
import { useCallback, useContext, useEffect, useRef } from 'react'

export default function VietnameseKeyEventHandler({ updateInput }: { updateInput: (updateObj: WordUpdateAction) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const rawBufferRef = useRef('')

  const onKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (!state.isTyping) return
      if (e.altKey || e.ctrlKey || e.metaKey) return

      if (e.key === 'Backspace') {
        e.preventDefault()
        rawBufferRef.current = rawBufferRef.current.slice(0, -1)
        const converted = processInputByMethod(rawBufferRef.current, 'telex' as any)
        updateInput({ type: 'replace', value: converted })
        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        rawBufferRef.current = ''
        updateInput({ type: 'replace', value: '' })
        return
      }

      if (e.key.length !== 1) return

      e.preventDefault()
      rawBufferRef.current += e.key
      const converted = processInputByMethod(rawBufferRef.current, 'telex' as any)
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
    return () => {
      window.removeEventListener('keydown', onKeydown)
    }
  }, [onKeydown, state.isTyping])

  return <></>
}
