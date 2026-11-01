export type EnhanceMode = 'original' | 'grayscale' | 'blackwhite' | 'photo'

export interface EnhanceOptions {
  mode: EnhanceMode
  brightness: number // -100..100
  contrast: number // -100..100
  bwThreshold: number // 0..255, only used for 'blackwhite'
}

export const defaultEnhanceOptions: EnhanceOptions = {
  mode: 'photo',
  brightness: 0,
  contrast: 20,
  bwThreshold: 150,
}

/** Mutates pixel data in place: brightness/contrast, then grayscale/B&W/shadow-reduction as selected. */
export function applyEnhancements(data: Uint8ClampedArray, options: EnhanceOptions) {
  const contrastFactor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast))

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // Brightness
    r += options.brightness
    g += options.brightness
    b += options.brightness

    // Contrast
    r = contrastFactor * (r - 128) + 128
    g = contrastFactor * (g - 128) + 128
    b = contrastFactor * (b - 128) + 128

    if (options.mode === 'grayscale' || options.mode === 'blackwhite') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      if (options.mode === 'blackwhite') {
        const value = gray > options.bwThreshold ? 255 : 0
        r = g = b = value
      } else {
        r = g = b = gray
      }
    } else if (options.mode === 'photo') {
      // Mild shadow reduction: lift dark areas slightly without flattening midtones.
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      if (gray < 60) {
        const lift = (60 - gray) * 0.25
        r += lift
        g += lift
        b += lift
      }
    }

    data[i] = clamp(r)
    data[i + 1] = clamp(g)
    data[i + 2] = clamp(b)
  }
}

function clamp(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value
}
