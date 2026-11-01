import { useState } from 'react'
import { Plus, X, Scissors } from 'lucide-react'
import { ToolShell, ErrorBanner } from '../components/ToolShell'
import { FileDropZone } from '../components/FileDropZone'
import { splitPdf, getPageCount, PdfLoadError } from '../lib/pdfEngine'
import { parsePageRanges } from '../lib/pageRanges'
import { zipOutputs } from '../lib/zipOutputs'
import { downloadBlob, bytesToBlob, withoutExtension } from '../lib/download'
import '../components/ToolShell.css'

type Mode = 'each-page' | 'ranges'

export default function SplitPage() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('each-page')
  const [rangeInputs, setRangeInputs] = useState<string[]>([''])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: File[]) {
    setError(null)
    setFile(files[0])
    setPageCount(null)
    try {
      setPageCount(await getPageCount(files[0]))
    } catch (err) {
      setError(err instanceof PdfLoadError ? err.message : 'Could not read this PDF.')
      setFile(null)
    }
  }

  function validateRanges(): number[][] | null {
    if (!pageCount) return null
    const groups: number[][] = []
    for (const input of rangeInputs) {
      if (!input.trim()) continue
      const result = parsePageRanges(input, pageCount)
      if (result.error) {
        setError(result.error)
        return null
      }
      groups.push(result.pages)
    }
    if (groups.length === 0) {
      setError('Add at least one page range.')
      return null
    }
    return groups
  }

  async function handleSplit() {
    if (!file) return
    setError(null)

    let ranges: number[][] | undefined
    if (mode === 'ranges') {
      const validated = validateRanges()
      if (!validated) return
      ranges = validated
    }

    setIsProcessing(true)
    try {
      const outputs = await splitPdf(file, mode, ranges)
      if (outputs.length === 1) {
        downloadBlob(bytesToBlob(outputs[0].bytes, 'application/pdf'), outputs[0].name)
      } else {
        const zip = await zipOutputs(outputs, 'split.zip')
        downloadBlob(zip, `${withoutExtension(file.name)}_split.zip`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Split failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <ToolShell title="Split PDF" description="Break a PDF into individual pages or custom ranges.">
      {error && <ErrorBanner message={error} />}

      {!file ? (
        <FileDropZone accept="application/pdf" label="Drop a PDF here, or click to select" onFiles={handleFiles} />
      ) : (
        <>
          <div className="tool-file-row">
            <span className="tool-file-row__name">{file.name}</span>
            <span className="tool-file-row__meta">{pageCount != null ? `${pageCount} pages` : 'Reading…'}</span>
            <button className="btn" onClick={() => { setFile(null); setPageCount(null) }}>
              Change
            </button>
          </div>

          <div className="tool-section">
            <label className="tool-field">
              <span>Split mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="each-page">Every page as a separate PDF</option>
                <option value="ranges">Custom ranges</option>
              </select>
            </label>

            {mode === 'ranges' && (
              <div className="tool-section">
                {rangeInputs.map((value, index) => (
                  <div className="tool-actions" key={index}>
                    <div className="tool-field" style={{ flex: 1 }}>
                      <input
                        type="text"
                        placeholder="e.g. 1-5, 1,3,5, or 2-4,7-9"
                        value={value}
                        onChange={(e) =>
                          setRangeInputs((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))
                        }
                      />
                    </div>
                    <button
                      className="btn"
                      aria-label="Remove range"
                      onClick={() => setRangeInputs((prev) => prev.filter((_, i) => i !== index))}
                      disabled={rangeInputs.length === 1}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button className="btn" onClick={() => setRangeInputs((prev) => [...prev, ''])}>
                  <Plus size={14} /> Add another output
                </button>
                <p className="tool-hint">
                  Each row becomes one downloaded PDF. Use commas and dashes, e.g. 1-5, 1,3,5, or 2-4,7-9.
                </p>
              </div>
            )}
          </div>

          <div className="tool-actions">
            <button className="btn btn-primary" onClick={handleSplit} disabled={isProcessing}>
              {isProcessing ? <span className="spinner" /> : <Scissors size={16} />}
              {isProcessing ? 'Splitting…' : 'Split & Download'}
            </button>
          </div>
        </>
      )}
    </ToolShell>
  )
}
