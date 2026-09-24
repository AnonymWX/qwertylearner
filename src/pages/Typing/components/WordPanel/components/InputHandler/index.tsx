import KeyEventHandler from '../KeyEventHandler'
import TextAreaHandler from '../TextAreaHandler'
import { currentDictInfoAtom } from '@/store'
import { VietnameseInput } from 'gotiengviet'
import { useAtomValue } from 'jotai'
import type { FormEvent } from 'react'
import { useEffect, useMemo } from 'react'

export default function InputHandler({ updateInput }: { updateInput: (updateObj: WordUpdateAction) => void }) {
  const dictInfo = useAtomValue(currentDictInfoAtom)

  // 当词典是越南语时，启用 gotiengviet 输入法
  useEffect(() => {
    if (dictInfo.language === 'vi') {
      VietnameseInput.getInstance({
        inputMethod: 'telex',
        enabled: true,
      })
    }
    return () => {
      if (dictInfo.language === 'vi') {
        VietnameseInput.destroyInstance()
      }
    }
  }, [dictInfo.language])

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
        return <TextAreaHandler updateInput={updateInput} />
      default:
        return <TextAreaHandler updateInput={updateInput} />
    }
  }, [dictInfo.language, updateInput])

  return <>{handler}</>
}

export type WordUpdateAction = WordAddAction | WordDeleteAction | WordCompositionAction

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
