import type { SplitOutput } from './pdfEngine'

export async function zipOutputs(outputs: SplitOutput[], zipName: string): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const output of outputs) {
    zip.file(output.name, output.bytes)
  }
  return zip.generateAsync({ type: 'blob', comment: zipName })
}
