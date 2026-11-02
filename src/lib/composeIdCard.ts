import { loadImageElement } from './imageDataUtils'

/** Stacks a captured ID card's front and back into one labeled page image. */
export async function composeIdCardPage(frontDataUrl: string, backDataUrl: string): Promise<string> {
  const [front, back] = await Promise.all([loadImageElement(frontDataUrl), loadImageElement(backDataUrl)])

  const width = Math.max(front.naturalWidth, back.naturalWidth)
  const frontHeight = Math.round((front.naturalHeight / front.naturalWidth) * width)
  const backHeight = Math.round((back.naturalHeight / back.naturalWidth) * width)
  const labelHeight = 36
  const gap = 20

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = labelHeight + frontHeight + gap + labelHeight + backHeight
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#6b6b6b'
  ctx.font = `${Math.round(labelHeight * 0.55)}px sans-serif`
  ctx.textBaseline = 'middle'

  let y = 0
  ctx.fillText('FRONT', 8, y + labelHeight / 2)
  y += labelHeight
  ctx.drawImage(front, 0, y, width, frontHeight)
  y += frontHeight + gap

  ctx.fillText('BACK', 8, y + labelHeight / 2)
  y += labelHeight
  ctx.drawImage(back, 0, y, width, backHeight)

  return canvas.toDataURL('image/jpeg', 0.92)
}
