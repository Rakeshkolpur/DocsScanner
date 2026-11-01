import { useState } from 'react'
import { Check, FileOutput } from 'lucide-react'
import { ToolShell, ErrorBanner } from '../components/ToolShell'
import { FileDropZone } from '../components/FileDropZone'
import { PdfLoadError, extractPages, type ExtractMode } from '../lib/pdfEngine'
import { renderPdfThumbnails, type PdfThumbnail } from '../lib/thumbnails'
import { parsePageRanges } from '../lib/pageRanges'
import { zipOutputs } from '../lib/zipOutputs'
import { downloadBlob, bytesToBlob, withoutExtension } from '../lib/download'
import '../components/ToolShell.css'
import './PageGrid.css'

export default function ExtractPage() {
  const [file, setFile] = useState<File | null>(null)
  const [thumbs, setThumbs] = useState<PdfThumbnail[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [rangeText, setRangeText] = useState('')
  const [mode, setMode] = useState<ExtractMode>('single-pdf')
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
      setSelected(new Set())
      setRangeText('')
    } catch (err) {
      setError(err instanceof PdfLoadError ? err.message : 'Could not read this PDF.')
    } finally {
      setIsLoading(false)
    }
  }

  function toggle(pageNumber: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pageNumber)) next.delete(pageNumber)
      else next.add(pageNumber)
      return next
    })
  }

  function applyRangeText() {
    if (!thumbs.length) return
    setError(null)
    const result = parsePageRanges(rangeText, thumbs.length)
    if (result.error) {
      setError(result.error)
      return
    }
    setSelected(new Set(result.pages))
  }

  async function handleExtract() {
    if (!file) return
    setError(null)
    if (selected.size === 0) {
      setError('Select at least one page.')
      return
    }
    setIsProcessing(true)
    try {
      const pageNumbers = [...selected].sort((a, b) => a - b)
      const outputs = await extractPages(file, pageNumbers, mode)
      if (outputs.length === 1) {
        downloadBlob(bytesToBlob(outputs[0].bytes, 'application/pdf'), outputs[0].name)
      } else {
        const zip = await zipOutputs(outputs, 'extracted.zip')
        downloadBlob(zip, `${withoutExtension(file.name)}_extracted.zip`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <ToolShell title="Extract Pages" description="Pick the pages you need and export them on their own.">
      {error && <ErrorBanner message={error} />}

      {!file ? (
        <FileDropZone accept="application/pdf" label="Drop a PDF here, or click to select" onFiles={handleFiles} />
      ) : (
        <>
          {isLoading && <p className="tool-hint">Rendering previews…</p>}

          <div className="tool-actions">
            <div className="tool-field" style={{ flex: 1 }}>
              <input
                type="text"
                placeholder="Or type a range, e.g. 1-5, 1,3,5, or 2-4,7-9"
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyRangeText()}
              />
            </div>
            <button className="btn" onClick={applyRangeText}>
              Apply
            </button>
          </div>

          <div className="page-grid">
            {thumbs.map((thumb) => {
              const isSelected = selected.has(thumb.pageNumber)
              return (
                <div className={`page-cell${isSelected ? ' page-cell--selected' : ''}`} key={thumb.pageNumber} onClick={() => toggle(thumb.pageNumber)}>
                  <button className="page-cell__select" aria-label={isSelected ? 'Deselect page' : 'Select page'}>
                    {isSelected && <Check size={12} />}
                  </button>
                  <div className="page-cell__thumb-wrap">
                    <img src={thumb.dataUrl} alt={`Page ${thumb.pageNumber}`} />
                  </div>
                  <div className="page-cell__footer">
                    <span>Page {thumb.pageNumber}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="tool-section">
            <label className="tool-field">
              <span>Output</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as ExtractMode)}>
                <option value="single-pdf">One PDF with all selected pages</option>
                <option value="separate-pdfs">A separate PDF per page</option>
              </select>
            </label>
          </div>

          <div className="tool-actions">
            <span className="tool-hint">{selected.size} page{selected.size === 1 ? '' : 's'} selected</span>
          </div>
          <div className="tool-actions">
            <button className="btn btn-primary" onClick={handleExtract} disabled={isProcessing || selected.size === 0}>
              {isProcessing ? <span className="spinner" /> : <FileOutput size={16} />}
              {isProcessing ? 'Extracting…' : 'Extract & Download'}
            </button>
          </div>
        </>
      )}
    </ToolShell>
  )
}
