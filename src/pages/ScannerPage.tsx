import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  Check,
  SwitchCamera,
  Trash2,
  Download,
  Plus,
  ChevronUp,
  ChevronDown,
  Scan,
  Video,
  Square,
  Image as ImageIcon,
  IdCard,
  FileText,
  Save,
} from 'lucide-react'
import { ToolShell, ErrorBanner } from '../components/ToolShell'
import { CornerEditor, defaultCorners } from '../components/CornerEditor'
import { LiveOutline } from '../components/LiveOutline'
import { PageEditorModal } from '../components/PageEditorModal'
import { useCamera } from '../lib/useCamera'
import { useAutoScanSession, type AutoScanStatus } from '../lib/useAutoScanSession'
import { processScan, detectCorners } from '../lib/scanProcessorClient'
import { imageDataToDataUrl, dataUrlToBytes } from '../lib/imageDataUtils'
import { imagesToPdf } from '../lib/pdfEngine'
import { downloadBlob, bytesToBlob } from '../lib/download'
import { stitchLongImage } from '../lib/longImage'
import { addDocument } from '../lib/docStore'
import { idCardGuideCorners, ID_CARD_ASPECT, ID_CARD_GUIDE_WIDTH_PCT } from '../lib/idCardGuide'
import { composeIdCardPage } from '../lib/composeIdCard'
import { defaultEnhanceOptions, ENHANCE_MODE_OPTIONS, type EnhanceMode, type EnhanceOptions } from '../lib/imageEnhance'
import type { Point } from '../lib/homography'
import '../components/ToolShell.css'
import './ScannerPage.css'

const AUTO_SCAN_STATUS_LABEL: Record<AutoScanStatus, string> = {
  looking: 'Show a page to the camera…',
  blurry: 'Hold the page steady…',
  stabilizing: 'Hold still…',
  capturing: 'Capturing page…',
  captured: 'Page captured! Turn to the next page.',
}

interface Capture {
  imageData: ImageData
  dataUrl: string
}

interface ScanPage {
  id: number
  baseDataUrl: string
  enhance: EnhanceOptions
  dataUrl: string
}

function quadSize(corners: [Point, Point, Point, Point]) {
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  const width = Math.round((dist(corners[0], corners[1]) + dist(corners[3], corners[2])) / 2)
  const height = Math.round((dist(corners[0], corners[3]) + dist(corners[1], corners[2])) / 2)
  return { width: Math.max(width, 50), height: Math.max(height, 50) }
}

const ENHANCE_MODES = ENHANCE_MODE_OPTIONS

export default function ScannerPage() {
  const navigate = useNavigate()
  const camera = useCamera()
  const [step, setStep] = useState<'camera' | 'crop' | 'recording'>('camera')
  const [capture, setCapture] = useState<Capture | null>(null)
  const [corners, setCorners] = useState<[Point, Point, Point, Point] | null>(null)
  const [enhance, setEnhance] = useState<EnhanceOptions>(defaultEnhanceOptions)
  const [recordEnhance, setRecordEnhance] = useState<EnhanceOptions>(defaultEnhanceOptions)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBaseUrl, setPreviewBaseUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pages, setPages] = useState<ScanPage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isStitching, setIsStitching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [autoDetected, setAutoDetected] = useState<boolean | null>(null)
  const [editingPageId, setEditingPageId] = useState<number | null>(null)
  const [scanMode, setScanMode] = useState<'document' | 'id-card'>('document')
  const [idCardStage, setIdCardStage] = useState<'front' | 'back'>('front')
  const [idFrontDataUrl, setIdFrontDataUrl] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const captureTokenRef = useRef(0)

  const handleAutoCapture = useCallback((capture: { baseDataUrl: string; enhance: EnhanceOptions; dataUrl: string }) => {
    setPages((prev) => [...prev, { id: Date.now() + Math.random(), ...capture }])
  }, [])

  const autoScan = useAutoScanSession({ camera, enhance: recordEnhance, onCapture: handleAutoCapture })

  useEffect(() => {
    if (step === 'camera' || step === 'recording') camera.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function handleStartRecording() {
    setError(null)
    setStep('recording')
    autoScan.start()
  }

  function handleStopRecording() {
    autoScan.stop()
    setStep('camera')
  }

  useEffect(() => {
    if (step !== 'crop' || !capture || !corners) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setIsProcessing(true)
      try {
        const { width, height } = quadSize(corners)
        const { base, enhanced } = await processScan(capture.imageData, corners, width, height, 0, enhance)
        setPreviewBaseUrl(imageDataToDataUrl(base))
        setPreviewUrl(imageDataToDataUrl(enhanced))
      } finally {
        setIsProcessing(false)
      }
    }, 180)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [step, capture, corners, enhance])

  function handleCapture() {
    const result = camera.capture()
    if (!result) {
      setError('Could not capture from the camera. Try again.')
      return
    }
    setError(null)
    setCapture(result)
    setCorners(defaultCorners(result.imageData.width, result.imageData.height))
    setEnhance(defaultEnhanceOptions)
    setPreviewUrl(null)
    setAutoDetected(null)
    camera.stop()
    setStep('crop')
    runDetection(result.imageData)
  }

  const ID_CARD_ENHANCE: EnhanceOptions = { mode: 'original', brightness: 0, contrast: 0, bwThreshold: 150 }

  async function handleIdCardCapture() {
    const result = camera.capture()
    if (!result) {
      setError('Could not capture from the camera. Try again.')
      return
    }
    setError(null)
    setIsProcessing(true)
    try {
      const guideCorners = idCardGuideCorners(result.imageData.width, result.imageData.height)
      const { width, height } = quadSize(guideCorners)
      const { enhanced } = await processScan(result.imageData, guideCorners, width, height, 0, ID_CARD_ENHANCE)
      const dataUrl = imageDataToDataUrl(enhanced)

      if (idCardStage === 'front') {
        setIdFrontDataUrl(dataUrl)
        setIdCardStage('back')
        return
      }

      if (idFrontDataUrl) {
        const composed = await composeIdCardPage(idFrontDataUrl, dataUrl)
        setPages((prev) => [...prev, { id: Date.now(), baseDataUrl: composed, enhance: ID_CARD_ENHANCE, dataUrl: composed }])
      }
      setIdCardStage('front')
      setIdFrontDataUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process the ID card.')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleRetakeIdFront() {
    setIdCardStage('front')
    setIdFrontDataUrl(null)
  }

  function runDetection(imageData: ImageData) {
    const token = ++captureTokenRef.current
    setIsDetecting(true)
    detectCorners(imageData)
      .then((detected) => {
        if (captureTokenRef.current !== token) return // a retake happened while this was running
        if (detected) {
          setCorners(detected)
          setAutoDetected(true)
        } else {
          setAutoDetected(false)
        }
      })
      .finally(() => {
        if (captureTokenRef.current === token) setIsDetecting(false)
      })
  }

  function handleRetake() {
    captureTokenRef.current++ // invalidate any in-flight detection for the discarded capture
    setCapture(null)
    setCorners(null)
    setPreviewUrl(null)
    setPreviewBaseUrl(null)
    setAutoDetected(null)
    setStep('camera')
  }

  function handleAddPage() {
    if (!previewUrl || !previewBaseUrl) return
    setPages((prev) => [...prev, { id: Date.now(), baseDataUrl: previewBaseUrl, enhance, dataUrl: previewUrl }])
    handleRetake()
  }

  function deletePage(id: number) {
    setPages((prev) => prev.filter((p) => p.id !== id))
  }

  function updatePage(id: number, next: { baseDataUrl: string; enhance: EnhanceOptions; dataUrl: string }) {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...next } : p)))
  }

  function movePage(index: number, dir: -1 | 1) {
    setPages((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleExport() {
    if (pages.length === 0) return
    setIsExporting(true)
    setError(null)
    try {
      const images = pages.map((p) => ({ bytes: dataUrlToBytes(p.dataUrl), type: 'jpg' as const }))
      const bytes = await imagesToPdf(images)
      downloadBlob(bytesToBlob(bytes, 'application/pdf'), 'scanned.pdf')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportLongImage() {
    if (pages.length === 0) return
    setIsStitching(true)
    setError(null)
    try {
      const blob = await stitchLongImage(pages.map((p) => p.dataUrl))
      downloadBlob(blob, 'scanned-long-image.jpg')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the long image.')
    } finally {
      setIsStitching(false)
    }
  }

  async function handleSaveDocument() {
    if (pages.length === 0) return
    const defaultName = `Scan ${new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`
    const name = prompt('Name this document', defaultName)
    if (name === null) return // cancelled
    setIsSaving(true)
    setError(null)
    try {
      const doc = await addDocument(name.trim() || defaultName, pages.map(({ baseDataUrl, enhance, dataUrl }) => ({ baseDataUrl, enhance, dataUrl })))
      navigate(`/doc/${doc.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the document.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ToolShell title="Scan Document" description="Capture pages with your camera, straighten and clean them up, then export a PDF — all on this device.">
      {error && <ErrorBanner message={error} />}

      {step === 'camera' && (
        <div className="scanner-camera">
          {camera.status === 'requesting' && <p className="tool-hint">Requesting camera access…</p>}
          {camera.status === 'denied' && (
            <div className="tool-section">
              <p className="tool-hint">Camera access was denied. Allow camera access in your browser settings, then try again.</p>
              <button className="btn" onClick={() => camera.start()}>
                <RefreshCw size={14} /> Try again
              </button>
            </div>
          )}
          {camera.status === 'unavailable' && (
            <p className="tool-hint">No camera is available on this device or browser. You can still use Images to PDF instead.</p>
          )}

          <div className="scanner-camera__viewport" style={{ display: camera.status === 'ready' ? 'block' : 'none' }}>
            <video ref={camera.videoRef} muted playsInline className="scanner-camera__video" />
            {camera.canSwitchCamera && (
              <button className="scanner-viewport-icon-btn scanner-viewport-icon-btn--top-right" onClick={camera.switchCamera} aria-label="Switch camera">
                <SwitchCamera size={16} />
              </button>
            )}
            {scanMode === 'id-card' && (
              <>
                <div
                  className="id-card-guide"
                  style={{ width: `${ID_CARD_GUIDE_WIDTH_PCT}%`, aspectRatio: ID_CARD_ASPECT }}
                />
                <div className="scanner-record-status">
                  {idCardStage === 'front' ? 'Align the FRONT of your ID in the box' : 'Flip the card — align the BACK in the box'}
                </div>
              </>
            )}
          </div>

          {camera.status === 'ready' && (
            <div className="scanner-mode-tabs">
              <button
                className={`scanner-mode-tab${scanMode === 'document' ? ' scanner-mode-tab--active' : ''}`}
                onClick={() => setScanMode('document')}
              >
                <FileText size={14} /> Document
              </button>
              <button
                className={`scanner-mode-tab${scanMode === 'id-card' ? ' scanner-mode-tab--active' : ''}`}
                onClick={() => {
                  setScanMode('id-card')
                  setIdCardStage('front')
                  setIdFrontDataUrl(null)
                }}
              >
                <IdCard size={14} /> ID Card
              </button>
            </div>
          )}

          {camera.status === 'ready' && scanMode === 'document' && (
            <div className="scanner-capture-bar">
              <button className="scanner-capture-bar__side" onClick={handleStartRecording} aria-label="Record and auto-scan">
                <Video size={18} />
                <span>Auto</span>
              </button>
              <button className="scanner-capture-bar__shutter" onClick={handleCapture} aria-label="Capture page">
                <span className="scanner-capture-bar__shutter-inner" />
              </button>
              <div className="scanner-capture-bar__side scanner-capture-bar__side--badge">
                <span className="scanner-pages-badge">{pages.length}</span>
                <span>Pages</span>
              </div>
            </div>
          )}

          {camera.status === 'ready' && scanMode === 'id-card' && (
            <div className="scanner-capture-bar">
              <button
                className="scanner-capture-bar__side"
                onClick={handleRetakeIdFront}
                disabled={idCardStage === 'front'}
                aria-label="Retake front"
              >
                <RefreshCw size={18} />
                <span>Retake</span>
              </button>
              <button className="scanner-capture-bar__shutter" onClick={handleIdCardCapture} disabled={isProcessing} aria-label="Capture">
                {isProcessing ? <span className="spinner" /> : <span className="scanner-capture-bar__shutter-inner" />}
              </button>
              <div className="scanner-capture-bar__side scanner-capture-bar__side--badge">
                <span className="scanner-pages-badge">{pages.length}</span>
                <span>Pages</span>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'recording' && (
        <div className="scanner-camera">
          <div className="scanner-camera__viewport scanner-camera__viewport--recording">
            <video ref={camera.videoRef} muted playsInline className="scanner-camera__video" />
            <LiveOutline
              corners={autoScan.liveCorners}
              frameSize={autoScan.liveFrameSize}
              locked={autoScan.status === 'stabilizing' || autoScan.status === 'capturing'}
            />
            <div className="scanner-record-badge">
              <span className="scanner-record-dot" /> REC
            </div>
            <div className={`scanner-record-status scanner-record-status--${autoScan.status}`}>
              {AUTO_SCAN_STATUS_LABEL[autoScan.status]}
            </div>
          </div>

          <div className="tool-actions">
            <span className="tool-hint">{autoScan.capturedCount} page{autoScan.capturedCount === 1 ? '' : 's'} captured this session</span>
          </div>

          <div className="tool-section">
            <label className="tool-field">
              <span>Enhancement</span>
              <select
                value={recordEnhance.mode}
                onChange={(e) => setRecordEnhance((prev) => ({ ...prev, mode: e.target.value as EnhanceMode }))}
              >
                {ENHANCE_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="tool-actions">
            <button className="btn btn-primary" onClick={handleStopRecording}>
              <Square size={14} /> Stop recording
            </button>
          </div>
        </div>
      )}

      {step === 'crop' && capture && corners && (
        <div className="scanner-crop">
          <div className="scanner-crop__grid">
            <div>
              <p className="tool-hint">
                {isDetecting
                  ? 'Detecting document edges…'
                  : autoDetected === true
                    ? 'Edges detected automatically — drag any corner to fine-tune.'
                    : autoDetected === false
                      ? "Couldn't detect the edges automatically — drag the corners to match the document."
                      : 'Drag the corners to match the document edges.'}
              </p>
              <CornerEditor
                imageUrl={capture.dataUrl}
                imageWidth={capture.imageData.width}
                imageHeight={capture.imageData.height}
                corners={corners}
                onChange={(next) => {
                  setCorners(next)
                  setAutoDetected(null) // user is now adjusting manually; drop the auto-detected badge
                }}
              />
              <button
                className="btn"
                style={{ marginTop: 8 }}
                onClick={() => runDetection(capture.imageData)}
                disabled={isDetecting}
              >
                <Scan size={14} /> {isDetecting ? 'Detecting…' : 'Re-detect edges'}
              </button>
            </div>
            <div>
              <p className="tool-hint">Preview</p>
              <div className="scanner-crop__preview">
                {previewUrl ? <img src={previewUrl} alt="Processed preview" /> : <span className="tool-hint">Processing…</span>}
              </div>
            </div>
          </div>

          <div className="tool-section">
            <label className="tool-field">
              <span>Enhancement</span>
              <select value={enhance.mode} onChange={(e) => setEnhance((prev) => ({ ...prev, mode: e.target.value as EnhanceMode }))}>
                {ENHANCE_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="tool-field">
              <span>Brightness</span>
              <input type="range" min={-100} max={100} value={enhance.brightness} onChange={(e) => setEnhance((prev) => ({ ...prev, brightness: Number(e.target.value) }))} />
            </label>
            <label className="tool-field">
              <span>Contrast</span>
              <input type="range" min={-100} max={100} value={enhance.contrast} onChange={(e) => setEnhance((prev) => ({ ...prev, contrast: Number(e.target.value) }))} />
            </label>
            {enhance.mode === 'blackwhite' && (
              <label className="tool-field">
                <span>Threshold</span>
                <input type="range" min={0} max={255} value={enhance.bwThreshold} onChange={(e) => setEnhance((prev) => ({ ...prev, bwThreshold: Number(e.target.value) }))} />
              </label>
            )}
          </div>

          <div className="tool-actions">
            <button className="btn" onClick={handleRetake}>
              <RefreshCw size={14} /> Retake
            </button>
            <button className="btn btn-primary" onClick={handleAddPage} disabled={isProcessing || !previewUrl}>
              <Check size={16} /> Add page
            </button>
          </div>
        </div>
      )}

      {pages.length > 0 && (
        <div className="scanner-pages">
          <p className="tool-hint">{pages.length} page{pages.length === 1 ? '' : 's'} captured — tap a page to edit it</p>
          <div className="scanner-pages__strip">
            {pages.map((page, index) => (
              <div className="scanner-pages__item" key={page.id}>
                <button className="scanner-pages__thumb-btn" onClick={() => setEditingPageId(page.id)} aria-label={`Edit page ${index + 1}`}>
                  <img src={page.dataUrl} alt={`Scanned page ${index + 1}`} />
                </button>
                <div className="scanner-pages__item-actions">
                  <button onClick={() => movePage(index, -1)} disabled={index === 0} aria-label="Move earlier">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => movePage(index, 1)} disabled={index === pages.length - 1} aria-label="Move later">
                    <ChevronDown size={12} />
                  </button>
                  <button onClick={() => deletePage(page.id)} aria-label="Delete page">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="tool-actions">
            {step !== 'camera' ? null : (
              <button className="btn" onClick={() => setStep('camera')}>
                <Plus size={14} /> Add another page
              </button>
            )}
            <button className="btn" onClick={handleExportLongImage} disabled={isStitching}>
              {isStitching ? <span className="spinner" /> : <ImageIcon size={14} />}
              {isStitching ? 'Stitching…' : 'Long image'}
            </button>
            <button className="btn" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <span className="spinner" /> : <Download size={16} />}
              {isExporting ? 'Building PDF…' : 'Export PDF'}
            </button>
            <button className="btn btn-primary" onClick={handleSaveDocument} disabled={isSaving}>
              {isSaving ? <span className="spinner" /> : <Save size={16} />}
              {isSaving ? 'Saving…' : 'Save to My Documents'}
            </button>
          </div>
        </div>
      )}

      {editingPageId !== null && (() => {
        const index = pages.findIndex((p) => p.id === editingPageId)
        const page = pages[index]
        if (!page) return null
        return (
          <PageEditorModal
            page={page}
            pageLabel={`Page ${index + 1}`}
            onClose={() => setEditingPageId(null)}
            onSave={(next) => updatePage(page.id, next)}
            onDelete={() => deletePage(page.id)}
          />
        )
      })()}
    </ToolShell>
  )
}
