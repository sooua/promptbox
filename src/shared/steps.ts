import type { Category, StageId } from './types'

/**
 * Where a dragged step lands: before another step, or at the end of a stage
 * (`target` is the stage id, null = 其他). Returns the new full id order and the
 * stage the step now belongs to; null when nothing should change.
 */
export function moveStep(
  categories: Category[],
  fromId: string,
  target: Category | StageId | null
): { ids: string[]; stage: StageId | null } | null {
  const from = categories.find((c) => c.id === fromId)
  if (!from) return null
  const ontoStep = typeof target === 'object' && target !== null
  if (ontoStep && target.id === from.id) return null
  const stage = ontoStep ? (target.stage ?? null) : target
  const ids = categories.map((c) => c.id).filter((id) => id !== from.id)
  if (ontoStep) {
    ids.splice(ids.indexOf(target.id), 0, from.id)
  } else {
    const last = categories.filter((c) => (c.stage ?? null) === stage && c.id !== from.id).at(-1)
    ids.splice(last ? ids.indexOf(last.id) + 1 : ids.length, 0, from.id)
  }
  return { ids, stage }
}
