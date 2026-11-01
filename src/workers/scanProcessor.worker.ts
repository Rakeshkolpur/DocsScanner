import { warpPerspective } from '../lib/warpPerspective'
import { applyEnhancements, type EnhanceOptions } from '../lib/imageEnhance'
import { detectDocumentCorners } from '../lib/autoDetectCorners'
import type { Point } from '../lib/homography'

export interface ScanProcessRequest {
  kind: 'process'
  id: number
  imageData: ImageData
  corners: [Point, Point, Point, Point]
  destWidth: number
  destHeight: number
  rotationDeg: number
  enhance: EnhanceOptions
}

export interface ScanProcessResponse {
  kind: 'process'
  id: number
  imageData: ImageData
}

export interface ScanDetectRequest {
  kind: 'detect'
  id: number
  imageData: ImageData
}

export interface ScanDetectResponse {
  kind: 'detect'
  id: number
  corners: [Point, Point, Point, Point] | null
}

type ScanRequest = ScanProcessRequest | ScanDetectRequest

self.onmessage = (event: MessageEvent<ScanRequest>) => {
  const request = event.data

  if (request.kind === 'detect') {
    const corners = detectDocumentCorners(request.imageData)
    const response: ScanDetectResponse = { kind: 'detect', id: request.id, corners }
    ;(self as unknown as Worker).postMessage(response)
    return
  }

  const { id, imageData, corners, destWidth, destHeight, rotationDeg, enhance } = request
  let warped = warpPerspective(imageData, corners, destWidth, destHeight)
  warped = rotateImageData(warped, rotationDeg)
  applyEnhancements(warped.data, enhance)

  const response: ScanProcessResponse = { kind: 'process', id, imageData: warped }
  // ImageData's underlying buffer is transferable.
  ;(self as unknown as Worker).postMessage(response, [warped.data.buffer])
}

function rotateImageData(src: ImageData, degreesCW: number): ImageData {
  const normalized = ((degreesCW % 360) + 360) % 360
  if (normalized === 0) return src
  if (normalized !== 90 && normalized !== 180 && normalized !== 270) return src

  const { width: w, height: h, data } = src
  const newW = normalized === 180 ? w : h
  const newH = normalized === 180 ? h : w
  const out = new ImageData(newW, newH)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4
      let dx: number, dy: number
      if (normalized === 90) {
        dx = h - 1 - y
        dy = x
      } else if (normalized === 270) {
        dx = y
        dy = w - 1 - x
      } else {
        dx = w - 1 - x
        dy = h - 1 - y
      }
      const dstIdx = (dy * newW + dx) * 4
      out.data[dstIdx] = data[srcIdx]
      out.data[dstIdx + 1] = data[srcIdx + 1]
      out.data[dstIdx + 2] = data[srcIdx + 2]
      out.data[dstIdx + 3] = data[srcIdx + 3]
    }
  }

  return out
}
