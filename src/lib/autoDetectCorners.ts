import type { Point } from './homography'

/**
 * Pure-JS document edge detection (no OpenCV/WASM): downscale, grayscale,
 * blur, compute a Sobel edge map, dilate it to close small gaps along the
 * page's border, then flood-fill the largest enclosed (non-edge) region that
 * doesn't touch the frame — that's the page interior. Convex-hull its
 * boundary, then pick the 4 extreme corners.
 *
 * This classifies by *edges*, not by pixel color/threshold — a document with
 * printed text, photos or colored sections still flood-fills as one region,
 * because its interior isn't cut off by any single internal edge loop large
 * enough to fully enclose it before reaching the real page boundary. An
 * earlier color-threshold version broke on exactly this case (any document
 * with real content, not just a blank page), since mixed-tone interiors
 * fragment into disconnected pieces under a single global threshold.
 *
 * Returns null when no confident quad can be found, so the caller can fall
 * back to manual corners rather than apply a wrong crop.
 */
export function detectDocumentCorners(src: ImageData, maxWorkingDim = 500): [Point, Point, Point, Point] | null {
  const { gray, width, height, scale } = downscaleToGray(src, maxWorkingDim)
  const blurred = boxBlur(gray, width, height, 1)
  const edgeMagnitude = sobelMagnitude(blurred, width, height)
  const threshold = otsuThreshold(edgeMagnitude)
  const edges = new Uint8Array(width * height)
  for (let i = 0; i < edgeMagnitude.length; i++) edges[i] = edgeMagnitude[i] > threshold ? 1 : 0

  const dilated = dilateBinary(edges, width, height, 2)
  const component = floodFillLargestInteriorComponent(dilated, width, height)
  if (!component) return null

  const totalPixels = width * height
  const coverage = component.size / totalPixels
  if (coverage < 0.1 || coverage > 0.95) {
    // Too small to be a confident document, or too large to distinguish from the background.
    return null
  }

  const hull = convexHull(component.boundary)
  if (hull.length < 4) return null

  const corners = pickQuadCorners(hull)
  if (!corners) return null

  // Scale back up to the original image's coordinate space.
  return corners.map((p) => ({ x: p.x / scale, y: p.y / scale })) as [Point, Point, Point, Point]
}

export function downscaleToGray(
  src: ImageData,
  maxDim: number,
): { gray: Uint8ClampedArray; width: number; height: number; scale: number } {
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height))
  const width = Math.max(1, Math.round(src.width * scale))
  const height = Math.max(1, Math.round(src.height * scale))
  const gray = new Uint8ClampedArray(width * height)

  for (let y = 0; y < height; y++) {
    const sy = Math.min(src.height - 1, Math.floor(y / scale))
    for (let x = 0; x < width; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale))
      const si = (sy * src.width + sx) * 4
      const r = src.data[si]
      const g = src.data[si + 1]
      const b = src.data[si + 2]
      gray[y * width + x] = 0.299 * r + 0.587 * g + 0.114 * b
    }
  }

  return { gray, width, height, scale }
}

/** Separable box blur approximating a Gaussian, run twice for a smoother result. */
function boxBlur(gray: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  let current = gray
  for (let pass = 0; pass < 2; pass++) {
    current = boxBlurPass(current, width, height, radius)
  }
  return current
}

function boxBlurPass(src: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const horizontal = new Float32Array(width * height)
  const windowSize = radius * 2 + 1

  for (let y = 0; y < height; y++) {
    let sum = 0
    for (let x = -radius; x <= radius; x++) {
      sum += src[y * width + clampIndex(x, width)]
    }
    for (let x = 0; x < width; x++) {
      horizontal[y * width + x] = sum / windowSize
      const addX = x + radius + 1
      const removeX = x - radius
      sum += src[y * width + clampIndex(addX, width)] - src[y * width + clampIndex(removeX, width)]
    }
  }

  const out = new Uint8ClampedArray(width * height)
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = -radius; y <= radius; y++) {
      sum += horizontal[clampIndex(y, height) * width + x]
    }
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / windowSize
      const addY = y + radius + 1
      const removeY = y - radius
      sum += horizontal[clampIndex(addY, height) * width + x] - horizontal[clampIndex(removeY, height) * width + x]
    }
  }

  return out
}

function clampIndex(i: number, max: number): number {
  return i < 0 ? 0 : i >= max ? max - 1 : i
}

/** 3x3 Sobel gradient magnitude, scaled down (÷4) and clamped to 0..255 so it can share the Otsu histogram helper. */
function sobelMagnitude(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = clampIndex(x - 1, width)
      const x1 = clampIndex(x + 1, width)
      const y0 = clampIndex(y - 1, height)
      const y1 = clampIndex(y + 1, height)

      const tl = gray[y0 * width + x0]
      const tc = gray[y0 * width + x]
      const tr = gray[y0 * width + x1]
      const ml = gray[y * width + x0]
      const mr = gray[y * width + x1]
      const bl = gray[y1 * width + x0]
      const bc = gray[y1 * width + x]
      const br = gray[y1 * width + x1]

      const gx = tr + 2 * mr + br - tl - 2 * ml - bl
      const gy = bl + 2 * bc + br - tl - 2 * tc - tr
      const magnitude = Math.sqrt(gx * gx + gy * gy) / 4
      out[y * width + x] = magnitude
    }
  }

  return out
}

/** Binary dilation (expands 1s) with a square structuring element, via separable max-filter passes. */
function dilateBinary(binary: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const horizontal = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0
      for (let dx = -radius; dx <= radius; dx++) {
        if (binary[y * width + clampIndex(x + dx, width)]) {
          m = 1
          break
        }
      }
      horizontal[y * width + x] = m
    }
  }

  const out = new Uint8Array(width * height)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let m = 0
      for (let dy = -radius; dy <= radius; dy++) {
        if (horizontal[clampIndex(y + dy, height) * width + x]) {
          m = 1
          break
        }
      }
      out[y * width + x] = m
    }
  }

  return out
}

/** Otsu's method: finds the threshold minimizing within-class variance from the (0-255) histogram. */
function otsuThreshold(values: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0)
  for (let i = 0; i < values.length; i++) histogram[values[i]]++

  const total = values.length
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * histogram[t]

  let sumBackground = 0
  let weightBackground = 0
  let maxVariance = 0
  let threshold = 127

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t]
    if (weightBackground === 0) continue
    const weightForeground = total - weightBackground
    if (weightForeground === 0) break

    sumBackground += t * histogram[t]
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (sum - sumBackground) / weightForeground
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2

    if (variance > maxVariance) {
      maxVariance = variance
      threshold = t
    }
  }

  return threshold
}

interface Component {
  size: number
  boundary: Point[]
}

/**
 * Iterative BFS flood fill (no recursion) over every connected region of
 * non-edge (0) pixels in a dilated edge map. Returns the largest region that
 * does NOT touch the image's outer border — a region touching the border is
 * either the area outside the page, or signals the page's edge loop wasn't
 * fully closed (a gap let the fill leak out), so it's disqualified either way.
 */
function floodFillLargestInteriorComponent(edges: Uint8Array, width: number, height: number): Component | null {
  const visited = new Uint8Array(width * height)
  let best: Component | null = null
  const queue = new Int32Array(width * height)

  for (let start = 0; start < edges.length; start++) {
    if (edges[start] !== 0 || visited[start]) continue

    let head = 0
    let tail = 0
    queue[tail++] = start
    visited[start] = 1
    const boundary: Point[] = []
    let size = 0
    let touchesImageBorder = false

    while (head < tail) {
      const idx = queue[head++]
      size++
      const x = idx % width
      const y = (idx / width) | 0

      let isRegionBoundary = x === 0 || y === 0 || x === width - 1 || y === height - 1
      if (isRegionBoundary) touchesImageBorder = true

      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const nIdx = ny * width + nx
        if (edges[nIdx] !== 0) {
          isRegionBoundary = true
          continue
        }
        if (!visited[nIdx]) {
          visited[nIdx] = 1
          queue[tail++] = nIdx
        }
      }

      if (isRegionBoundary) boundary.push({ x, y })
    }

    if (!touchesImageBorder && (!best || size > best.size)) {
      best = { size, boundary }
    }
  }

  return best
}

/** Andrew's monotone chain convex hull, O(n log n). */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))

  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

  const lower: Point[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }

  const upper: Point[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }

  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}

/**
 * Picks 4 corners from a convex hull using the extremes of (x+y) and (x-y) —
 * robust for roughly-quadrilateral shapes photographed at an angle.
 */
function pickQuadCorners(hull: Point[]): [Point, Point, Point, Point] | null {
  let topLeft = hull[0]
  let bottomRight = hull[0]
  let topRight = hull[0]
  let bottomLeft = hull[0]

  for (const p of hull) {
    if (p.x + p.y < topLeft.x + topLeft.y) topLeft = p
    if (p.x + p.y > bottomRight.x + bottomRight.y) bottomRight = p
    if (p.x - p.y > topRight.x - topRight.y) topRight = p
    if (p.x - p.y < bottomLeft.x - bottomLeft.y) bottomLeft = p
  }

  const corners = [topLeft, topRight, bottomRight, bottomLeft]
  const unique = new Set(corners.map((p) => `${p.x},${p.y}`))
  if (unique.size < 4) return null

  return corners as [Point, Point, Point, Point]
}
