import { createContext, type Dispatch, type ReactNode, use, useEffect, useReducer } from 'react'

import { loadState, reducer, saveState } from './reducer'
import type { ImageToImageState } from './types'

type Action = Parameters<typeof reducer>[1]

interface ImageToImageContextType {
  state: ImageToImageState
  dispatch: Dispatch<Action>
}

const ImageToImageContext = createContext<ImageToImageContextType | null>(null)

export function ImageToImageProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  return <ImageToImageContext value={{ state, dispatch }}>{children}</ImageToImageContext>
}

export function useImageToImage(): ImageToImageContextType {
  const context = use(ImageToImageContext)
  if (!context) {
    throw new Error('useImageToImage must be used within ImageToImageProvider')
  }
  return context
}
