import KeyEventHandler from '../KeyEventHandler'
import TextAreaHandler from '../TextAreaHandler'
import VietnameseKeyEventHandler from '../VietnameseKeyEventHandler'
import { currentDictInfoAtom } from '@/store'
import { useAtomValue } from 'jotai'
import type { FormEvent } from 'react'
import { useMemo } from 'react'

export default function InputHandler({
  updateInput,
  viResetSignal,
}: {
  updateInput: (updateObj: WordUpdateAction) => void
  viResetSignal?: number
}) {
  const dictInfo = useAtomValue(currentDictInfoAtom)

  const handler = useMemo(() => {
    switch (dictInfo.language) {
      case 'en':
        return <KeyEventHandler updateInput={updateInput} />
      case 'de':
        return <KeyEventHandler updateInput={updateInput} />
      case 'romaji':
        return <KeyEventHandler updateInput={updateInput} />
      case 'code':
        return <TextAreaHandler updateInput={updateInput} />
      case 'vi':
        return <VietnameseKeyEventHandler updateInput={updateInput} viResetSignal={viResetSignal} />
      default:
        return <TextAreaHandler updateInput={updateInput} />
    }
  }, [dictInfo.language, updateInput, viResetSignal])

  return <>{handler}</>
}

export type WordUpdateAction = WordAddAction | WordDeleteAction | WordCompositionAction | WordReplaceAction

export type WordAddAction = {
  type: 'add'
  value: string
  event: FormEvent<HTMLTextAreaElement> | KeyboardEvent
}

export type WordDeleteAction = {
  type: 'delete'
  length: number
}

// composition api is not ready yet
export type WordCompositionAction = {
  type: 'composition'
  value: string
}
export type WordReplaceAction = {
  type: 'replace'
  value: string
}
