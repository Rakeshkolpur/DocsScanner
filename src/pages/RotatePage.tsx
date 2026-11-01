import { useState } from 'react'
import { RotateCcw, RotateCw, Check, Download } from 'lucide-react'
import { ToolShell, ErrorBanner } from '../components/ToolShell'
import { FileDropZone } from '../components/FileDropZone'
import { PdfLoadError, rotatePdfPages } from '../lib/pdfEngine'
import { renderPdfThumbnails, type PdfThumbnail } from '../lib/thumbnails'
import { downloadBlob, bytesToBlob, withoutExtension } from '../lib/download'
import '../components/ToolShell.css'
import './PageGrid.css'

export default function RotatePage() {
  const [file, setFile] = useState<File | null>(null)
  const [thumbs, setThumbs] = useState<PdfThumbnail[]>([])
  const [rotations, setRotations] = useState<Map<number, number>>(new Map())
  const [selected, setSelected] = useState<Set<number>>(new Set())
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
      setThumbs(rendered)
      setRotations(new Map())
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof PdfLoadError ? err.message : 'Could not read this PDF.')
    } finally {
      setIsLoading(false)
    }
  }

  function rotateSingle(pageNumber: number, delta: number) {
    setRotations((prev) => {
      const next = new Map(prev)
      next.set(pageNumber, ((next.get(pageNumber) ?? 0) + delta + 360) % 360)
      return next
    })
  }

  function rotateSelection(delta: number) {
    const targets = selected.size > 0 ? selected : new Set(thumbs.map((t) => t.pageNumber))
    setRotations((prev) => {
      const next = new Map(prev)
      for (const pageNumber of targets) {
        next.set(pageNumber, ((next.get(pageNumber) ?? 0) + delta + 360) % 360)
      }
      return next
    })
  }

  function toggleSelect(pageNumber: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pageNumber)) next.delete(pageNumber)
      else next.add(pageNumber)
      return next
    })
  }

  async function handleApply() {
    if (!file) return
    setError(null)
    setIsProcessing(true)
    try {
      const bytes = await rotatePdfPages(file, rotations)
      downloadBlob(bytesToBlob(bytes, 'application/pdf'), `${withoutExtension(file.name)}_rotated.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotation failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  const hasChanges = [...rotations.values()].some((v) => v !== 0)

  return (
    <ToolShell title="Rotate Pages" description="Rotate individual pages, a selection, or the whole document.">
      {error && <ErrorBanner message={error} />}

      {!file ? (
        <FileDropZone accept="application/pdf" label="Drop a PDF here, or click to select" onFiles={handleFiles} />
      ) : (
        <>
          {isLoading && <p className="tool-hint">Rendering previews…</p>}

          <div className="tool-actions">
            <button className="btn" onClick={() => rotateSelection(-90)}>
              <RotateCcw size={14} /> Rotate left {selected.size > 0 ? `(${selected.size})` : '(all)'}
            </button>
            <button className="btn" onClick={() => rotateSelection(90)}>
              <RotateCw size={14} /> Rotate right {selected.size > 0 ? `(${selected.size})` : '(all)'}
            </button>
            {selected.size > 0 && (
              <button className="btn" onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
            )}
          </div>

          <div className="page-grid">
            {thumbs.map((thumb) => {
              const rotation = rotations.get(thumb.pageNumber) ?? 0
              const isSelected = selected.has(thumb.pageNumber)
              return (
                <div className={`page-cell${isSelected ? ' page-cell--selected' : ''}`} key={thumb.pageNumber}>
                  <button
                    className="page-cell__select"
                    onClick={() => toggleSelect(thumb.pageNumber)}
                    aria-label={isSelected ? 'Deselect page' : 'Select page'}
                  >
                    {isSelected && <Check size={12} />}
                  </button>
                  <div className="page-cell__thumb-wrap">
                    <img
                      src={thumb.dataUrl}
                      alt={`Page ${thumb.pageNumber}`}
                      style={{ transform: `rotate(${rotation}deg)` }}
                    />
                  </div>
                  <div className="page-cell__footer">
                    <span>Page {thumb.pageNumber}</span>
                    <div className="page-cell__mini-actions">
                      <button onClick={() => rotateSingle(thumb.pageNumber, -90)} aria-label="Rotate page left">
                        <RotateCcw size={12} />
                      </button>
                      <button onClick={() => rotateSingle(thumb.pageNumber, 90)} aria-label="Rotate page right">
                        <RotateCw size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="tool-actions">
            <button className="btn btn-primary" onClick={handleApply} disabled={isProcessing || !hasChanges}>
              {isProcessing ? <span className="spinner" /> : <Download size={16} />}
              {isProcessing ? 'Saving…' : 'Save & Download'}
            </button>
          </div>
        </>
      )}
    </ToolShell>
  )
}
