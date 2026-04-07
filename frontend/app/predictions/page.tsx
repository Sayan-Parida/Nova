'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { CycleTimeline } from '@/components/cycle-timeline'
import { Navigation } from '@/components/navigation'
import api from '@/src/lib/api'
import { decryptCyclePayload } from '@/src/lib/crypto'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import {
  addDays,
  calculateFertileWindow,
  calculateLutealLength,
  calculateVariabilityScore,
  derivePeriodStarts,
  getAverageCycleLength,
  getCycleDayForDate,
  getCycleLengths,
  isLatePeriod,
  parseDateInput,
  startOfDay,
  uniqueSortedDates,
} from '@/src/lib/cycle-intelligence'

type CycleLogItem = {
  id: string
  userId: string
  encryptedData: string
  timestamp: string
  dataType: 'CYCLE' | 'SYMPTOM' | 'NOTE' | 'PROFILE'
}

type DecryptedCyclePayload = {
  selectedDate?: string
  timestamp?: string
  flowIntensity?: string
}

type PredictionStats = {
  cycleLength: number
  currentDay: number
  lastPeriodDate: Date
  nextPeriodDate: Date
  ovulationDate: Date
  fertileBands: { low: [number, number]; medium: [number, number]; peak: number }
  avgLutealLength: number | null
  daysUntilNextPeriod: number
  variabilityLabel: string
  latePeriod: ReturnType<typeof isLatePeriod>
}

function buildFallbackStats(): PredictionStats {
  const today = startOfDay(new Date())
  return {
    cycleLength: 28,
    currentDay: 1,
    lastPeriodDate: today,
    nextPeriodDate: addDays(today, 28),
    ovulationDate: addDays(today, 13),
    fertileBands: calculateFertileWindow(28, 14),
    avgLutealLength: null,
    daysUntilNextPeriod: 28,
    variabilityLabel: 'Log more cycles to estimate regularity',
    latePeriod: null,
  }
}

export default function PredictionsPage() {
  const router = useRouter()
  const { token, userId, password } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<PredictionStats>(() => buildFallbackStats())

  useEffect(() => {
    if (!token) {
      router.replace('/login')
      return
    }

    const loadPredictionData = async () => {
      setLoading(true)
      setError('')

      try {
        if (!userId || !password) {
          setError('Unable to load predictions. Please log in again.')
          return
        }

        const response = await api.get(`/api/cycles/${userId}`)
        const logs = (Array.isArray(response.data) ? response.data : []) as CycleLogItem[]

        const decryptedRows = await Promise.all(
          logs
            .filter((log) => log.dataType === 'CYCLE')
            .map(async (log) => {
              try {
                const decrypted = await decryptCyclePayload(log.encryptedData, password) as DecryptedCyclePayload
                const parsedDate =
                  parseDateInput(decrypted.selectedDate)
                  ?? parseDateInput(decrypted.timestamp)
                  ?? parseDateInput(log.timestamp)

                if (!parsedDate) {
                  return null
                }

                return {
                  log,
                  decrypted,
                  parsedDate,
                }
              } catch {
                return null
              }
            }),
        )

        const cycleRows = decryptedRows.filter(
          (row): row is { log: CycleLogItem; decrypted: DecryptedCyclePayload; parsedDate: Date } =>
            row !== null,
        )

        const periodSignalDates = cycleRows
          .filter((row) => {
            const flow = row.decrypted.flowIntensity?.toLowerCase()
            return flow === 'spotting' || flow === 'light' || flow === 'medium' || flow === 'heavy'
          })
          .map((row) => row.parsedDate)

        const dates = periodSignalDates.length > 0
          ? periodSignalDates
          : cycleRows.map((row) => row.parsedDate)

        const periodStarts = derivePeriodStarts(uniqueSortedDates(dates))
        const cycleLength = getAverageCycleLength(periodStarts)
        const cycleLengths = getCycleLengths(periodStarts)
        const variability = calculateVariabilityScore(cycleLengths)

        const lastPeriodDate = periodStarts.length > 0
          ? periodStarts[periodStarts.length - 1]
          : startOfDay(new Date())

        const currentDay = getCycleDayForDate(startOfDay(new Date()), periodStarts, cycleLength) ?? 1

        const lutealLengths: number[] = []
        for (let i = 1; i < periodStarts.length; i += 1) {
          const start = periodStarts[i - 1]
          const next = periodStarts[i]
          const observedLength = Math.max(20, Math.min(60, Math.round((next.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))))
          lutealLengths.push(calculateLutealLength(start, next, observedLength))
        }

        const recentLuteal = lutealLengths.slice(-3)
        const avgLutealLength = recentLuteal.length > 0
          ? Math.round(recentLuteal.reduce((sum, value) => sum + value, 0) / recentLuteal.length)
          : null

        const fertileBands = calculateFertileWindow(cycleLength, avgLutealLength ?? 14)
        const ovulationDate = addDays(lastPeriodDate, fertileBands.peak - 1)

        const nextPeriodDate = avgLutealLength
          ? addDays(ovulationDate, avgLutealLength)
          : addDays(lastPeriodDate, cycleLength)

        const today = startOfDay(new Date())
        const daysUntilNextPeriod = Math.round((nextPeriodDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        setStats({
          cycleLength,
          currentDay,
          lastPeriodDate,
          nextPeriodDate,
          ovulationDate,
          fertileBands,
          avgLutealLength,
          daysUntilNextPeriod,
          variabilityLabel: variability.label,
          latePeriod: isLatePeriod(nextPeriodDate, today, cycleLengths),
        })
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 400) {
          setError((err.response.data as { message?: string })?.message ?? 'Unable to load predictions.')
        } else {
          setError('Unable to load predictions.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadPredictionData()
  }, [password, router, token, userId])

  const {
    cycleLength,
    currentDay,
    lastPeriodDate,
    nextPeriodDate,
    ovulationDate,
    fertileBands,
    avgLutealLength,
    daysUntilNextPeriod,
    variabilityLabel,
    latePeriod,
  } = stats

  const fertileDates = useMemo(() => {
    return {
      lowStart: addDays(lastPeriodDate, fertileBands.low[0] - 1),
      lowEnd: addDays(lastPeriodDate, fertileBands.low[1] - 1),
      mediumStart: addDays(lastPeriodDate, fertileBands.medium[0] - 1),
      mediumEnd: addDays(lastPeriodDate, fertileBands.medium[1] - 1),
      peak: addDays(lastPeriodDate, fertileBands.peak - 1),
    }
  }, [fertileBands, lastPeriodDate])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-light text-foreground">Predictions</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {loading && <p className="text-sm text-muted-foreground">Loading predictions...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {latePeriod && (
          <section className="space-y-4">
            <h2 className="text-base font-light text-foreground">Late period confidence</h2>
            <div className="p-6 rounded-lg border border-border bg-card space-y-2">
              <p className="text-sm text-foreground">
                {latePeriod.daysLate} days late. {latePeriod.isUnusual ? 'This is unusual for you.' : "You've been this late before."}
              </p>
              <p className="text-xs text-muted-foreground">
                Your cycles have ranged from {latePeriod.rangeMin} to {latePeriod.rangeMax} days.
              </p>
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Next period</h2>

          <div className="p-6 rounded-lg border border-border bg-card space-y-3">
            <div className="text-3xl font-light text-foreground">{formatDate(nextPeriodDate)}</div>
            <p className="text-sm text-muted-foreground">
              Expected in <span className="text-foreground font-medium">{daysUntilNextPeriod} days</span>
            </p>
            <p className="text-xs text-muted-foreground">Cycle variability: {variabilityLabel}</p>
            <p className="text-xs text-muted-foreground">
              {avgLutealLength
                ? `Your luteal phase is typically ${avgLutealLength} days`
                : 'Log more cycles to estimate your luteal phase length'}
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Fertile window confidence</h2>

          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Most likely fertile</p>
              <p className="text-xs text-muted-foreground">
                {formatDateShort(fertileDates.mediumStart)} - {formatDateShort(fertileDates.mediumEnd)}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Possibly fertile</p>
              <p className="text-xs text-muted-foreground">
                {formatDateShort(fertileDates.lowStart)} - {formatDateShort(fertileDates.lowEnd)}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Peak day</p>
              <p className="text-xs text-muted-foreground">{formatDateShort(fertileDates.peak)}</p>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-border bg-card space-y-2">
            <p className="text-sm font-medium text-foreground">Estimated ovulation</p>
            <p className="text-xl font-light text-foreground">{formatDate(ovulationDate)}</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Your cycle</h2>
          <CycleTimeline
            cycleLength={cycleLength}
            currentDay={currentDay}
            lastPeriodDate={lastPeriodDate}
          />
        </section>
      </div>

      <Navigation active="predictions" />
    </main>
  )
}
