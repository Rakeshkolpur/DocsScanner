export interface PageRangeResult {
  pages: number[]
  error: string | null
}

/**
 * Parses strings like "1-5", "1,3,5", "2-4,7-9" into a deduplicated,
 * ascending-by-appearance list of 1-based page numbers, bounded by pageCount.
 */
export function parsePageRanges(input: string, pageCount: number): PageRangeResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { pages: [], error: 'Enter at least one page or range.' }
  }

  const seen = new Set<number>()
  const pages: number[] = []
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean)

  if (parts.length === 0) {
    return { pages: [], error: 'Enter at least one page or range.' }
  }

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/)
    const singleMatch = part.match(/^(\d+)$/)

    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      if (start < 1 || end < 1) {
        return { pages: [], error: `Page numbers must be at least 1 (got "${part}").` }
      }
      if (start > end) {
        return { pages: [], error: `Range "${part}" is invalid — start must not exceed end.` }
      }
      if (end > pageCount) {
        return { pages: [], error: `Range "${part}" exceeds the document's ${pageCount} pages.` }
      }
      for (let i = start; i <= end; i++) {
        if (!seen.has(i)) {
          seen.add(i)
          pages.push(i)
        }
      }
    } else if (singleMatch) {
      const n = Number(singleMatch[1])
      if (n < 1) {
        return { pages: [], error: `Page numbers must be at least 1 (got "${part}").` }
      }
      if (n > pageCount) {
        return { pages: [], error: `Page ${n} exceeds the document's ${pageCount} pages.` }
      }
      if (!seen.has(n)) {
        seen.add(n)
        pages.push(n)
      }
    } else {
      return { pages: [], error: `"${part}" is not a valid page or range (e.g. 1-5, 3, 7-9).` }
    }
  }

  return { pages, error: null }
}
