import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '../lib/homography'
import './CornerEditor.css'

interface CornerEditorProps {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  corners: [Point, Point, Point, Point]
  onChange: (corners: [Point, Point, Point, Point]) => void
}

const HANDLE_LABELS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left']

export function CornerEditor({ imageUrl, imageWidth, imageHeight, corners, onChange }: CornerEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function toPercent(point: Point) {
    return { x: (point.x / imageWidth) * 100, y: (point.y / imageHeight) * 100 }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragIndex === null || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const xPct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const yPct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    const next = [...corners] as [Point, Point, Point, Point]
    next[dragIndex] = { x: xPct * imageWidth, y: yPct * imageHeight }
    onChange(next)
  }

  const pathPoints = corners.map(toPercent)
  const polygon = pathPoints.map((p) => `${p.x}% ${p.y}%`).join(', ')

  return (
    <div
      className="corner-editor"
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDragIndex(null)}
      onPointerLeave={() => setDragIndex(null)}
    >
      <img src={imageUrl} alt="Captured document" className="corner-editor__image" />
      <svg className="corner-editor__overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points={pathPoints.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="rgba(37,99,235,0.18)"
          stroke="rgb(37,99,235)"
          strokeWidth={0.4}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {pathPoints.map((p, i) => (
        <button
          key={i}
          className="corner-editor__handle"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          onPointerDown={(e) => {
            e.preventDefault()
            setDragIndex(i)
          }}
          aria-label={`Drag ${HANDLE_LABELS[i]} corner`}
        />
      ))}
      <div className="visually-hidden">{polygon}</div>
    </div>
  )
}

/** Default corners inset 6% from each edge, matching typical document-boundary guesses. */
export function defaultCorners(width: number, height: number): [Point, Point, Point, Point] {
  const insetX = width * 0.06
  const insetY = height * 0.06
  return [
    { x: insetX, y: insetY },
    { x: width - insetX, y: insetY },
    { x: width - insetX, y: height - insetY },
    { x: insetX, y: height - insetY },
  ]
}
