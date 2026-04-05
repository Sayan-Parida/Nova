'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { CycleRing } from '@/components/cycle-ring'
import { SymptomButton } from '@/components/symptom-button'
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

type CyclePayload = {
  selectedDate?: string
  timestamp?: string
  flowIntensity?: string
  painSeverity?: {
    cramps?: number
    headache?: number
    backPain?: number
    bloating?: number
  }
  moods?: string[]
  symptoms?: string[]
  sleepQuality?: number
}

type DecryptedCycleEntry = {
  log: CycleLogItem
  payload: CyclePayload
  date: Date
}

const AVERAGE_CYCLE_LENGTH = 28
const AVERAGE_LUTEAL_PHASE = 14
const PERIOD_LENGTH_DAYS = 5

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dateKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function dayDiff(from: Date, to: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / millisecondsPerDay)
}

function parseCycleDate(value: string | undefined | null) {
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

function uniqueSortedDates(dates: Date[]) {
  const deduped = new Map<string, Date>()
  for (const date of dates) {
    deduped.set(dateKey(date), startOfDay(date))
  }
  return [...deduped.values()].sort((a, b) => a.getTime() - b.getTime())
}

function derivePeriodStarts(dates: Date[]) {
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

function getAverageCycleLength(periodStarts: Date[]) {
  if (periodStarts.length < 2) {
    return AVERAGE_CYCLE_LENGTH
  }

  const cycleLengths: number[] = []
  for (let i = 1; i < periodStarts.length; i += 1) {
    const length = dayDiff(periodStarts[i - 1], periodStarts[i])
    if (length >= 20 && length <= 60) {
      cycleLengths.push(length)
    }
  }

  if (cycleLengths.length === 0) {
    return AVERAGE_CYCLE_LENGTH
  }

  return Math.round(cycleLengths.reduce((sum, value) => sum + value, 0) / cycleLengths.length)
}

function getCycleDayForDate(date: Date, periodStarts: Date[], cycleLength: number) {
  const start = periodStarts
    .filter((periodStart) => periodStart.getTime() <= date.getTime())
    .sort((a, b) => b.getTime() - a.getTime())[0]

  if (!start) {
    return null
  }

  const elapsed = dayDiff(start, date)
  const normalized = ((elapsed % cycleLength) + cycleLength) % cycleLength
  return normalized + 1
}

function getSymptomPatternInsight(entries: DecryptedCycleEntry[], periodStarts: Date[], cycleLength: number) {
  if (entries.length === 0) {
    return 'Log entries for several days to view symptom patterns.'
  }

  const lastThree = [...entries]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 3)

  const crampsEarlyCount = lastThree.filter((entry) => {
    const cycleDay = getCycleDayForDate(entry.date, periodStarts, cycleLength)
    const crampsValue = entry.payload.painSeverity?.cramps
      ?? (entry.payload.symptoms?.includes('cramps') ? 3 : 0)
    return cycleDay !== null && cycleDay <= 2 && crampsValue >= 3
  }).length

  if (crampsEarlyCount >= 2) {
    return 'You usually experience cramps on day 1-2.'
  }

  const fertileStartDay = Math.max(1, cycleLength - AVERAGE_LUTEAL_PHASE - 2)
  const fertileEndDay = Math.min(cycleLength, fertileStartDay + 4)
  const energeticFertileCount = lastThree.filter((entry) => {
    const cycleDay = getCycleDayForDate(entry.date, periodStarts, cycleLength)
    const hasEnergeticMood = entry.payload.moods?.includes('energetic')
    return cycleDay !== null && hasEnergeticMood && cycleDay >= fertileStartDay && cycleDay <= fertileEndDay
  }).length

  if (energeticFertileCount >= 2) {
    return 'Higher energy is often logged during your fertile window.'
  }

  const heavyFlowEarlyCount = lastThree.filter((entry) => {
    const cycleDay = getCycleDayForDate(entry.date, periodStarts, cycleLength)
    const flow = entry.payload.flowIntensity?.toLowerCase()
    return cycleDay !== null && cycleDay <= 3 && (flow === 'medium' || flow === 'heavy')
  }).length

  if (heavyFlowEarlyCount >= 2) {
    return 'Your flow is usually strongest in the first 3 cycle days.'
  }

  return 'Recent logs show mixed patterns. Continue daily tracking for clearer trends.'
}

function buildDayHighlights(periodStarts: Date[], cycleLength: number) {
  const periodDays = new Set<string>()
  const fertileDays = new Set<string>()

  for (const start of periodStarts) {
    for (let i = 0; i < PERIOD_LENGTH_DAYS; i += 1) {
      periodDays.add(dateKey(addDays(start, i)))
    }

    const ovulationDayOffset = cycleLength - AVERAGE_LUTEAL_PHASE - 1
    const ovulationDate = addDays(start, ovulationDayOffset)
    const fertileStart = addDays(ovulationDate, -2)

    for (let i = 0; i < 5; i += 1) {
      fertileDays.add(dateKey(addDays(fertileStart, i)))
    }
  }

  return { periodDays, fertileDays }
}

function getLastSixMonths() {
  const now = new Date()
  const months: Array<{ year: number; month: number; label: string; daysInMonth: number; firstWeekday: number }> = []

  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstWeekday = monthDate.getDay()
    const label = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    months.push({ year, month, label, daysInMonth, firstWeekday })
  }

  return months
}

export default function DashboardPage() {
  const router = useRouter()
  const { token, userId, password } = useAuth()
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [logsError, setLogsError] = useState('')
  const [cycleLogs, setCycleLogs] = useState<CycleLogItem[]>([])
  const [decryptedCycleEntries, setDecryptedCycleEntries] = useState<DecryptedCycleEntry[]>([])
  const [symptoms, setSymptoms] = useState<{ [key: string]: boolean }>({
    mood: false,
    flow: false,
    cramps: false,
    energy: false,
  })

  useEffect(() => {
    if (!token) {
      router.replace('/login')
      return
    }

    const loadLogs = async () => {
      setLoadingLogs(true)
      setLogsError('')
      setDecryptedCycleEntries([])
      try {
        if (!userId) {
          setLogsError('Unable to load cycle data. Please log in again.')
          return
        }

        if (!password) {
          setLogsError('Unable to decrypt cycle data. Please log in again.')
          return
        }

        const response = await api.get(`/api/cycles/${userId}`)
        const logs = Array.isArray(response.data) ? response.data : []
        setCycleLogs(logs)

        const decryptedLogs = await Promise.all(
          logs.map(async (log) => {
            try {
              const decrypted = await decryptCyclePayload(log.encryptedData, password) as CyclePayload
              const parsedDate =
                parseCycleDate(decrypted.selectedDate)
                ?? parseCycleDate(decrypted.timestamp)
                ?? parseCycleDate(log.timestamp)

              if (!parsedDate || log.dataType !== 'CYCLE') {
                return null
              }

              return {
                log,
                payload: decrypted,
                date: parsedDate,
              }
            } catch {
              return null
            }
          }),
        )

        const entries = decryptedLogs.filter((entry): entry is DecryptedCycleEntry => entry !== null)
        setDecryptedCycleEntries(entries)
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 400) {
          setLogsError((err.response.data as { message?: string })?.message ?? 'Unable to load logs.')
        } else {
          setLogsError('Unable to load logs.')
        }
      } finally {
        setLoadingLogs(false)
      }
    }

    loadLogs()
  }, [password, router, token, userId])

  const toggleSymptom = (symptom: string) => {
    setSymptoms((prev) => ({ ...prev, [symptom]: !prev[symptom] }))
  }

  const insights = useMemo(() => {
    const fallbackPeriodStart = startOfDay(new Date())
    const sortedEntries = [...decryptedCycleEntries].sort((a, b) => a.date.getTime() - b.date.getTime())

    const periodSignalDates = sortedEntries
      .filter((entry) => {
        const flow = entry.payload.flowIntensity?.toLowerCase()
        const symptomFlow = entry.payload.symptoms?.includes('flow')
        return symptomFlow || flow === 'spotting' || flow === 'light' || flow === 'medium' || flow === 'heavy'
      })
      .map((entry) => entry.date)

    const candidateDates = periodSignalDates.length > 0
      ? periodSignalDates
      : sortedEntries.map((entry) => entry.date)

    const periodStarts = derivePeriodStarts(uniqueSortedDates(candidateDates))
    const averageCycleLength = getAverageCycleLength(periodStarts)

    const latestPeriodStart = periodStarts.length > 0
      ? periodStarts[periodStarts.length - 1]
      : (sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1].date : fallbackPeriodStart)

    const today = startOfDay(new Date())
    const elapsedDays = dayDiff(latestPeriodStart, today)
    const normalizedElapsed = ((elapsedDays % averageCycleLength) + averageCycleLength) % averageCycleLength
    const currentDay = normalizedElapsed + 1
    const daysUntilNextPeriod = averageCycleLength - currentDay
    const isFertileWindow = currentDay >= 12 && currentDay <= 16

    const nextPeriodDate = addDays(latestPeriodStart, averageCycleLength)
    const showPmsPrediction = currentDay >= 21 && currentDay <= averageCycleLength

    const historyStarts = periodStarts.length > 0 ? periodStarts : [latestPeriodStart]
    const highlights = buildDayHighlights(historyStarts, averageCycleLength)

    const symptomInsight = getSymptomPatternInsight(sortedEntries, historyStarts, averageCycleLength)

    return {
      cycleLength: averageCycleLength,
      currentDay,
      daysUntilNextPeriod,
      isFertileWindow,
      showPmsPrediction,
      nextPeriodDate,
      pmsLikelyInDays: Math.max(daysUntilNextPeriod, 0),
      periodDays: highlights.periodDays,
      fertileDays: highlights.fertileDays,
      symptomInsight,
    }
  }, [decryptedCycleEntries])

  const lastSixMonths = useMemo(() => getLastSixMonths(), [])

  const {
    cycleLength,
    currentDay,
    daysUntilNextPeriod,
    isFertileWindow,
    showPmsPrediction,
    pmsLikelyInDays,
    periodDays,
    fertileDays,
    symptomInsight,
  } = insights

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-light text-foreground">Nova</h1>
          <Link
            href="/dashboard/settings"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Cycle ring section */}
        <section className="space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-light text-foreground">Your cycle</h2>
            <p className="text-sm text-muted-foreground">Day {currentDay} of {cycleLength}</p>
          </div>

          <div className="flex flex-col items-center py-6">
            <CycleRing currentDay={currentDay} cycleLength={cycleLength} />
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Days until next period</p>
              <p className="text-xl font-light text-foreground">{daysUntilNextPeriod}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Phase</p>
              <p className="text-base font-light text-foreground">
                {isFertileWindow ? 'Fertile' : currentDay < 14 ? 'Follicular' : 'Luteal'}
              </p>
            </div>
          </div>

          {daysUntilNextPeriod >= 0 && daysUntilNextPeriod <= 3 && (
            <div className="p-4 rounded-lg border border-border bg-card">
              <p className="text-sm text-foreground">
                <span className="font-medium">Your period is coming in {daysUntilNextPeriod} day{daysUntilNextPeriod === 1 ? '' : 's'}</span>
                <br />
                <span className="text-xs text-muted-foreground">Consider preparing supplies.</span>
              </p>
            </div>
          )}

          {/* Fertile window indicator */}
          {isFertileWindow && (
            <div className="p-4 rounded-lg border border-border bg-card">
              <p className="text-sm text-foreground">
                <span className="font-medium">Fertile window</span>
                <br />
                <span className="text-muted-foreground text-xs">You are currently in your estimated fertile window.</span>
              </p>
            </div>
          )}
        </section>

        {/* Insights */}
        <section className="space-y-4">
          <h3 className="text-base font-light text-foreground">Insights</h3>

          {/* PMS prediction */}
          {showPmsPrediction && (
            <div className="p-4 rounded-lg border border-border bg-card">
              <p className="text-sm text-foreground">
                <span className="font-medium">PMS prediction</span>
                <br />
                <span className="text-muted-foreground">
                  PMS likely in {pmsLikelyInDays} day{pmsLikelyInDays === 1 ? '' : 's'} based on your average luteal phase ({AVERAGE_LUTEAL_PHASE} days).
                </span>
              </p>
            </div>
          )}

          {/* Cycle history calendar */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
            <div>
              <p className="text-sm font-medium text-foreground">Cycle history calendar</p>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lastSixMonths.map((month) => {
                const blankDays = Array.from({ length: month.firstWeekday })
                const days = Array.from({ length: month.daysInMonth }, (_, index) => index + 1)

                return (
                  <div key={`${month.year}-${month.month}`} className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs text-foreground mb-2">{month.label}</p>
                    <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground mb-1">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayName, index) => (
                        <span key={`${month.label}-${dayName}-${index}`} className="text-center">{dayName}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {blankDays.map((_, index) => (
                        <span key={`${month.label}-blank-${index}`} className="h-6" />
                      ))}

                      {days.map((day) => {
                        const currentDate = new Date(month.year, month.month, day)
                        const key = dateKey(currentDate)
                        const isPeriodDay = periodDays.has(key)
                        const isFertileDay = fertileDays.has(key)

                        return (
                          <span
                            key={`${month.label}-${day}`}
                            className={`h-6 w-6 rounded-md text-[10px] flex items-center justify-center border ${
                              isPeriodDay
                                ? 'bg-white/15 border-white/30 text-foreground'
                                : isFertileDay
                                  ? 'bg-white/8 border-white/20 text-foreground'
                                  : 'border-transparent text-muted-foreground'
                            }`}
                          >
                            {day}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-white/30 border border-white/40" />
                Period days
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-white/20 border border-white/30" />
                Fertile days
              </span>
            </div>
          </div>

          {/* Symptom patterns */}
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm font-medium text-foreground mb-1">Symptom patterns</p>
            <p className="text-sm text-muted-foreground">{symptomInsight}</p>
          </div>
        </section>

        {/* Quick symptom log */}
        <section className="space-y-4">
          <div>
            <h3 className="text-base font-light text-foreground mb-4">How are you feeling today?</h3>
            <div className="grid grid-cols-2 gap-3">
              <SymptomButton
                name="Mood"
                active={symptoms.mood}
                onClick={() => toggleSymptom('mood')}
              />
              <SymptomButton
                name="Flow"
                active={symptoms.flow}
                onClick={() => toggleSymptom('flow')}
              />
              <SymptomButton
                name="Cramps"
                active={symptoms.cramps}
                onClick={() => toggleSymptom('cramps')}
              />
              <SymptomButton
                name="Energy"
                active={symptoms.energy}
                onClick={() => toggleSymptom('energy')}
              />
            </div>
          </div>

          {/* Log notes button */}
          <Link
            href="/log"
            className="block w-full p-3 rounded-lg bg-card border border-border text-center text-foreground hover:bg-white/15 transition-colors"
          >
            Add more details to today's log
          </Link>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-light text-foreground">Recent encrypted logs</h3>
          {loadingLogs && (
            <p className="text-sm text-muted-foreground">Loading logs...</p>
          )}
          {logsError && (
            <p className="text-sm text-destructive">{logsError}</p>
          )}
          {!loadingLogs && !logsError && cycleLogs.length === 0 && (
            <p className="text-sm text-muted-foreground">No logs yet.</p>
          )}
          {!loadingLogs && !logsError && cycleLogs.length > 0 && (
            <div className="space-y-3">
              {cycleLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="p-3 rounded-lg bg-card border border-border">
                  <p className="text-xs text-muted-foreground mb-1">{log.dataType} • {new Date(log.timestamp).toLocaleString()}</p>
                  <p className="text-xs break-all text-foreground/80">{log.encryptedData}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Navigation */}
      <Navigation active="dashboard" />
    </main>
  )
}
