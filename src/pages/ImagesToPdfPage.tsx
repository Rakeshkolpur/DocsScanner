import { useState } from 'react'
import { ChevronUp, ChevronDown, X, FileDown } from 'lucide-react'
import { ToolShell, ErrorBanner } from '../components/ToolShell'
import { FileDropZone } from '../components/FileDropZone'
import { imagesToPdf } from '../lib/pdfEngine'
import { downloadBlob, bytesToBlob } from '../lib/download'
import '../components/ToolShell.css'

interface ImageEntry {
  file: File
  previewUrl: string
  type: 'png' | 'jpg'
}

function detectType(file: File): 'png' | 'jpg' | null {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') return 'jpg'
  return null
}

export default function ImagesToPdfPage() {
  const [entries, setEntries] = useState<ImageEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFiles(files: File[]) {
    const accepted: ImageEntry[] = []
    const rejected: string[] = []
    for (const file of files) {
      const type = detectType(file)
      if (!type) {
        rejected.push(file.name)
        continue
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file), type })
    }
    if (rejected.length > 0) {
      setError(`Unsupported file type: ${rejected.join(', ')}. Only PNG and JPG images are supported.`)
    } else {
      setError(null)
    }
    setEntries((prev) => [...prev, ...accepted])
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
    setEntries((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleConvert() {
    if (entries.length === 0) return
    setError(null)
    setIsProcessing(true)
    try {
      const images = await Promise.all(
        entries.map(async (e) => ({ bytes: new Uint8Array(await e.file.arrayBuffer()), type: e.type })),
      )
      const bytes = await imagesToPdf(images)
      downloadBlob(bytesToBlob(bytes, 'application/pdf'), 'images.pdf')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <ToolShell title="Images to PDF" description="Turn photos or screenshots into a single PDF, one page per image.">
      {error && <ErrorBanner message={error} />}

      <FileDropZone
        accept="image/png,image/jpeg"
        multiple
        label="Drop images here, or click to select"
        hint="PNG and JPG supported. Add as many as you like."
        onFiles={handleFiles}
      />

      {entries.length > 0 && (
        <div className="image-list">
          {entries.map((entry, index) => (
            <div className="image-list__row" key={`${entry.file.name}-${index}`}>
              <img src={entry.previewUrl} alt={entry.file.name} className="image-list__thumb" />
              <span className="tool-file-row__name">{entry.file.name}</span>
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
        <button className="btn btn-primary" onClick={handleConvert} disabled={isProcessing || entries.length === 0}>
          {isProcessing ? <span className="spinner" /> : <FileDown size={16} />}
          {isProcessing ? 'Converting…' : 'Convert & Download'}
        </button>
      </div>
    </ToolShell>
  )
}
