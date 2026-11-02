import type { Point } from '../lib/homography'

interface LiveOutlineProps {
  corners: [Point, Point, Point, Point] | null
  frameSize: { width: number; height: number } | null
  locked: boolean
}

/** Read-only, live-updating quad outline drawn over the camera preview — no drag handles. */
export function LiveOutline({ corners, frameSize, locked }: LiveOutlineProps) {
  if (!corners || !frameSize || frameSize.width === 0 || frameSize.height === 0) return null

  const points = corners
    .map((p) => `${(p.x / frameSize.width) * 100},${(p.y / frameSize.height) * 100}`)
    .join(' ')

  return (
    <svg className="live-outline" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon
        points={points}
        fill={locked ? 'rgba(22,163,74,0.18)' : 'rgba(37,99,235,0.14)'}
        stroke={locked ? '#16a34a' : '#2563eb'}
        strokeWidth={0.8}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
