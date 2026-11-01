export interface Point {
  x: number
  y: number
}

/**
 * Solves the 8-DOF homography mapping `from` -> `to` for 4 point correspondences,
 * using direct linear transform + Gaussian elimination (no external math library).
 * Returns [h11..h33] as a 3x3 matrix flattened row-major, with h33 = 1.
 */
export function solveHomography(from: Point[], to: Point[]): number[] {
  if (from.length !== 4 || to.length !== 4) {
    throw new Error('Homography requires exactly 4 point correspondences.')
  }

  // Build the 8x9 augmented matrix [A | b] for unknowns h11..h32 (h33 fixed at 1).
  const A: number[][] = []
  const b: number[] = []

  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: X, y: Y } = to[i]
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X])
    b.push(X)
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    b.push(Y)
  }

  const h = gaussianSolve(A, b)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

/** Solves Ax = b for an 8x8 system via Gaussian elimination with partial pivoting. */
function gaussianSolve(A: number[][], b: number[]): number[] {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    let pivotRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivotRow][col])) pivotRow = row
    }
    ;[M[col], M[pivotRow]] = [M[pivotRow], M[col]]

    const pivot = M[col][col]
    if (Math.abs(pivot) < 1e-12) continue

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = M[row][col] / pivot
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k]
      }
    }
  }

  return M.map((row, i) => row[n] / (row[i] || 1))
}

/** Applies the homography to a point, returning the mapped (x, y) in the target space. */
export function applyHomography(h: number[], x: number, y: number): Point {
  const w = h[6] * x + h[7] * y + h[8]
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
  }
}
