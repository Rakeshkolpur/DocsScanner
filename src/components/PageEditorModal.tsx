import { useState } from 'react'
import { X, RotateCcw, RotateCw, Trash2, Check } from 'lucide-react'
import { rotateBaseImage, renderEnhanced } from '../lib/pageTransform'
import { ENHANCE_MODE_OPTIONS, type EnhanceMode, type EnhanceOptions } from '../lib/imageEnhance'
import './PageEditorModal.css'

export interface EditablePage {
  id: number
  baseDataUrl: string
  enhance: EnhanceOptions
  dataUrl: string
}

interface PageEditorModalProps {
  page: EditablePage
  pageLabel: string
  onClose: () => void
  onSave: (next: { baseDataUrl: string; enhance: EnhanceOptions; dataUrl: string }) => void
  onDelete: () => void
}

export function PageEditorModal({ page, pageLabel, onClose, onSave, onDelete }: PageEditorModalProps) {
  const [workingBase, setWorkingBase] = useState(page.baseDataUrl)
  const [enhance, setEnhance] = useState<EnhanceOptions>(page.enhance)
  const [previewUrl, setPreviewUrl] = useState(page.dataUrl)
  const [isBusy, setIsBusy] = useState(false)

  async function handleRotate(degrees: 90 | 270) {
    setIsBusy(true)
    try {
      const nextBase = await rotateBaseImage(workingBase, degrees)
      const nextPreview = await renderEnhanced(nextBase, enhance)
      setWorkingBase(nextBase)
      setPreviewUrl(nextPreview)
    } finally {
      setIsBusy(false)
    }
  }

  async function handleEnhanceChange(mode: EnhanceMode) {
    const nextEnhance = { ...enhance, mode }
    setIsBusy(true)
    try {
      const nextPreview = await renderEnhanced(workingBase, nextEnhance)
      setEnhance(nextEnhance)
      setPreviewUrl(nextPreview)
    } finally {
      setIsBusy(false)
    }
  }

  function handleSave() {
    onSave({ baseDataUrl: workingBase, enhance, dataUrl: previewUrl })
    onClose()
  }

  function handleDelete() {
    onDelete()
    onClose()
  }

  return (
    <div className="page-editor__backdrop" onClick={onClose}>
      <div className="page-editor" onClick={(e) => e.stopPropagation()}>
        <div className="page-editor__header">
          <span>{pageLabel}</span>
          <button className="page-editor__icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="page-editor__preview">
          <img src={previewUrl} alt={pageLabel} />
        </div>

        <div className="page-editor__controls">
          <div className="page-editor__rotate">
            <button className="btn" onClick={() => handleRotate(270)} disabled={isBusy}>
              <RotateCcw size={14} /> Rotate left
            </button>
            <button className="btn" onClick={() => handleRotate(90)} disabled={isBusy}>
              <RotateCw size={14} /> Rotate right
            </button>
          </div>

          <div className="page-editor__filters">
            {ENHANCE_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`page-editor__filter${enhance.mode === opt.value ? ' page-editor__filter--active' : ''}`}
                onClick={() => handleEnhanceChange(opt.value)}
                disabled={isBusy}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="page-editor__actions">
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={14} /> Delete page
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isBusy}>
            <Check size={14} /> Done
          </button>
        </div>
      </div>
    </div>
  )
}
