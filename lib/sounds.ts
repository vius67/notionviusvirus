'use client'

// Tiny synthesized UI sound engine — no audio files, just oscillators + envelopes.
// Everything is generated at call time through the Web Audio API, so there's
// nothing to download and nothing to keep in sync with a design system.

type ToneStep = {
  freq: number
  start: number      // seconds, relative to play() call
  duration: number    // seconds
  type?: OscillatorType
  gain?: number        // 0–1, relative to master volume
}

const STORAGE_KEY = 'app-sound-muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
let listeners = new Set<() => void>()

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.16
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playTones(steps: ToneStep[]) {
  if (muted) return
  const audioCtx = getCtx()
  if (!audioCtx || !master) return
  const now = audioCtx.currentTime

  for (const step of steps) {
    const osc  = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = step.type ?? 'sine'
    osc.frequency.value = step.freq

    const t0 = now + step.start
    const t1 = t0 + step.duration
    const peak = (step.gain ?? 1) * 0.9

    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.012, step.duration * 0.3))
    gain.gain.exponentialRampToValueAtTime(0.0001, t1)

    osc.connect(gain)
    gain.connect(master)
    osc.start(t0)
    osc.stop(t1 + 0.02)
  }
}

// ── Palette ──────────────────────────────────────────────────────────────────
export const sounds = {
  click()   { playTones([{ freq: 720, start: 0, duration: 0.045, type: 'sine', gain: 0.55 }]) },
  hover()   { playTones([{ freq: 1400, start: 0, duration: 0.02, type: 'sine', gain: 0.18 }]) },
  toggleOn()  { playTones([
    { freq: 620, start: 0,    duration: 0.05, type: 'sine', gain: 0.5 },
    { freq: 980, start: 0.045, duration: 0.08, type: 'sine', gain: 0.55 },
  ]) },
  toggleOff() { playTones([{ freq: 480, start: 0, duration: 0.07, type: 'sine', gain: 0.45 }]) },
  success() { playTones([
    { freq: 660,  start: 0,    duration: 0.09, type: 'sine', gain: 0.5 },
    { freq: 880,  start: 0.06, duration: 0.09, type: 'sine', gain: 0.55 },
    { freq: 1320, start: 0.12, duration: 0.16, type: 'sine', gain: 0.5 },
  ]) },
  delete()  { playTones([
    { freq: 500, start: 0,    duration: 0.06, type: 'sine', gain: 0.45 },
    { freq: 320, start: 0.045, duration: 0.09, type: 'sine', gain: 0.4 },
  ]) },
  select()  { playTones([{ freq: 900, start: 0, duration: 0.06, type: 'sine', gain: 0.5 }]) },
}

// ── Mute state (persisted) ────────────────────────────────────────────────────
export function isMuted() {
  return muted
}
export function initSoundState() {
  if (typeof window === 'undefined') return
  muted = localStorage.getItem(STORAGE_KEY) === '1'
}
export function setMuted(next: boolean) {
  muted = next
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  listeners.forEach(fn => fn())
}
export function toggleMuted() {
  setMuted(!muted)
}
export function subscribeMuted(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
