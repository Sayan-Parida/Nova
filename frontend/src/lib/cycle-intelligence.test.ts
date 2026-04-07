import { describe, expect, it } from 'vitest'
import {
  addDays,
  calculateCycleDay,
  calculateFertileWindow,
  calculateLutealLength,
  calculateMoodPattern,
  calculatePhase,
  calculateSymptomPeakDay,
  calculateVariabilityScore,
  detectLogAnomaly,
  isLatePeriod,
} from './cycle-intelligence'

describe('cycle intelligence utilities', () => {
  it('calculates cycle day from last period start', () => {
    const lastStart = new Date()
    lastStart.setDate(lastStart.getDate() - 3)

    expect(calculateCycleDay(lastStart)).toBe(4)
  })

  it('calculates phase labels', () => {
    expect(calculatePhase(2, 28)).toBe('menstrual')
    expect(calculatePhase(7, 28)).toBe('follicular')
    expect(calculatePhase(14, 28)).toBe('ovulatory')
    expect(calculatePhase(22, 28)).toBe('luteal')
  })

  it('calculates luteal length from estimated ovulation', () => {
    const start = new Date('2026-01-01T00:00:00')
    const nextStart = new Date('2026-01-29T00:00:00')

    expect(calculateLutealLength(start, nextStart, 28)).toBe(14)
  })

  it('calculates variability score labels', () => {
    expect(calculateVariabilityScore([28, 28, 29]).label).toBe('Very regular')
    expect(calculateVariabilityScore([26, 30, 32]).label).toContain('Mostly regular')
    expect(calculateVariabilityScore([22, 35, 30, 38]).label).toContain('Variable cycles')
  })

  it('calculates fertile confidence bands', () => {
    const result = calculateFertileWindow(28, 14)
    expect(result.peak).toBe(14)
    expect(result.medium).toEqual([12, 16])
    expect(result.low).toEqual([10, 18])
  })

  it('finds symptom peak day', () => {
    const result = calculateSymptomPeakDay([
      { date: new Date('2026-01-01'), cycleDay: 1, discomfort: 2 },
      { date: new Date('2026-01-02'), cycleDay: 2, discomfort: 4 },
      { date: new Date('2026-02-02'), cycleDay: 2, discomfort: 5 },
    ])

    expect(result.peakDay).toBe(2)
    expect(result.avgScore).toBe(4.5)
  })

  it('finds mood pattern in luteal days', () => {
    const result = calculateMoodPattern([
      { date: new Date('2026-01-20'), cycleDay: 22, moods: ['Irritable'] },
      { date: new Date('2026-02-20'), cycleDay: 23, moods: ['sad'] },
      { date: new Date('2026-03-20'), cycleDay: 22, moods: ['anxious'] },
    ])

    expect(result).not.toBeNull()
    expect(result?.phase).toBe('luteal')
  })

  it('returns null mood pattern when data is missing', () => {
    const result = calculateMoodPattern([
      { date: new Date('2026-01-01'), cycleDay: 3, moods: ['happy'] },
    ])

    expect(result).toBeNull()
  })

  it('detects log anomaly for same cycle day history', () => {
    const message = detectLogAnomaly(
      { date: new Date(), cycleDay: 4, discomfort: 5 },
      [
        { date: new Date('2026-01-01'), cycleDay: 4, discomfort: 2 },
        { date: new Date('2026-02-01'), cycleDay: 4, discomfort: 2 },
      ],
      4,
    )

    expect(message).toContain('Higher discomfort than usual')
  })

  it('returns null anomaly for first cycle history', () => {
    const message = detectLogAnomaly(
      { date: new Date(), cycleDay: 4, discomfort: 3 },
      [{ date: new Date('2026-01-01'), cycleDay: 4, discomfort: 2 }],
      4,
    )

    expect(message).toBeNull()
  })

  it('computes late period status and unusual flag', () => {
    const predicted = new Date('2026-04-01T00:00:00')
    const today = new Date('2026-04-07T00:00:00')

    const status = isLatePeriod(predicted, today, [26, 28, 29])
    expect(status).not.toBeNull()
    expect(status?.daysLate).toBe(6)
    expect(status?.rangeMin).toBe(26)
    expect(status?.rangeMax).toBe(29)
  })

  it('returns null when period is not late', () => {
    const predicted = new Date('2026-04-10T00:00:00')
    const today = new Date('2026-04-07T00:00:00')

    expect(isLatePeriod(predicted, today, [26, 27, 28])).toBeNull()
  })

  it('handles irregular/empty history edge cases', () => {
    const predicted = addDays(new Date(), -2)
    const status = isLatePeriod(predicted, new Date(), [])

    expect(status?.rangeMin).toBe(0)
    expect(status?.rangeMax).toBe(0)
  })
})
