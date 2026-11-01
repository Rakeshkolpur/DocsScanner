import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import './FileDropZone.css'

interface FileDropZoneProps {
  accept: string
  multiple?: boolean
  label: string
  hint?: string
  onFiles: (files: File[]) => void
}

export function FileDropZone({ accept, multiple = false, label, hint, onFiles }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) onFiles(multiple ? files : [files[0]])
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFiles(files)
    e.target.value = ''
  }

  return (
    <div
      className={`drop-zone${isDragging ? ' drop-zone--active' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
    >
      <UploadCloud size={28} strokeWidth={1.5} />
      <p className="drop-zone__label">{label}</p>
      {hint && <p className="drop-zone__hint">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="visually-hidden"
      />
    </div>
  )
}
