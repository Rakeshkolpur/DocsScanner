import type { Point } from './homography'
import type { EnhanceOptions } from './imageEnhance'
import type {
  ScanDetectRequest,
  ScanDetectResponse,
  ScanProcessRequest,
  ScanProcessResponse,
} from '../workers/scanProcessor.worker'

let worker: Worker | null = null
let nextId = 1
const pendingProcess = new Map<number, (data: ImageData) => void>()
const pendingDetect = new Map<number, (corners: [Point, Point, Point, Point] | null) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/scanProcessor.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<ScanProcessResponse | ScanDetectResponse>) => {
      const data = event.data
      if (data.kind === 'detect') {
        const resolve = pendingDetect.get(data.id)
        if (resolve) {
          resolve(data.corners)
          pendingDetect.delete(data.id)
        }
        return
      }
      const resolve = pendingProcess.get(data.id)
      if (resolve) {
        resolve(data.imageData)
        pendingProcess.delete(data.id)
      }
    }
  }
  return worker
}

export function processScan(
  imageData: ImageData,
  corners: [Point, Point, Point, Point],
  destWidth: number,
  destHeight: number,
  rotationDeg: number,
  enhance: EnhanceOptions,
): Promise<ImageData> {
  return new Promise((resolve) => {
    const id = nextId++
    pendingProcess.set(id, resolve)
    // Clone before transferring — postMessage with a transfer list neuters the
    // source buffer, and callers may reuse the same captured ImageData again.
    const clone = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height)
    const request: ScanProcessRequest = { kind: 'process', id, imageData: clone, corners, destWidth, destHeight, rotationDeg, enhance }
    getWorker().postMessage(request, [clone.data.buffer])
  })
}

export function detectCorners(imageData: ImageData): Promise<[Point, Point, Point, Point] | null> {
  return new Promise((resolve) => {
    const id = nextId++
    pendingDetect.set(id, resolve)
    const clone = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height)
    const request: ScanDetectRequest = { kind: 'detect', id, imageData: clone }
    getWorker().postMessage(request, [clone.data.buffer])
  })
}

export function terminateScanProcessor() {
  worker?.terminate()
  worker = null
  pendingProcess.clear()
  pendingDetect.clear()
}
