'use client'
import { useEffect, useState, useCallback } from 'react'
import { sounds, isMuted, initSoundState, toggleMuted, subscribeMuted } from './sounds'

export function useSound() {
  const [muted, setMutedState] = useState(false)

  useEffect(() => {
    initSoundState()
    setMutedState(isMuted())
    const unsubscribe = subscribeMuted(() => setMutedState(isMuted()))
    return () => { unsubscribe() }
  }, [])

  const toggle = useCallback(() => toggleMuted(), [])

  return { ...sounds, muted, toggleMuted: toggle }
}
