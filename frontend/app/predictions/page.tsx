'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { CycleTimeline } from '@/components/cycle-timeline'
import { Navigation } from '@/components/navigation'
import api from '@/src/lib/api'
import { decryptCyclePayload } from '@/src/lib/crypto'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

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
  symptoms?: string[]
}

type PredictionStats = {
  cycleLength: number
  currentDay: number
  lastPeriodDate: Date
  nextPeriodDate: Date
  fertileStartDate: Date
  fertileEndDate: Date
  ovulationDate: Date
  confidenceDays: number
  daysUntilNextPeriod: number
}

const DEFAULT_CYCLE_LENGTH = 28
const FALLBACK_CONFIDENCE_DAYS = 2

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseDateInput(value: string | undefined | null) {
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

function dayDiff(from: Date, to: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / millisecondsPerDay)
}

function uniqueDates(dates: Date[]) {
  const map = new Map<string, Date>()
  for (const date of dates) {
    const key = date.toISOString().slice(0, 10)
    if (!map.has(key)) {
      map.set(key, date)
    }
  }
  return [...map.values()].sort((a, b) => a.getTime() - b.getTime())
}

function derivePeriodStarts(sortedDates: Date[]) {
  if (sortedDates.length === 0) {
    return []
  }

  const starts = [sortedDates[0]]
  for (let i = 1; i < sortedDates.length; i += 1) {
    const prev = sortedDates[i - 1]
    const current = sortedDates[i]
    if (dayDiff(prev, current) >= 10) {
      starts.push(current)
    }
  }

  return starts
}

function computeConfidenceDays(cycleLengths: number[]) {
  if (cycleLengths.length < 2) {
    return FALLBACK_CONFIDENCE_DAYS
  }

  const mean = cycleLengths.reduce((sum, value) => sum + value, 0) / cycleLengths.length
  const variance =
    cycleLengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / cycleLengths.length
  const stdDev = Math.sqrt(variance)

  return Math.max(1, Math.min(7, Math.round(stdDev)))
}

function buildPredictionStats(periodStarts: Date[]) {
  const validCycleLengths: number[] = []
  for (let i = 1; i < periodStarts.length; i += 1) {
    const length = dayDiff(periodStarts[i - 1], periodStarts[i])
    if (length >= 20 && length <= 60) {
      validCycleLengths.push(length)
    }
  }

  const averageCycleLength = validCycleLengths.length > 0
    ? Math.round(validCycleLengths.reduce((sum, value) => sum + value, 0) / validCycleLengths.length)
    : DEFAULT_CYCLE_LENGTH

  const lastPeriodDate = periodStarts.length > 0
    ? periodStarts[periodStarts.length - 1]
    : startOfDay(new Date())

  const elapsed = dayDiff(lastPeriodDate, new Date())
  const normalizedElapsed = ((elapsed % averageCycleLength) + averageCycleLength) % averageCycleLength
  const currentDay = normalizedElapsed + 1
  const daysUntilNextPeriod = averageCycleLength - currentDay

  const nextPeriodDate = new Date(lastPeriodDate)
  nextPeriodDate.setDate(nextPeriodDate.getDate() + averageCycleLength)

  const ovulationDate = new Date(nextPeriodDate)
  ovulationDate.setDate(ovulationDate.getDate() - 14)

  const fertileStartDate = new Date(ovulationDate)
  fertileStartDate.setDate(fertileStartDate.getDate() - 2)

  const fertileEndDate = new Date(ovulationDate)
  fertileEndDate.setDate(fertileEndDate.getDate() + 2)

  return {
    cycleLength: averageCycleLength,
    currentDay,
    lastPeriodDate,
    nextPeriodDate,
    fertileStartDate,
    fertileEndDate,
    ovulationDate,
    confidenceDays: computeConfidenceDays(validCycleLengths),
    daysUntilNextPeriod,
  }
}

export default function PredictionsPage() {
  const router = useRouter()
  const { token, userId, password } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<PredictionStats>(() => buildPredictionStats([]))

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
          logs.map(async (log) => {
            try {
              const decrypted = await decryptCyclePayload(log.encryptedData, password) as DecryptedCyclePayload
              const parsedDate =
                parseDateInput(decrypted.selectedDate)
                ?? parseDateInput(decrypted.timestamp)
                ?? parseDateInput(log.timestamp)

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
          (row): row is { log: CycleLogItem; decrypted: DecryptedCyclePayload; parsedDate: Date | null } =>
            row !== null && row.log.dataType === 'CYCLE' && row.parsedDate !== null,
        )

        const flowRows = cycleRows.filter((row) => row.decrypted.symptoms?.includes('flow'))
        const candidateDates = (flowRows.length > 0 ? flowRows : cycleRows)
          .map((row) => row.parsedDate)
          .filter((date): date is Date => date !== null)

        const periodStarts = derivePeriodStarts(uniqueDates(candidateDates))
        setStats(buildPredictionStats(periodStarts))
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
    fertileStartDate,
    fertileEndDate,
    ovulationDate,
    confidenceDays,
    daysUntilNextPeriod,
  } = stats

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
      {/* Header */}
      <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-light text-foreground">Predictions</h1>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading predictions...</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Next period section */}
        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Next period</h2>
          
          <div className="p-6 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-light text-foreground">
                {formatDate(nextPeriodDate)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Expected in{' '}
              <span className="text-foreground font-medium">
                {daysUntilNextPeriod} days
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              ±{confidenceDays} days accuracy (based on your average cycle length of {cycleLength} days)
            </p>
          </div>
        </section>

        {/* Fertile window section */}
        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Fertile window</h2>

          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {formatDateShort(fertileStartDate)} – {formatDateShort(fertileEndDate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Your most fertile days this cycle
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-border bg-card space-y-2">
            <p className="text-sm font-medium text-foreground">Estimated ovulation</p>
            <p className="text-xl font-light text-foreground">
              {formatDate(ovulationDate)}
            </p>
            <p className="text-xs text-muted-foreground">
              This is when an egg is released from your ovary
            </p>
          </div>
        </section>

        {/* Cycle timeline */}
        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Your cycle</h2>
          <CycleTimeline
            cycleLength={cycleLength}
            currentDay={currentDay}
            lastPeriodDate={lastPeriodDate}
          />
        </section>

        {/* Info box */}
        <section className="p-4 rounded-lg border border-border bg-card space-y-2">
          <p className="text-sm font-medium text-foreground">About predictions</p>
          <p className="text-xs text-muted-foreground">
            These predictions are based on your average cycle length. Every body is different—if your cycle is irregular, these predictions may vary. Track your data over time for more accurate predictions.
          </p>
        </section>
      </div>

      {/* Navigation */}
      <Navigation active="predictions" />
    </main>
  )
}
