import { imageUrlToImageData, imageDataToDataUrl } from './imageDataUtils'
import { applyEnhancements, type EnhanceOptions } from './imageEnhance'

/**
 * Rotates a plain (unenhanced) page image by 90/180/270. Pages are edited as
 * base + enhancement so re-filtering never compounds — always rotate the base,
 * then re-render the enhanced preview from the rotated base.
 */
export async function rotateBaseImage(baseDataUrl: string, degreesCW: 90 | 180 | 270): Promise<string> {
  const src = await imageUrlToImageData(baseDataUrl)
  const normalized = ((degreesCW % 360) + 360) % 360
  const newW = normalized === 180 ? src.width : src.height
  const newH = normalized === 180 ? src.height : src.width

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = src.width
  srcCanvas.height = src.height
  srcCanvas.getContext('2d')!.putImageData(src, 0, 0)

  const out = document.createElement('canvas')
  out.width = newW
  out.height = newH
  const ctx = out.getContext('2d')!
  ctx.translate(newW / 2, newH / 2)
  ctx.rotate((normalized * Math.PI) / 180)
  ctx.drawImage(srcCanvas, -src.width / 2, -src.height / 2)
  return out.toDataURL('image/jpeg', 0.92)
}

/** Renders the enhanced preview fresh from the plain base image (never cumulative). */
export async function renderEnhanced(baseDataUrl: string, enhance: EnhanceOptions): Promise<string> {
  const data = await imageUrlToImageData(baseDataUrl)
  applyEnhancements(data.data, data.width, data.height, enhance)
  return imageDataToDataUrl(data)
}
