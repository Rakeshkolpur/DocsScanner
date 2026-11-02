import { loadImageElement } from './imageDataUtils'

/**
 * Stitches multiple page images into one continuous vertical image — handy for
 * sharing a multi-page receipt or note as a single scrollable screenshot instead
 * of a PDF. Pages are scaled to a common width before stacking.
 */
export async function stitchLongImage(pageDataUrls: string[], targetWidth = 1000): Promise<Blob> {
  if (pageDataUrls.length === 0) {
    throw new Error('No pages to stitch.')
  }

  const images = await Promise.all(pageDataUrls.map((url) => loadImageElement(url)))
  const scaledHeights = images.map((img) => Math.round((img.naturalHeight / img.naturalWidth) * targetWidth))
  const gap = 12
  const totalHeight = scaledHeights.reduce((sum, h) => sum + h, 0) + gap * (images.length - 1)

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  let y = 0
  images.forEach((img, i) => {
    ctx.drawImage(img, 0, y, targetWidth, scaledHeights[i])
    y += scaledHeights[i] + gap
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not render the long image.'))
    }, 'image/jpeg', 0.9)
  })
}
