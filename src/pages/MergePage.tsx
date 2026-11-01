import { useState } from 'react'
import { ChevronUp, ChevronDown, X, Combine } from 'lucide-react'
import { ToolShell, ErrorBanner } from '../components/ToolShell'
import { FileDropZone } from '../components/FileDropZone'
import { mergePdfs, getPageCount, PdfLoadError } from '../lib/pdfEngine'
import { downloadBlob, bytesToBlob } from '../lib/download'
import '../components/ToolShell.css'

interface Entry {
  file: File
  pageCount: number | null
  error: string | null
}

export default function MergePage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: File[]) {
    const pdfFiles = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdfFiles.length === 0) {
      setError('Only PDF files are supported.')
      return
    }
    setError(null)
    const newEntries: Entry[] = pdfFiles.map((file) => ({ file, pageCount: null, error: null }))
    setEntries((prev) => [...prev, ...newEntries])

    for (const entry of newEntries) {
      try {
        const count = await getPageCount(entry.file)
        setEntries((prev) =>
          prev.map((e) => (e.file === entry.file ? { ...e, pageCount: count } : e)),
        )
      } catch (err) {
        const message = err instanceof PdfLoadError ? err.message : `"${entry.file.name}" could not be read.`
        setEntries((prev) => prev.map((e) => (e.file === entry.file ? { ...e, error: message } : e)))
      }
    }
  }

  function move(index: number, dir: -1 | 1) {
    setEntries((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function remove(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleMerge() {
    setError(null)
    const validEntries = entries.filter((e) => !e.error)
    if (validEntries.length < 2) {
      setError('Add at least two valid PDF files to merge.')
      return
    }
    setIsProcessing(true)
    try {
      const bytes = await mergePdfs(validEntries.map((e) => e.file))
      downloadBlob(bytesToBlob(bytes, 'application/pdf'), 'merged.pdf')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <ToolShell title="Merge PDF" description="Combine multiple PDFs into one file, in the order you choose.">
      {error && <ErrorBanner message={error} />}

      <FileDropZone
        accept="application/pdf"
        multiple
        label="Drop PDFs here, or click to select"
        hint="You can add more files anytime before merging."
        onFiles={handleFiles}
      />

      {entries.length > 0 && (
        <div className="tool-section">
          {entries.map((entry, index) => (
            <div className="tool-file-row" key={`${entry.file.name}-${index}`}>
              <span className="tool-file-row__name">{entry.file.name}</span>
              <span className="tool-file-row__meta">
                {entry.error ? entry.error : entry.pageCount != null ? `${entry.pageCount} pages` : 'Reading…'}
              </span>
              <button className="btn" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                <ChevronUp size={14} />
              </button>
              <button
                className="btn"
                onClick={() => move(index, 1)}
                disabled={index === entries.length - 1}
                aria-label="Move down"
              >
                <ChevronDown size={14} />
              </button>
              <button className="btn btn-danger" onClick={() => remove(index)} aria-label="Remove">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="tool-actions">
        <button className="btn btn-primary" onClick={handleMerge} disabled={isProcessing || entries.length < 2}>
          {isProcessing ? <span className="spinner" /> : <Combine size={16} />}
          {isProcessing ? 'Merging…' : 'Merge & Download'}
        </button>
      </div>
    </ToolShell>
  )
}
