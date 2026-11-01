/** Wraps generated PDF/image bytes in a Blob (TS's DOM lib is stricter than runtime reality about Uint8Array's backing buffer type). */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function withoutExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx > 0 ? filename.slice(0, idx) : filename
}
