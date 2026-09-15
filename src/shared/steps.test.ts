import { describe, it, expect } from 'vitest'
import { moveStep } from './steps'
import type { Category } from './types'

const cat = (id: string, stage: Category['stage'], order: number): Category => ({
  id,
  name: id,
  stage,
  order,
  createdAt: 0,
  updatedAt: 0
})

// a legacy (stage-less) category first, then two stages with two steps each
const cats = [cat('old', null, 0), cat('t1', 'think', 1), cat('t2', 'think', 2), cat('p1', 'plan', 3), cat('p2', 'plan', 4)]

describe('moveStep', () => {
  it('drops onto a step in another stage: adopts that stage, lands before it', () => {
    expect(moveStep(cats, 'old', cats[3])).toEqual({ ids: ['t1', 't2', 'old', 'p1', 'p2'], stage: 'plan' })
  })
  it('drops onto a stage header: appended after its last step', () => {
    expect(moveStep(cats, 'old', 'think')).toEqual({ ids: ['t1', 't2', 'old', 'p1', 'p2'], stage: 'think' })
  })
  it('drops onto 其他: leaves the route', () => {
    expect(moveStep(cats, 'p2', null)).toEqual({ ids: ['old', 'p2', 't1', 't2', 'p1'], stage: null })
  })
  it('reorders inside a stage', () => {
    expect(moveStep(cats, 't2', cats[1])).toEqual({ ids: ['old', 't2', 't1', 'p1', 'p2'], stage: 'think' })
  })
  it('ignores self drops and unknown ids', () => {
    expect(moveStep(cats, 't1', cats[1])).toBeNull()
    expect(moveStep(cats, 'nope', 'think')).toBeNull()
  })
})
