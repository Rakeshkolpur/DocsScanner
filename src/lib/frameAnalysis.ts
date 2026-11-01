import { downscaleToGray } from './autoDetectCorners'

export interface SmallFrame {
  gray: Uint8ClampedArray
  width: number
  height: number
}

/** Downscales a live frame to a tiny grayscale buffer — cheap enough to analyze many times a second. */
export function toSmallFrame(imageData: ImageData, maxDim = 64): SmallFrame {
  const { gray, width, height } = downscaleToGray(imageData, maxDim)
  return { gray, width, height }
}

/**
 * Laplacian-variance sharpness score: a page held still and in focus has strong,
 * consistent edges; a page mid-flip (motion blur) flattens them out. Higher = sharper.
 */
export function sharpnessScore(frame: SmallFrame): number {
  const { gray, width, height } = frame
  if (width < 3 || height < 3) return 0

  let sum = 0
  let sumSq = 0
  let count = 0

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const laplacian =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width]
      sum += laplacian
      sumSq += laplacian * laplacian
      count++
    }
  }

  if (count === 0) return 0
  const mean = sum / count
  return sumSq / count - mean * mean
}

/** Mean absolute grayscale difference between two same-sized frames, normalized to 0..1. */
export function frameDifference(a: SmallFrame, b: SmallFrame): number {
  if (a.width !== b.width || a.height !== b.height || a.gray.length !== b.gray.length) return 1
  let total = 0
  for (let i = 0; i < a.gray.length; i++) {
    total += Math.abs(a.gray[i] - b.gray[i])
  }
  return total / a.gray.length / 255
}
