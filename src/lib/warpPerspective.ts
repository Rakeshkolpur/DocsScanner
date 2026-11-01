import { solveHomography, applyHomography, type Point } from './homography'

/**
 * Warps the quad region `srcCorners` (in source pixel coords, order: TL, TR, BR, BL)
 * out of `src` into a flat `destWidth` x `destHeight` image, using inverse mapping
 * with bilinear sampling. Pure JS — no WASM/OpenCV dependency.
 */
export function warpPerspective(
  src: ImageData,
  srcCorners: [Point, Point, Point, Point],
  destWidth: number,
  destHeight: number,
): ImageData {
  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: destWidth, y: 0 },
    { x: destWidth, y: destHeight },
    { x: 0, y: destHeight },
  ]

  // Maps destination coords directly to source coords.
  const h = solveHomography(dstCorners, srcCorners)
  const out = new ImageData(destWidth, destHeight)
  const srcData = src.data
  const srcW = src.width
  const srcH = src.height

  for (let y = 0; y < destHeight; y++) {
    for (let x = 0; x < destWidth; x++) {
      const { x: sx, y: sy } = applyHomography(h, x, y)
      const outIdx = (y * destWidth + x) * 4

      if (sx < 0 || sy < 0 || sx > srcW - 1 || sy > srcH - 1) {
        out.data[outIdx + 3] = 255 // transparent-safe default: opaque white
        out.data[outIdx] = 255
        out.data[outIdx + 1] = 255
        out.data[outIdx + 2] = 255
        continue
      }

      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const x1 = Math.min(x0 + 1, srcW - 1)
      const y1 = Math.min(y0 + 1, srcH - 1)
      const fx = sx - x0
      const fy = sy - y0

      for (let c = 0; c < 4; c++) {
        const p00 = srcData[(y0 * srcW + x0) * 4 + c]
        const p10 = srcData[(y0 * srcW + x1) * 4 + c]
        const p01 = srcData[(y1 * srcW + x0) * 4 + c]
        const p11 = srcData[(y1 * srcW + x1) * 4 + c]
        const top = p00 + (p10 - p00) * fx
        const bottom = p01 + (p11 - p01) * fx
        out.data[outIdx + c] = top + (bottom - top) * fy
      }
    }
  }

  return out
}
