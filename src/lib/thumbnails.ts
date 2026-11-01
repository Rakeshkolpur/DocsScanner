// Lazily loaded so pdf.js (and its worker) never ship in the homepage bundle.
let configured = false

async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!configured) {
    const workerUrl = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default
    configured = true
  }
  return pdfjs
}

export interface PdfThumbnail {
  pageNumber: number
  dataUrl: string
  widthPt: number
  heightPt: number
}

/** Renders every page of a PDF file to a thumbnail data URL at the given scale. */
export async function renderPdfThumbnails(bytes: Uint8Array, scale = 0.35): Promise<PdfThumbnail[]> {
  const pdfjs = await getPdfjs()
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const thumbnails: PdfThumbnail[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    thumbnails.push({
      pageNumber: i,
      dataUrl: canvas.toDataURL('image/jpeg', 0.75),
      widthPt: page.view[2],
      heightPt: page.view[3],
    })
    page.cleanup()
  }

  await doc.cleanup()
  return thumbnails
}

export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  const pdfjs = await getPdfjs()
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const count = doc.numPages
  await doc.cleanup()
  return count
}
