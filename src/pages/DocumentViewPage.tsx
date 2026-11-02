import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Share2, MoreVertical, Download, Pen, Trash2, X } from 'lucide-react'
import { getDocument, saveDocument, deleteDocument, renameDocument, type StoredDocument } from '../lib/docStore'
import { PageEditorModal } from '../components/PageEditorModal'
import { dataUrlToBytes } from '../lib/imageDataUtils'
import { imagesToPdf } from '../lib/pdfEngine'
import { downloadBlob, bytesToBlob, withoutExtension } from '../lib/download'
import './DocumentViewPage.css'

export default function DocumentViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<StoredDocument | null | undefined>(undefined)
  const [index, setIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    if (!id) return
    getDocument(id).then(setDoc)
  }, [id])

  if (doc === undefined) {
    return <div className="container doc-view"><p className="tool-hint">Loading…</p></div>
  }
  if (doc === null) {
    return (
      <div className="container doc-view">
        <p className="tool-hint">This document could not be found.</p>
      </div>
    )
  }

  const page = doc.pages[index]

  async function handleShare() {
    if (!doc) return
    setIsSharing(true)
    try {
      const bytes = await imagesToPdf(doc.pages.map((p) => ({ bytes: dataUrlToBytes(p.dataUrl), type: 'jpg' as const })))
      const blob = bytesToBlob(bytes, 'application/pdf')
      const filename = `${withoutExtension(doc.name)}.pdf`

      const file = new File([blob], filename, { type: 'application/pdf' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: doc.name })
          return
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return // user cancelled the share sheet
          // Fall through to a direct download if the share sheet itself failed.
        }
      }
      downloadBlob(blob, filename)
    } catch (err) {
      console.error('Could not build the PDF to share:', err)
    } finally {
      setIsSharing(false)
    }
  }

  function handleSaveToGallery() {
    if (!page) return
    downloadBlob(bytesToBlob(dataUrlToBytes(page.dataUrl), 'image/jpeg'), `${withoutExtension(doc!.name)}_page_${index + 1}.jpg`)
    setIsMoreOpen(false)
  }

  async function handleRename() {
    if (!doc) return
    const name = prompt('Document name', doc.name)
    if (!name || !name.trim()) return
    await renameDocument(doc.id, name.trim())
    setDoc({ ...doc, name: name.trim() })
    setIsMoreOpen(false)
  }

  async function handleDeleteDoc() {
    if (!doc) return
    if (!confirm('Delete this document? This cannot be undone.')) return
    await deleteDocument(doc.id)
    navigate('/')
  }

  async function handlePageSaved(next: { baseDataUrl: string; enhance: typeof page.enhance; dataUrl: string }) {
    if (!doc) return
    const nextPages = doc.pages.map((p, i) => (i === index ? { ...p, ...next } : p))
    const nextDoc = { ...doc, pages: nextPages }
    setDoc(nextDoc)
    await saveDocument(nextDoc)
  }

  async function handlePageDeleted() {
    if (!doc) return
    const nextPages = doc.pages.filter((_, i) => i !== index)
    if (nextPages.length === 0) {
      await deleteDocument(doc.id)
      navigate('/')
      return
    }
    const nextDoc = { ...doc, pages: nextPages }
    setDoc(nextDoc)
    await saveDocument(nextDoc)
    setIndex((i) => Math.min(i, nextPages.length - 1))
  }

  return (
    <div className="doc-view">
      <div className="doc-view__topbar">
        <button className="doc-view__icon-btn" onClick={() => navigate('/')} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="doc-view__title">
          <span>{doc.name}</span>
          <span className="doc-view__page-indicator">{index + 1} / {doc.pages.length}</span>
        </div>
        <button className="doc-view__icon-btn" onClick={() => setIsMoreOpen(true)} aria-label="More">
          <MoreVertical size={18} />
        </button>
      </div>

      <div className="doc-view__stage">
        {index > 0 && (
          <button className="doc-view__nav doc-view__nav--left" onClick={() => setIndex((i) => i - 1)} aria-label="Previous page">
            <ChevronLeft size={20} />
          </button>
        )}
        {page && <img src={page.dataUrl} alt={`Page ${index + 1}`} className="doc-view__image" />}
        {index < doc.pages.length - 1 && (
          <button className="doc-view__nav doc-view__nav--right" onClick={() => setIndex((i) => i + 1)} aria-label="Next page">
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      <div className="doc-view__toolbar">
        <button onClick={() => setIsEditing(true)}>
          <Pencil size={18} />
          <span>Edit</span>
        </button>
        <button onClick={handleShare} disabled={isSharing}>
          <Share2 size={18} />
          <span>Share</span>
        </button>
        <button onClick={handleSaveToGallery}>
          <Download size={18} />
          <span>Save</span>
        </button>
      </div>

      {isEditing && page && (
        <PageEditorModal
          page={{ id: index, baseDataUrl: page.baseDataUrl, enhance: page.enhance, dataUrl: page.dataUrl }}
          pageLabel={`Page ${index + 1}`}
          onClose={() => setIsEditing(false)}
          onSave={handlePageSaved}
          onDelete={handlePageDeleted}
        />
      )}

      {isMoreOpen && (
        <div className="doc-view__sheet-backdrop" onClick={() => setIsMoreOpen(false)}>
          <div className="doc-view__sheet" onClick={(e) => e.stopPropagation()}>
            <div className="doc-view__sheet-header">
              <span>More</span>
              <button onClick={() => setIsMoreOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <button className="doc-view__sheet-item" onClick={handleRename}>
              <Pen size={16} /> Rename
            </button>
            <button className="doc-view__sheet-item doc-view__sheet-item--danger" onClick={handleDeleteDoc}>
              <Trash2 size={16} /> Delete document
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
