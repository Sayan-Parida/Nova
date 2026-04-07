export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'

export type FlowIntensity = 'None' | 'Spotting' | 'Light' | 'Medium' | 'Heavy'

export type Log = {
  date: Date
  cycleDay?: number
  flowIntensity?: FlowIntensity | string
  discomfort?: number
  energyLevel?: number
  moods?: string[]
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function dayDiff(from: Date, to: Date): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / millisecondsPerDay)
}

export function dateKey(date: Date): string {
  const local = startOfDay(date)
  const year = local.getFullYear()
  const month = String(local.getMonth() + 1).padStart(2, '0')
  const day = String(local.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateInput(value: string | undefined | null): Date | null {
  if (!value) {
    return null
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value
  const parsed = new Date(normalized)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return startOfDay(parsed)
}

export function uniqueSortedDates(dates: Date[]): Date[] {
  const deduped = new Map<string, Date>()
  for (const date of dates) {
    deduped.set(dateKey(date), startOfDay(date))
  }

  return [...deduped.values()].sort((a, b) => a.getTime() - b.getTime())
}

export function derivePeriodStarts(dates: Date[]): Date[] {
  if (dates.length === 0) {
    return []
  }

  const starts = [dates[0]]
  for (let i = 1; i < dates.length; i += 1) {
    if (dayDiff(dates[i - 1], dates[i]) >= 10) {
      starts.push(dates[i])
    }
  }

  return starts
}

export function getCycleLengths(periodStarts: Date[]): number[] {
  const lengths: number[] = []
  for (let i = 1; i < periodStarts.length; i += 1) {
    const length = dayDiff(periodStarts[i - 1], periodStarts[i])
    if (length >= 20 && length <= 60) {
      lengths.push(length)
    }
  }

  return lengths
}

export function getAverageCycleLength(periodStarts: Date[], fallback = 28): number {
  const cycleLengths = getCycleLengths(periodStarts)
  if (cycleLengths.length === 0) {
    return fallback
  }

  return Math.round(cycleLengths.reduce((sum, value) => sum + value, 0) / cycleLengths.length)
}

export function getCycleDayForDate(date: Date, periodStarts: Date[], cycleLength: number): number | null {
  const start = periodStarts
    .filter((periodStart) => periodStart.getTime() <= date.getTime())
    .sort((a, b) => b.getTime() - a.getTime())[0]

  if (!start || cycleLength <= 0) {
    return null
  }

  const elapsed = dayDiff(start, date)
  const normalized = ((elapsed % cycleLength) + cycleLength) % cycleLength
  return normalized + 1
}

export function calculateCycleDay(lastPeriodStart: Date): number {
  const elapsed = dayDiff(lastPeriodStart, new Date())
  return Math.max(1, elapsed + 1)
}

export function calculatePhase(cycleDay: number, cycleLength: number): Phase {
  const safeDay = Math.max(1, cycleDay)
  const ovulationDay = Math.max(14, cycleLength - 14)
  const ovulatoryEnd = Math.min(cycleLength, ovulationDay + 2)

  if (safeDay <= 5) {
    return 'menstrual'
  }

  if (safeDay < ovulationDay) {
    return 'follicular'
  }

  if (safeDay <= ovulatoryEnd) {
    return 'ovulatory'
  }

  return 'luteal'
}

export function calculateLutealLength(periodStart: Date, nextPeriodStart: Date, cycleLength: number): number {
  const estimatedOvulationDay = Math.max(1, cycleLength - 14)
  const ovulationDate = addDays(periodStart, estimatedOvulationDay)
  return Math.max(1, dayDiff(ovulationDate, nextPeriodStart))
}

export function calculateVariabilityScore(cycleLengths: number[]): { stdDev: number; label: string } {
  if (cycleLengths.length < 2) {
    return {
      stdDev: 0,
      label: 'Log more cycles to estimate regularity',
    }
  }

  const mean = cycleLengths.reduce((sum, value) => sum + value, 0) / cycleLengths.length
  const variance = cycleLengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / cycleLengths.length
  const stdDev = Number(Math.sqrt(variance).toFixed(1))

  if (stdDev < 2) {
    return { stdDev, label: 'Very regular' }
  }

  if (stdDev <= 4) {
    return { stdDev, label: `Mostly regular, varies by ±${Math.round(stdDev)} days` }
  }

  return { stdDev, label: 'Variable cycles - predictions may be less accurate' }
}

export function calculateFertileWindow(
  cycleLength: number,
  avgLutealLength: number,
): { low: [number, number]; medium: [number, number]; peak: number } {
  const safeCycleLength = Math.max(1, cycleLength)
  const center = Math.min(safeCycleLength, Math.max(1, safeCycleLength - Math.max(1, avgLutealLength)))

  const lowStart = Math.max(1, center - 4)
  const lowEnd = Math.min(safeCycleLength, center + 4)
  const mediumStart = Math.max(1, center - 2)
  const mediumEnd = Math.min(safeCycleLength, center + 2)

  return {
    low: [lowStart, lowEnd],
    medium: [mediumStart, mediumEnd],
    peak: center,
  }
}

export function calculateSymptomPeakDay(logs: Log[]): { symptom: string; peakDay: number; avgScore: number } {
  const grouped = new Map<number, number[]>()

  for (const log of logs) {
    if (!log.cycleDay || typeof log.discomfort !== 'number') {
      continue
    }

    const current = grouped.get(log.cycleDay) ?? []
    current.push(log.discomfort)
    grouped.set(log.cycleDay, current)
  }

  let peakDay = 1
  let peakAverage = 0

  for (const [cycleDay, values] of grouped.entries()) {
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    if (avg > peakAverage) {
      peakAverage = avg
      peakDay = cycleDay
    }
  }

  return {
    symptom: 'discomfort',
    peakDay,
    avgScore: Number(peakAverage.toFixed(1)),
  }
}

const NEGATIVE_MOODS = ['anxious', 'irritable', 'sad']

export function calculateMoodPattern(logs: Log[]): { mood: string; peakDays: number[]; phase: string } | null {
  const countsByMood = new Map<string, number>()
  const daysByMood = new Map<string, number[]>()

  for (const log of logs) {
    if (!log.cycleDay || !Array.isArray(log.moods)) {
      continue
    }

    const matching = log.moods.map((mood) => mood.toLowerCase()).filter((mood) => NEGATIVE_MOODS.includes(mood))

    for (const mood of matching) {
      countsByMood.set(mood, (countsByMood.get(mood) ?? 0) + 1)
      const days = daysByMood.get(mood) ?? []
      days.push(log.cycleDay)
      daysByMood.set(mood, days)
    }
  }

  if (countsByMood.size === 0) {
    return null
  }

  const topMood = [...countsByMood.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const peakDaysRaw = daysByMood.get(topMood) ?? []

  if (peakDaysRaw.length === 0) {
    return null
  }

  const frequency = new Map<number, number>()
  for (const day of peakDaysRaw) {
    frequency.set(day, (frequency.get(day) ?? 0) + 1)
  }

  const peakDays = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => day)
    .sort((a, b) => a - b)

  const averageDay = Math.round(peakDays.reduce((sum, day) => sum + day, 0) / peakDays.length)
  const phase = calculatePhase(averageDay, 28)

  return {
    mood: topMood,
    peakDays,
    phase,
  }
}

function toFivePointScale(field: 'discomfort' | 'energyLevel', value: number): number {
  if (field === 'energyLevel') {
    return value / 2
  }

  return value
}

export function detectLogAnomaly(todayLog: Log, historicalLogs: Log[], cycleDay: number): string | null {
  if (!cycleDay || historicalLogs.length === 0) {
    return null
  }

  const sameDayHistory = historicalLogs.filter((log) => log.cycleDay === cycleDay)
  if (sameDayHistory.length < 2) {
    return null
  }

  const fields: Array<'discomfort' | 'energyLevel'> = ['discomfort', 'energyLevel']

  for (const field of fields) {
    const todayValue = todayLog[field]
    if (typeof todayValue !== 'number') {
      continue
    }

    const historicalValues = sameDayHistory
      .map((log) => log[field])
      .filter((value): value is number => typeof value === 'number')

    if (historicalValues.length < 2) {
      continue
    }

    const historicalAvg = historicalValues.reduce((sum, value) => sum + value, 0) / historicalValues.length
    const delta = Math.abs(toFivePointScale(field, todayValue) - toFivePointScale(field, historicalAvg))

    if (delta > 1.5) {
      if (field === 'discomfort') {
        return `Higher discomfort than usual for day ${cycleDay} - you're typically at ${historicalAvg.toFixed(1)}/5 this time of cycle`
      }

      return `Energy is different from usual for day ${cycleDay} - you're typically at ${historicalAvg.toFixed(1)}/10 this time of cycle`
    }
  }

  return null
}

export function isLatePeriod(
  predictedStart: Date,
  today: Date,
  historicalCycleLengths: number[],
): { daysLate: number; isUnusual: boolean; rangeMin: number; rangeMax: number } | null {
  const lateBy = dayDiff(predictedStart, today)
  if (lateBy <= 0) {
    return null
  }

  const filtered = historicalCycleLengths.filter((value) => Number.isFinite(value))
  if (filtered.length === 0) {
    return {
      daysLate: lateBy,
      isUnusual: false,
      rangeMin: 0,
      rangeMax: 0,
    }
  }

  const mean = filtered.reduce((sum, value) => sum + value, 0) / filtered.length
  const maxSeen = Math.max(...filtered)
  const projectedCurrentLength = mean + lateBy

  return {
    daysLate: lateBy,
    isUnusual: projectedCurrentLength > maxSeen,
    rangeMin: Math.min(...filtered),
    rangeMax: maxSeen,
  }
}
