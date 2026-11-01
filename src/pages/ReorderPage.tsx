import { useState, type DragEvent } from 'react'
import { Trash2, Download, Undo2 } from 'lucide-react'
import { ToolShell, ErrorBanner } from '../components/ToolShell'
import { FileDropZone } from '../components/FileDropZone'
import { PdfLoadError, reorderPdf } from '../lib/pdfEngine'
import { renderPdfThumbnails, type PdfThumbnail } from '../lib/thumbnails'
import { downloadBlob, bytesToBlob, withoutExtension } from '../lib/download'
import '../components/ToolShell.css'
import './PageGrid.css'

export default function ReorderPage() {
  const [file, setFile] = useState<File | null>(null)
  const [thumbs, setThumbs] = useState<Map<number, PdfThumbnail>>(new Map())
  const [order, setOrder] = useState<number[]>([])
  const [history, setHistory] = useState<number[][]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: File[]) {
    setError(null)
    setIsLoading(true)
    try {
      const bytes = new Uint8Array(await files[0].arrayBuffer())
      const rendered = await renderPdfThumbnails(bytes)
      setFile(files[0])
      setThumbs(new Map(rendered.map((t) => [t.pageNumber, t])))
      setOrder(rendered.map((t) => t.pageNumber))
      setHistory([])
    } catch (err) {
      setError(err instanceof PdfLoadError ? err.message : 'Could not read this PDF.')
    } finally {
      setIsLoading(false)
    }
  }

  function pushHistory() {
    setHistory((prev) => [...prev, order])
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return
    pushHistory()
    setOrder((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  function deletePage(pageNumber: number) {
    pushHistory()
    setOrder((prev) => prev.filter((p) => p !== pageNumber))
  }

  function undo() {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const last = next.pop()!
      setOrder(last)
      return next
    })
  }

  async function handleSave() {
    if (!file) return
    setError(null)
    if (order.length === 0) {
      setError('At least one page must remain.')
      return
    }
    setIsProcessing(true)
    try {
      const bytes = await reorderPdf(file, order)
      downloadBlob(bytesToBlob(bytes, 'application/pdf'), `${withoutExtension(file.name)}_reordered.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <ToolShell title="Reorder Pages" description="Drag pages into the order you want, or delete the ones you don't need.">
      {error && <ErrorBanner message={error} />}

      {!file ? (
        <FileDropZone accept="application/pdf" label="Drop a PDF here, or click to select" onFiles={handleFiles} />
      ) : (
        <>
          {isLoading && <p className="tool-hint">Rendering previews…</p>}

          <div className="tool-actions">
            <button className="btn" onClick={undo} disabled={history.length === 0}>
              <Undo2 size={14} /> Undo
            </button>
            <span className="tool-hint">{order.length} page{order.length === 1 ? '' : 's'} remaining</span>
          </div>

          <div className="page-grid">
            {order.map((pageNumber, index) => {
              const thumb = thumbs.get(pageNumber)
              if (!thumb) return null
              return (
                <div
                  className={`page-cell${dragIndex === index ? ' page-cell--dragging' : ''}`}
                  key={pageNumber}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e: DragEvent) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => setDragIndex(null)}
                >
                  <button className="page-cell__delete" onClick={() => deletePage(pageNumber)} aria-label="Delete page">
                    <Trash2 size={11} />
                  </button>
                  <div className="page-cell__thumb-wrap">
                    <img src={thumb.dataUrl} alt={`Page ${pageNumber}`} />
                  </div>
                  <div className="page-cell__footer">
                    <span>Position {index + 1} (was {pageNumber})</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="tool-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={isProcessing}>
              {isProcessing ? <span className="spinner" /> : <Download size={16} />}
              {isProcessing ? 'Saving…' : 'Save & Download'}
            </button>
          </div>
        </>
      )}
    </ToolShell>
  )
}
