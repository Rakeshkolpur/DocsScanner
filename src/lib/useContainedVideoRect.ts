import { useEffect, useState, type RefObject } from 'react'

export interface ContainRect {
  left: number
  top: number
  width: number
  height: number
}

const FULL_RECT: ContainRect = { left: 0, top: 0, width: 100, height: 100 }

/** Pure geometry: the `object-fit: contain` rectangle (as % of the container) for a given media/container size. */
export function computeContainRect(mediaWidth: number, mediaHeight: number, containerWidth: number, containerHeight: number): ContainRect {
  if (!mediaWidth || !mediaHeight || !containerWidth || !containerHeight) return FULL_RECT

  const mediaAspect = mediaWidth / mediaHeight
  const containerAspect = containerWidth / containerHeight

  if (mediaAspect > containerAspect) {
    const displayedHeight = containerWidth / mediaAspect
    const topPct = ((containerHeight - displayedHeight) / 2 / containerHeight) * 100
    return { left: 0, top: topPct, width: 100, height: 100 - topPct * 2 }
  }

  const displayedWidth = containerHeight * mediaAspect
  const leftPct = ((containerWidth - displayedWidth) / 2 / containerWidth) * 100
  return { left: leftPct, top: 0, width: 100 - leftPct * 2, height: 100 }
}

/**
 * Tracks the visible rectangle (as percentages of its container) of a video
 * element rendered with `object-fit: contain` inside that container. Overlay
 * components positioned via percentages (corner outlines, guide boxes) need
 * this instead of assuming the video fills its container edge-to-edge —
 * otherwise a container/video aspect-ratio mismatch produces letterboxing
 * that silently shifts every percentage-based overlay off the real content.
 */
export function useContainedVideoRect(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLElement | null>,
): ContainRect {
  const [rect, setRect] = useState<ContainRect>(FULL_RECT)

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return

    function recompute() {
      const next = computeContainRect(video!.videoWidth, video!.videoHeight, container!.clientWidth, container!.clientHeight)
      setRect(next)
    }

    recompute()
    video.addEventListener('loadedmetadata', recompute)
    video.addEventListener('resize', recompute)
    const ro = new ResizeObserver(recompute)
    ro.observe(container)

    return () => {
      video.removeEventListener('loadedmetadata', recompute)
      video.removeEventListener('resize', recompute)
      ro.disconnect()
    }
  }, [videoRef, containerRef])

  return rect
}
