/** Minimal line-level diff (LCS-based) for the version-history compare view. */

export type DiffOp = { type: 'same' | 'add' | 'del'; text: string }

/**
 * Diff two texts by line. Returns a flat op list: unchanged lines, additions
 * (present in `b` only) and deletions (present in `a` only), in reading order.
 */
export function diffLines(a: string, b: string): DiffOp[] {
  const aL = a.split('\n')
  const bL = b.split('\n')
  const n = aL.length
  const m = bL.length

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = aL[i] === bL[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (aL[i] === bL[j]) {
      ops.push({ type: 'same', text: aL[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: 'del', text: aL[i] })
      i++
    } else {
      ops.push({ type: 'add', text: bL[j] })
      j++
    }
  }
  while (i < n) ops.push({ type: 'del', text: aL[i++] })
  while (j < m) ops.push({ type: 'add', text: bL[j++] })
  return ops
}

/** Count added / removed lines for a compact summary. */
export function diffStat(ops: DiffOp[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const op of ops) {
    if (op.type === 'add') added++
    else if (op.type === 'del') removed++
  }
  return { added, removed }
}
