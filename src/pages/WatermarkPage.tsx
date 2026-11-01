import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Stamp, Image as ImageIcon, Download } from 'lucide-react'
import { ToolShell, ErrorBanner } from '../components/ToolShell'
import { FileDropZone } from '../components/FileDropZone'
import {
  PdfLoadError,
  addTextWatermark,
  addLogoWatermark,
  type WatermarkPosition,
} from '../lib/pdfEngine'
import { renderPdfThumbnails, type PdfThumbnail } from '../lib/thumbnails'
import { downloadBlob, bytesToBlob, withoutExtension } from '../lib/download'
import '../components/ToolShell.css'
import './WatermarkPage.css'

type Tab = 'text' | 'logo'

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'repeated', label: 'Repeated' },
]

const positionStyle = (position: WatermarkPosition): CSSProperties => {
  switch (position) {
    case 'top-left':
      return { top: 10, left: 10 }
    case 'top-right':
      return { top: 10, right: 10 }
    case 'bottom-left':
      return { bottom: 10, left: 10 }
    case 'bottom-right':
      return { bottom: 10, right: 10 }
    case 'diagonal':
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-45deg)' }
    default:
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
}

export default function WatermarkPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewThumb, setPreviewThumb] = useState<PdfThumbnail | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [tab, setTab] = useState<Tab>('text')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [text, setText] = useState('CONFIDENTIAL')
  const [fontSize, setFontSize] = useState(32)
  const [colorHex, setColorHex] = useState('#2563eb')
  const [opacity, setOpacity] = useState(0.4)
  const [rotationDeg, setRotationDeg] = useState(0)
  const [position, setPosition] = useState<WatermarkPosition>('diagonal')
  const [marginPt, setMarginPt] = useState(24)
  const [scope, setScope] = useState<'all' | 'first'>('all')

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [logoScale, setLogoScale] = useState(0.25)
  const [logoOpacity, setLogoOpacity] = useState(0.5)
  const [logoPosition, setLogoPosition] = useState<WatermarkPosition>('center')

  async function handleFiles(files: File[]) {
    setError(null)
    try {
      const bytes = new Uint8Array(await files[0].arrayBuffer())
      const rendered = await renderPdfThumbnails(bytes, 0.6)
      setFile(files[0])
      setPreviewThumb(rendered[0] ?? null)
      setPageCount(rendered.length)
    } catch (err) {
      setError(err instanceof PdfLoadError ? err.message : 'Could not read this PDF.')
    }
  }

  function handleLogoFile(files: File[]) {
    const f = files[0]
    if (f.type !== 'image/png' && f.type !== 'image/jpeg') {
      setError('Logo must be a PNG or JPG image.')
      return
    }
    setError(null)
    setLogoFile(f)
    setLogoPreviewUrl(URL.createObjectURL(f))
  }

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
    }
  }, [logoPreviewUrl])

  const rgbColor = useMemo(() => {
    const hex = colorHex.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return { r, g, b }
  }, [colorHex])

  async function handleApply() {
    if (!file) return
    setError(null)
    const pageNumbers = scope === 'all' ? null : [1]

    setIsProcessing(true)
    try {
      let bytes: Uint8Array
      if (tab === 'text') {
        if (!text.trim()) {
          setError('Enter watermark text.')
          setIsProcessing(false)
          return
        }
        bytes = await addTextWatermark(file, {
          text,
          fontSize,
          color: rgbColor,
          opacity,
          rotationDeg,
          position,
          marginPt,
          pageNumbers,
        })
      } else {
        if (!logoFile) {
          setError('Upload a logo image.')
          setIsProcessing(false)
          return
        }
        const logoBytes = new Uint8Array(await logoFile.arrayBuffer())
        bytes = await addLogoWatermark(file, {
          logoBytes,
          logoType: logoFile.type === 'image/png' ? 'png' : 'jpg',
          scale: logoScale,
          opacity: logoOpacity,
          position: logoPosition,
          marginPt: 24,
          pageNumbers,
        })
      }
      downloadBlob(bytesToBlob(bytes, 'application/pdf'), `${withoutExtension(file.name)}_watermarked.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watermarking failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <ToolShell title="Add Watermark" description="Stamp your own text or logo. FileQuik never adds its own watermark, and your original file is never modified.">
      {error && <ErrorBanner message={error} />}

      {!file ? (
        <FileDropZone accept="application/pdf" label="Drop a PDF here, or click to select" onFiles={handleFiles} />
      ) : (
        <>
          <div className="watermark-layout">
            <div className="watermark-preview">
              {previewThumb && <img src={previewThumb.dataUrl} alt="Page 1 preview" />}
              {tab === 'text' && text && (
                <span
                  className="watermark-preview__text"
                  style={{
                    ...positionStyle(position),
                    color: colorHex,
                    opacity,
                    fontSize: Math.max(10, fontSize / 2.2),
                    ...(position !== 'diagonal' ? { transform: `${positionStyle(position).transform ?? ''} rotate(${rotationDeg}deg)` } : {}),
                  }}
                >
                  {text}
                </span>
              )}
              {tab === 'logo' && logoPreviewUrl && (
                <img
                  className="watermark-preview__logo"
                  src={logoPreviewUrl}
                  alt="Logo preview"
                  style={{ ...positionStyle(logoPosition), width: `${logoScale * 100}%`, opacity: logoOpacity }}
                />
              )}
            </div>

            <div className="watermark-controls">
              <div className="watermark-tabs">
                <button className={`watermark-tab${tab === 'text' ? ' watermark-tab--active' : ''}`} onClick={() => setTab('text')}>
                  <Stamp size={14} /> Text
                </button>
                <button className={`watermark-tab${tab === 'logo' ? ' watermark-tab--active' : ''}`} onClick={() => setTab('logo')}>
                  <ImageIcon size={14} /> Logo
                </button>
              </div>

              {tab === 'text' ? (
                <div className="tool-section">
                  <label className="tool-field">
                    <span>Text</span>
                    <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. your name or company" />
                  </label>
                  <label className="tool-field">
                    <span>Font size</span>
                    <input type="number" min={8} max={120} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
                  </label>
                  <label className="tool-field">
                    <span>Color</span>
                    <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} />
                  </label>
                  <label className="tool-field">
                    <span>Opacity ({Math.round(opacity * 100)}%)</span>
                    <input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
                  </label>
                  <label className="tool-field">
                    <span>Rotation (°)</span>
                    <input type="number" min={-180} max={180} value={rotationDeg} onChange={(e) => setRotationDeg(Number(e.target.value))} />
                  </label>
                  <label className="tool-field">
                    <span>Position</span>
                    <select value={position} onChange={(e) => setPosition(e.target.value as WatermarkPosition)}>
                      {POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="tool-field">
                    <span>Margin (pt)</span>
                    <input type="number" min={0} max={200} value={marginPt} onChange={(e) => setMarginPt(Number(e.target.value))} />
                  </label>
                </div>
              ) : (
                <div className="tool-section">
                  <FileDropZone accept="image/png,image/jpeg" label="Drop a logo (PNG/JPG), or click to select" onFiles={handleLogoFile} />
                  {logoFile && (
                    <label className="tool-field">
                      <span>Size ({Math.round(logoScale * 100)}% of page width)</span>
                      <input type="range" min={0.05} max={0.8} step={0.05} value={logoScale} onChange={(e) => setLogoScale(Number(e.target.value))} />
                    </label>
                  )}
                  <label className="tool-field">
                    <span>Opacity ({Math.round(logoOpacity * 100)}%)</span>
                    <input type="range" min={0.05} max={1} step={0.05} value={logoOpacity} onChange={(e) => setLogoOpacity(Number(e.target.value))} />
                  </label>
                  <label className="tool-field">
                    <span>Position</span>
                    <select value={logoPosition} onChange={(e) => setLogoPosition(e.target.value as WatermarkPosition)}>
                      {POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <label className="tool-field">
                <span>Apply to</span>
                <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'first')}>
                  <option value="all">All {pageCount} pages</option>
                  <option value="first">First page only</option>
                </select>
              </label>
            </div>
          </div>

          <div className="tool-actions">
            <button className="btn btn-primary" onClick={handleApply} disabled={isProcessing}>
              {isProcessing ? <span className="spinner" /> : <Download size={16} />}
              {isProcessing ? 'Applying…' : 'Apply & Download'}
            </button>
          </div>
        </>
      )}
    </ToolShell>
  )
}
