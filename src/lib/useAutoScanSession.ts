import { useCallback, useEffect, useRef, useState } from 'react'
import type { useCamera } from './useCamera'
import { detectCorners, processScan } from './scanProcessorClient'
import { imageDataToDataUrl } from './imageDataUtils'
import { defaultCorners } from '../components/CornerEditor'
import { toSmallFrame, sharpnessScore, frameDifference, type SmallFrame } from './frameAnalysis'
import type { EnhanceOptions } from './imageEnhance'
import type { Point } from './homography'

export type AutoScanStatus = 'looking' | 'blurry' | 'stabilizing' | 'capturing' | 'captured'

const TICK_MS = 280
const SHARPNESS_MIN = 12 // below this, treat the frame as motion-blurred (page likely mid-flip)
const MOTION_MAX = 0.02 // frame-to-frame diff above this means the scene is still moving/settling
const NEW_PAGE_MIN = 0.05 // must differ from the last captured page by at least this much
const STABLE_TICKS_REQUIRED = 2 // consecutive still+different ticks before auto-capturing

function quadSize(corners: [Point, Point, Point, Point]) {
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  const width = Math.round((dist(corners[0], corners[1]) + dist(corners[3], corners[2])) / 2)
  const height = Math.round((dist(corners[0], corners[3]) + dist(corners[1], corners[2])) / 2)
  return { width: Math.max(width, 50), height: Math.max(height, 50) }
}

export interface AutoScanCapture {
  baseDataUrl: string
  enhance: EnhanceOptions
  dataUrl: string
}

interface Options {
  camera: ReturnType<typeof useCamera>
  enhance: EnhanceOptions
  onCapture: (capture: AutoScanCapture) => void
}

/**
 * Drives the "record & auto-scan" flow: watches the live camera feed, and when a
 * page has visibly settled (sharp, motionless, and different from the last page
 * captured) it auto-snaps, straightens and enhances it — no manual shutter press.
 */
export function useAutoScanSession({ camera, enhance, onCapture }: Options) {
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<AutoScanStatus>('looking')
  const [capturedCount, setCapturedCount] = useState(0)
  const [liveCorners, setLiveCorners] = useState<[Point, Point, Point, Point] | null>(null)
  const [liveFrameSize, setLiveFrameSize] = useState<{ width: number; height: number } | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCapturedFrameRef = useRef<SmallFrame | null>(null)
  const previousTickFrameRef = useRef<SmallFrame | null>(null)
  const stableStreakRef = useRef(0)
  const isCapturingRef = useRef(false)
  const isDetectingPreviewRef = useRef(false)
  const enhanceRef = useRef(enhance)
  enhanceRef.current = enhance

  const tick = useCallback(async () => {
    if (isCapturingRef.current) return
    const small = camera.captureSmall(220)
    if (!small) return
    const frame = toSmallFrame(small, 220)

    // Live edge outline for the viewfinder — runs in the worker, best-effort and
    // non-blocking, so a slow detection never delays the capture decision below.
    if (!isDetectingPreviewRef.current) {
      isDetectingPreviewRef.current = true
      setLiveFrameSize({ width: small.width, height: small.height })
      detectCorners(small)
        .then((corners) => setLiveCorners(corners))
        .finally(() => {
          isDetectingPreviewRef.current = false
        })
    }

    const sharpness = sharpnessScore(frame)
    if (sharpness < SHARPNESS_MIN) {
      stableStreakRef.current = 0
      previousTickFrameRef.current = frame
      setStatus('blurry')
      return
    }

    const motion = previousTickFrameRef.current ? frameDifference(frame, previousTickFrameRef.current) : 1
    previousTickFrameRef.current = frame

    if (motion > MOTION_MAX) {
      stableStreakRef.current = 0
      setStatus('stabilizing')
      return
    }

    const diffFromLastCaptured = lastCapturedFrameRef.current ? frameDifference(frame, lastCapturedFrameRef.current) : 1
    if (diffFromLastCaptured < NEW_PAGE_MIN) {
      // Same page still sitting in frame — don't recapture it.
      stableStreakRef.current = 0
      setStatus('captured')
      return
    }

    stableStreakRef.current += 1
    setStatus('stabilizing')

    if (stableStreakRef.current < STABLE_TICKS_REQUIRED) return

    // Settled on a new page for long enough — capture it for real.
    isCapturingRef.current = true
    stableStreakRef.current = 0
    setStatus('capturing')
    try {
      const full = camera.capture()
      if (!full) return
      const corners = (await detectCorners(full.imageData)) ?? defaultCorners(full.imageData.width, full.imageData.height)
      const { width, height } = quadSize(corners)
      const { base, enhanced } = await processScan(full.imageData, corners, width, height, 0, enhanceRef.current)
      onCapture({
        baseDataUrl: imageDataToDataUrl(base),
        enhance: enhanceRef.current,
        dataUrl: imageDataToDataUrl(enhanced),
      })
      lastCapturedFrameRef.current = frame
      setCapturedCount((c) => c + 1)
      setStatus('captured')
    } finally {
      isCapturingRef.current = false
    }
  }, [camera, onCapture])

  const start = useCallback(() => {
    lastCapturedFrameRef.current = null
    previousTickFrameRef.current = null
    stableStreakRef.current = 0
    isCapturingRef.current = false
    isDetectingPreviewRef.current = false
    setCapturedCount(0)
    setStatus('looking')
    setLiveCorners(null)
    setIsRunning(true)
  }, [])

  const stop = useCallback(() => {
    setIsRunning(false)
    setLiveCorners(null)
  }, [])

  // `camera` is a fresh object every render (useCamera doesn't memoize its return value),
  // so `tick` is recreated often. Route the interval through a ref of the latest `tick`
  // instead of depending on `tick` directly — otherwise the interval would be torn down
  // and rebuilt on nearly every status update, starving it of ticks.
  const tickRef = useRef(tick)
  tickRef.current = tick

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      return
    }
    intervalRef.current = setInterval(() => tickRef.current(), TICK_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [isRunning])

  return { isRunning, status, capturedCount, liveCorners, liveFrameSize, start, stop }
}
