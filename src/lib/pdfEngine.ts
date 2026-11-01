import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib'

export class PdfLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PdfLoadError'
  }
}

async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

/** Loads a PDF file, surfacing clear errors for encrypted/corrupt files. */
export async function loadPdfDocument(file: File): Promise<PDFDocument> {
  const bytes = await fileToBytes(file)
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false })
  } catch (err) {
    const message = String(err)
    if (message.toLowerCase().includes('encrypt')) {
      throw new PdfLoadError(
        `"${file.name}" is password-protected. Remove the password before using it here.`,
        { cause: err },
      )
    }
    throw new PdfLoadError(`"${file.name}" could not be read — it may be corrupted or not a valid PDF.`, { cause: err })
  }
}

export async function getPageCount(file: File): Promise<number> {
  const doc = await loadPdfDocument(file)
  return doc.getPageCount()
}

/** Merges multiple PDFs in order, preserving vector content. */
export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  if (files.length < 2) {
    throw new Error('Select at least two PDFs to merge.')
  }
  const merged = await PDFDocument.create()
  for (const file of files) {
    const src = await loadPdfDocument(file)
    const pages = await merged.copyPages(src, src.getPageIndices())
    for (const page of pages) merged.addPage(page)
  }
  return merged.save()
}

export type SplitMode = 'each-page' | 'ranges'

export interface SplitOutput {
  name: string
  bytes: Uint8Array
}

/** Splits a PDF either into one file per page, or into one file per range group. */
export async function splitPdf(
  file: File,
  mode: SplitMode,
  ranges?: number[][],
): Promise<SplitOutput[]> {
  const src = await loadPdfDocument(file)
  const baseName = file.name.replace(/\.pdf$/i, '')
  const outputs: SplitOutput[] = []

  if (mode === 'each-page') {
    const count = src.getPageCount()
    for (let i = 0; i < count; i++) {
      const out = await PDFDocument.create()
      const [page] = await out.copyPages(src, [i])
      out.addPage(page)
      outputs.push({ name: `${baseName}_page_${i + 1}.pdf`, bytes: await out.save() })
    }
    return outputs
  }

  if (!ranges || ranges.length === 0) {
    throw new Error('No page ranges provided.')
  }
  for (let i = 0; i < ranges.length; i++) {
    const indices = ranges[i].map((p) => p - 1)
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, indices)
    for (const page of pages) out.addPage(page)
    outputs.push({ name: `${baseName}_part_${i + 1}.pdf`, bytes: await out.save() })
  }
  return outputs
}

export type RotationAngle = 90 | 180 | 270

/** Rotates selected pages (1-based indices) by the given angle; pass null for all pages. */
export async function rotatePdf(
  file: File,
  angle: RotationAngle,
  pageNumbers: number[] | null,
): Promise<Uint8Array> {
  const doc = await loadPdfDocument(file)
  const pages = doc.getPages()
  const targets = pageNumbers ?? pages.map((_, i) => i + 1)
  for (const pageNumber of targets) {
    const page = pages[pageNumber - 1]
    if (!page) continue
    const current = page.getRotation().angle
    page.setRotation(degrees((current + angle) % 360))
  }
  return doc.save()
}

/** Applies a distinct rotation delta (added to each page's current rotation) per 1-based page number. */
export async function rotatePdfPages(file: File, deltas: Map<number, number>): Promise<Uint8Array> {
  const doc = await loadPdfDocument(file)
  const pages = doc.getPages()
  for (const [pageNumber, delta] of deltas) {
    const page = pages[pageNumber - 1]
    if (!page || delta === 0) continue
    const current = page.getRotation().angle
    page.setRotation(degrees(((current + delta) % 360 + 360) % 360))
  }
  return doc.save()
}

/** Rebuilds a PDF with pages in the given 1-based order; indices omitted are dropped. */
export async function reorderPdf(file: File, order: number[]): Promise<Uint8Array> {
  const src = await loadPdfDocument(file)
  const out = await PDFDocument.create()
  const indices = order.map((n) => n - 1)
  const pages = await out.copyPages(src, indices)
  for (const page of pages) out.addPage(page)
  return out.save()
}

export type ExtractMode = 'single-pdf' | 'separate-pdfs'

/** Extracts the given 1-based page numbers, either as one PDF or as separate PDFs. */
export async function extractPages(
  file: File,
  pageNumbers: number[],
  mode: ExtractMode,
): Promise<SplitOutput[]> {
  const src = await loadPdfDocument(file)
  const baseName = file.name.replace(/\.pdf$/i, '')

  if (mode === 'single-pdf') {
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, pageNumbers.map((p) => p - 1))
    for (const page of pages) out.addPage(page)
    return [{ name: `${baseName}_extracted.pdf`, bytes: await out.save() }]
  }

  const outputs: SplitOutput[] = []
  for (const pageNumber of pageNumbers) {
    const out = await PDFDocument.create()
    const [page] = await out.copyPages(src, [pageNumber - 1])
    out.addPage(page)
    outputs.push({ name: `${baseName}_page_${pageNumber}.pdf`, bytes: await out.save() })
  }
  return outputs
}

export type WatermarkPosition =
  | 'center'
  | 'diagonal'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'repeated'

export interface TextWatermarkOptions {
  text: string
  fontSize: number
  color: { r: number; g: number; b: number }
  opacity: number
  rotationDeg: number
  position: WatermarkPosition
  marginPt: number
  pageNumbers: number[] | null
}

/** Applies a text watermark and returns a NEW document; the original bytes are never mutated. */
export async function addTextWatermark(file: File, options: TextWatermarkOptions): Promise<Uint8Array> {
  const doc = await loadPdfDocument(file)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const pages = doc.getPages()
  const targets = options.pageNumbers ?? pages.map((_, i) => i + 1)

  for (const pageNumber of targets) {
    const page = pages[pageNumber - 1]
    if (!page) continue
    const { width, height } = page.getSize()
    const textWidth = font.widthOfTextAtSize(options.text, options.fontSize)
    const textHeight = font.heightAtSize(options.fontSize)
    const color = rgb(options.color.r / 255, options.color.g / 255, options.color.b / 255)

    const draw = (x: number, y: number, rotationDeg: number) => {
      page.drawText(options.text, {
        x,
        y,
        size: options.fontSize,
        font,
        color,
        opacity: options.opacity,
        rotate: degrees(rotationDeg),
      })
    }

    if (options.position === 'repeated') {
      const stepX = textWidth + options.marginPt * 3
      const stepY = textHeight + options.marginPt * 4
      for (let y = options.marginPt; y < height; y += stepY) {
        for (let x = options.marginPt; x < width; x += stepX) {
          draw(x, y, options.rotationDeg)
        }
      }
      continue
    }

    let x = width / 2 - textWidth / 2
    let y = height / 2 - textHeight / 2
    let rotation = options.rotationDeg

    switch (options.position) {
      case 'center':
        break
      case 'diagonal':
        rotation = 45
        break
      case 'top-left':
        x = options.marginPt
        y = height - options.marginPt - textHeight
        break
      case 'top-right':
        x = width - options.marginPt - textWidth
        y = height - options.marginPt - textHeight
        break
      case 'bottom-left':
        x = options.marginPt
        y = options.marginPt
        break
      case 'bottom-right':
        x = width - options.marginPt - textWidth
        y = options.marginPt
        break
    }

    draw(x, y, rotation)
  }

  return doc.save()
}

export interface LogoWatermarkOptions {
  logoBytes: Uint8Array
  logoType: 'png' | 'jpg'
  scale: number // 0-1, fraction of page width
  opacity: number
  position: WatermarkPosition
  marginPt: number
  pageNumbers: number[] | null
}

export async function addLogoWatermark(file: File, options: LogoWatermarkOptions): Promise<Uint8Array> {
  const doc = await loadPdfDocument(file)
  const image = options.logoType === 'png' ? await doc.embedPng(options.logoBytes) : await doc.embedJpg(options.logoBytes)
  const pages = doc.getPages()
  const targets = options.pageNumbers ?? pages.map((_, i) => i + 1)

  for (const pageNumber of targets) {
    const page = pages[pageNumber - 1]
    if (!page) continue
    const { width: pageWidth, height: pageHeight } = page.getSize()
    const drawWidth = pageWidth * options.scale
    const drawHeight = drawWidth * (image.height / image.width)

    const place = (x: number, y: number) => {
      page.drawImage(image, { x, y, width: drawWidth, height: drawHeight, opacity: options.opacity })
    }

    if (options.position === 'repeated') {
      const stepX = drawWidth + options.marginPt * 2
      const stepY = drawHeight + options.marginPt * 2
      for (let y = options.marginPt; y < pageHeight; y += stepY) {
        for (let x = options.marginPt; x < pageWidth; x += stepX) {
          place(x, y)
        }
      }
      continue
    }

    let x = pageWidth / 2 - drawWidth / 2
    let y = pageHeight / 2 - drawHeight / 2

    switch (options.position) {
      case 'center':
      case 'diagonal':
        break
      case 'top-left':
        x = options.marginPt
        y = pageHeight - options.marginPt - drawHeight
        break
      case 'top-right':
        x = pageWidth - options.marginPt - drawWidth
        y = pageHeight - options.marginPt - drawHeight
        break
      case 'bottom-left':
        x = options.marginPt
        y = options.marginPt
        break
      case 'bottom-right':
        x = pageWidth - options.marginPt - drawWidth
        y = options.marginPt
        break
    }

    place(x, y)
  }

  return doc.save()
}

/** Builds a PDF from a list of images (one page per image), preserving aspect ratio. */
export async function imagesToPdf(images: { bytes: Uint8Array; type: 'png' | 'jpg' }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const img of images) {
    const embedded = img.type === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes)
    const page = doc.addPage([embedded.width, embedded.height])
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
  }
  return doc.save()
}
