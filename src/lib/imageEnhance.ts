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

export const ENHANCE_MODE_OPTIONS: { value: EnhanceMode; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'photo', label: 'Enhanced' },
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'blackwhite', label: 'Black & white' },
]

/**
 * Mutates pixel data in place: brightness/contrast, then grayscale/B&W/shadow-reduction
 * as selected, then a light unsharp-mask sharpen for 'photo'/'grayscale' (text reads much
 * crisper after a camera capture, which is always slightly soft compared to a flatbed scan).
 */
export function applyEnhancements(data: Uint8ClampedArray, width: number, height: number, options: EnhanceOptions) {
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

  if (options.mode === 'photo' || options.mode === 'grayscale') {
    sharpen(data, width, height, 0.6)
  }
}

/** Unsharp mask: out = original + amount * (original - 3x3 blur of original). */
function sharpen(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  const src = Uint8ClampedArray.from(data)

  for (let y = 0; y < height; y++) {
    const y0 = y > 0 ? y - 1 : 0
    const y1 = y < height - 1 ? y + 1 : height - 1
    for (let x = 0; x < width; x++) {
      const x0 = x > 0 ? x - 1 : 0
      const x1 = x < width - 1 ? x + 1 : width - 1
      const idx = (y * width + x) * 4

      for (let c = 0; c < 3; c++) {
        const sum =
          src[(y0 * width + x0) * 4 + c] + src[(y0 * width + x) * 4 + c] + src[(y0 * width + x1) * 4 + c] +
          src[(y * width + x0) * 4 + c] + src[(y * width + x) * 4 + c] + src[(y * width + x1) * 4 + c] +
          src[(y1 * width + x0) * 4 + c] + src[(y1 * width + x) * 4 + c] + src[(y1 * width + x1) * 4 + c]
        const blurred = sum / 9
        const original = src[idx + c]
        data[idx + c] = clamp(original + amount * (original - blurred))
      }
    }
  }
}

function clamp(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value
}
