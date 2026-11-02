import type { Point } from './homography'

/** Standard ID/credit-card aspect ratio (ISO/IEC 7810 ID-1), width:height. */
export const ID_CARD_ASPECT = 1.586
export const ID_CARD_GUIDE_WIDTH_PCT = 80 // the CSS guide box (width%, centered) uses `aspect-ratio` for height

/** Axis-aligned guide corners in image pixel space, matching the centered CSS guide box exactly. */
export function idCardGuideCorners(imageWidth: number, imageHeight: number): [Point, Point, Point, Point] {
  const boxWidth = imageWidth * (ID_CARD_GUIDE_WIDTH_PCT / 100)
  const boxHeight = boxWidth / ID_CARD_ASPECT
  const left = (imageWidth - boxWidth) / 2
  const top = (imageHeight - boxHeight) / 2
  return [
    { x: left, y: top },
    { x: left + boxWidth, y: top },
    { x: left + boxWidth, y: top + boxHeight },
    { x: left, y: top + boxHeight },
  ]
}
