'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { toast } from 'sonner'
import { CycleRing } from '@/components/cycle-ring'
import { Navigation } from '@/components/navigation'
import api from '@/src/lib/api'
import { decryptCyclePayload, encryptCyclePayload } from '@/src/lib/crypto'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import {
  addDays,
  calculateCycleDay,
  calculateFertileWindow,
  calculateLutealLength,
  calculateMoodPattern,
  calculatePhase,
  calculateSymptomPeakDay,
  calculateVariabilityScore,
  dateKey,
  detectLogAnomaly,
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

type CyclePayload = {
  selectedDate?: string
  timestamp?: string
  flowIntensity?: string
  discomfort?: number
  moods?: string[]
  energyLevel?: number
  notes?: string
  quickSummary?: string
  painSeverity?: {
    cramps?: number
    headache?: number
    backPain?: number
    bloating?: number
  }
  sleepQuality?: number
}

type DecryptedCycleEntry = {
  log: CycleLogItem
  payload: CyclePayload
  date: Date
}

type QuickCardKey = 'mood' | 'flow' | 'cramps' | 'energy'

const MOOD_OPTIONS = [
  { id: 'happy', label: 'Happy' },
  { id: 'calm', label: 'Calm' },
  { id: 'anxious', label: 'Anxious' },
  { id: 'irritable', label: 'Irritable' },
  { id: 'sad', label: 'Sad' },
  { id: 'energetic', label: 'Energetic' },
]

const FLOW_OPTIONS = ['None', 'Spotting', 'Light', 'Medium', 'Heavy']

function getPhaseCopy(phase: ReturnType<typeof calculatePhase>) {
  if (phase === 'menstrual') {
    return {
      label: 'Menstrual phase',
      copy: 'Your period is here. Rest if you need to.',
    }
  }

  if (phase === 'follicular') {
    return {
      label: 'Follicular phase',
      copy: 'Energy building. Good time for new things.',
    }
  }

  if (phase === 'ovulatory') {
    return {
      label: 'Ovulatory phase',
      copy: 'Peak energy window.',
    }
  }

  return {
    label: 'Luteal phase',
    copy: 'Winding down. Be gentle with yourself.',
  }
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
  const [decryptedCycleEntries, setDecryptedCycleEntries] = useState<DecryptedCycleEntry[]>([])
  const [activeCard, setActiveCard] = useState<QuickCardKey | null>(null)
  const [cardSaved, setCardSaved] = useState<Record<QuickCardKey, boolean>>({
    mood: false,
    flow: false,
    cramps: false,
    energy: false,
  })
  const [quickSaveBusy, setQuickSaveBusy] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    setLogsError('')

    try {
      if (!userId || !password) {
        setLogsError('Unable to load cycle data. Please log in again.')
        return
      }

      const response = await api.get(`/api/cycles/${userId}?page=0&size=365`)
      const logs = (Array.isArray(response.data) ? response.data : []) as CycleLogItem[]

      const decryptedLogs = await Promise.all(
        logs
          .filter((log) => log.dataType === 'CYCLE')
          .map(async (log) => {
            try {
              const payload = await decryptCyclePayload(log.encryptedData, password) as CyclePayload
              const parsedDate =
                parseDateInput(payload.selectedDate)
                ?? parseDateInput(payload.timestamp)
                ?? parseDateInput(log.timestamp)

              if (!parsedDate) {
                return null
              }

              return {
                log,
                payload,
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
  }, [password, userId])

  useEffect(() => {
    if (!token) {
      router.replace('/login')
      return
    }

    loadLogs()
  }, [loadLogs, router, token])

  const metrics = useMemo(() => {
    const sortedEntries = [...decryptedCycleEntries].sort((a, b) => a.date.getTime() - b.date.getTime())
    const today = startOfDay(new Date())

    const periodSignalDates = sortedEntries
      .filter((entry) => {
        const flow = entry.payload.flowIntensity?.toLowerCase()
        return flow === 'spotting' || flow === 'light' || flow === 'medium' || flow === 'heavy'
      })
      .map((entry) => entry.date)

    const periodStarts = derivePeriodStarts(
      uniqueSortedDates(periodSignalDates.length > 0 ? periodSignalDates : sortedEntries.map((entry) => entry.date)),
    )

    const cycleLength = getAverageCycleLength(periodStarts)
    const cycleLengths = getCycleLengths(periodStarts)

    const lastPeriodStart = periodStarts.length > 0
      ? periodStarts[periodStarts.length - 1]
      : (sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1].date : today)

    const currentDay = getCycleDayForDate(today, periodStarts, cycleLength)
      ?? calculateCycleDay(lastPeriodStart)

    const phase = calculatePhase(currentDay, cycleLength)

    const lutealLengths: number[] = []
    for (let i = 1; i < periodStarts.length; i += 1) {
      const currentStart = periodStarts[i - 1]
      const nextStart = periodStarts[i]
      const observedCycleLength = Math.max(20, Math.min(60, Math.round((nextStart.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24))))
      lutealLengths.push(calculateLutealLength(currentStart, nextStart, observedCycleLength))
    }

    const recentLuteal = lutealLengths.slice(-3)
    const avgLutealLength = recentLuteal.length > 0
      ? Math.round(recentLuteal.reduce((sum, value) => sum + value, 0) / recentLuteal.length)
      : null

    const fertileBands = calculateFertileWindow(cycleLength, avgLutealLength ?? 14)
    const ovulationDate = addDays(lastPeriodStart, fertileBands.peak - 1)

    const nextPeriodDate = avgLutealLength
      ? addDays(ovulationDate, avgLutealLength)
      : addDays(lastPeriodStart, cycleLength)

    const daysUntilNextPeriod = Math.round((startOfDay(nextPeriodDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    const latePeriod = isLatePeriod(nextPeriodDate, today, cycleLengths)
    const variability = calculateVariabilityScore(cycleLengths)

    const periodDays = new Set<string>()
    const fertileLowDays = new Set<string>()
    const fertileMediumDays = new Set<string>()
    const fertilePeakDays = new Set<string>()

    const historyStarts = periodStarts.length > 0 ? periodStarts : [lastPeriodStart]

    for (const start of historyStarts) {
      for (let i = 0; i < 5; i += 1) {
        periodDays.add(dateKey(addDays(start, i)))
      }

      const lowStart = addDays(start, fertileBands.low[0] - 1)
      const lowEnd = addDays(start, fertileBands.low[1] - 1)
      const mediumStart = addDays(start, fertileBands.medium[0] - 1)
      const mediumEnd = addDays(start, fertileBands.medium[1] - 1)
      const peakDate = addDays(start, fertileBands.peak - 1)

      for (let i = 0; i <= Math.max(0, Math.round((lowEnd.getTime() - lowStart.getTime()) / (1000 * 60 * 60 * 24))); i += 1) {
        fertileLowDays.add(dateKey(addDays(lowStart, i)))
      }

      for (let i = 0; i <= Math.max(0, Math.round((mediumEnd.getTime() - mediumStart.getTime()) / (1000 * 60 * 60 * 24))); i += 1) {
        fertileMediumDays.add(dateKey(addDays(mediumStart, i)))
      }

      fertilePeakDays.add(dateKey(peakDate))
    }

    const logsWithCycleDay = sortedEntries.map((entry) => {
      const cycleDay = getCycleDayForDate(entry.date, historyStarts, cycleLength) ?? undefined
      return {
        date: entry.date,
        cycleDay,
        flowIntensity: entry.payload.flowIntensity,
        discomfort: entry.payload.discomfort ?? entry.payload.painSeverity?.cramps,
        energyLevel: entry.payload.energyLevel ?? entry.payload.sleepQuality,
        moods: entry.payload.moods,
      }
    })

    const insightCards: string[] = []

    if (historyStarts.length >= 2) {
      const symptom = calculateSymptomPeakDay(logsWithCycleDay)
      if (symptom.avgScore > 0) {
        insightCards.push(`Your discomfort is usually highest on cycle day ${symptom.peakDay}.`)
      }

      const mood = calculateMoodPattern(logsWithCycleDay)
      if (mood) {
        if (mood.phase === 'luteal') {
          insightCards.push(`You tend to feel ${mood.mood} in the days before your period.`)
        } else {
          insightCards.push(`${mood.mood[0].toUpperCase()}${mood.mood.slice(1)} moods cluster around cycle days ${mood.peakDays.join(', ')}.`)
        }
      }

      const energyByPhase = new Map<string, number[]>()
      for (const row of logsWithCycleDay) {
        if (!row.cycleDay || typeof row.energyLevel !== 'number') {
          continue
        }

        const rowPhase = calculatePhase(row.cycleDay, cycleLength)
        const current = energyByPhase.get(rowPhase) ?? []
        current.push(row.energyLevel)
        energyByPhase.set(rowPhase, current)
      }

      if (energyByPhase.size >= 2) {
        const averages = [...energyByPhase.entries()].map(([phaseName, values]) => ({
          phaseName,
          average: values.reduce((sum, value) => sum + value, 0) / values.length,
        }))

        averages.sort((a, b) => b.average - a.average)
        const top = averages[0]
        const low = averages[averages.length - 1]
        insightCards.push(`Your energy peaks in your ${top.phaseName} phase and dips during ${low.phaseName}.`)
      }
    }

    const phasePriority: Record<string, number[]> = {
      menstrual: [0, 2, 1],
      follicular: [2, 0, 1],
      ovulatory: [2, 1, 0],
      luteal: [1, 0, 2],
    }

    const orderedInsights = (phasePriority[phase] ?? [0, 1, 2])
      .map((index) => insightCards[index])
      .filter((text): text is string => Boolean(text))
      .slice(0, 2)

    return {
      today,
      sortedEntries,
      cycleLength,
      cycleLengths,
      currentDay,
      phase,
      phaseCopy: getPhaseCopy(phase),
      periodStarts: historyStarts,
      daysUntilNextPeriod,
      nextPeriodDate,
      latePeriod,
      variability,
      avgLutealLength,
      fertileBands,
      periodDays,
      fertileLowDays,
      fertileMediumDays,
      fertilePeakDays,
      insights: orderedInsights,
    }
  }, [decryptedCycleEntries])

  const todayKey = dateKey(metrics.today)
  const todayEntry = useMemo(
    () => metrics.sortedEntries.find((entry) => dateKey(entry.date) === todayKey),
    [metrics.sortedEntries, todayKey],
  )

  const saveQuickField = async (patch: Partial<CyclePayload>, card: QuickCardKey, collapseAfterSave = false) => {
    if (!password || !userId) {
      toast.error('Session expired. Please log in again.')
      return
    }

    setQuickSaveBusy(true)
    try {
      const existing = todayEntry?.payload ?? {
        selectedDate: todayKey,
        flowIntensity: 'None',
        discomfort: 1,
        moods: [],
        energyLevel: 7,
      }

      const merged: CyclePayload = {
        ...existing,
        ...patch,
        selectedDate: todayKey,
        timestamp: new Date().toISOString(),
      }

      const encryptedData = await encryptCyclePayload(merged, password)

      const requestBody = {
        encryptedData,
        dataType: 'CYCLE',
        logDate: new Date().toISOString().split('T')[0],
      }

      if (todayEntry) {
        await api.put(`/api/cycles/${todayEntry.log.id}`, requestBody)
      } else {
        await api.post('/api/cycles', requestBody)
      }

      const cycleDay = metrics.periodStarts.length > 0
        ? getCycleDayForDate(metrics.today, metrics.periodStarts, metrics.cycleLength)
        : calculateCycleDay(metrics.today)

      if (cycleDay) {
        const historicalLogs = metrics.sortedEntries
          .filter((entry) => dateKey(entry.date) !== todayKey)
          .map((entry) => ({
            date: entry.date,
            cycleDay: getCycleDayForDate(entry.date, metrics.periodStarts, metrics.cycleLength) ?? undefined,
            discomfort: entry.payload.discomfort ?? entry.payload.painSeverity?.cramps,
            energyLevel: entry.payload.energyLevel ?? entry.payload.sleepQuality,
          }))

        const anomaly = detectLogAnomaly(
          {
            date: metrics.today,
            cycleDay,
            discomfort: merged.discomfort,
            energyLevel: merged.energyLevel,
          },
          historicalLogs,
          cycleDay,
        )

        if (anomaly) {
          toast.info(anomaly, { duration: 4000 })
        }
      }

      setCardSaved((prev) => ({ ...prev, [card]: true }))
      toast.success('Saved')
      await loadLogs()

      if (collapseAfterSave) {
        setTimeout(() => {
          setActiveCard(null)
          setCardSaved((prev) => ({ ...prev, [card]: false }))
        }, 1500)
      }
    } catch {
      toast.error('Could not save this update')
    } finally {
      setQuickSaveBusy(false)
    }
  }

  const currentMoods = todayEntry?.payload.moods ?? []
  const currentFlow = todayEntry?.payload.flowIntensity ?? 'None'
  const currentDiscomfort = todayEntry?.payload.discomfort ?? todayEntry?.payload.painSeverity?.cramps ?? 1
  const currentEnergy = todayEntry?.payload.energyLevel ?? todayEntry?.payload.sleepQuality ?? 7

  const toggleMood = async (moodId: string) => {
    const nextMoods = currentMoods.includes(moodId)
      ? currentMoods.filter((mood) => mood !== moodId)
      : [...currentMoods, moodId]

    await saveQuickField({ moods: nextMoods }, 'mood', true)
  }

  const lastSixMonths = useMemo(() => getLastSixMonths(), [])

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
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

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {logsError && <p className="text-sm text-destructive">{logsError}</p>}
        {loadingLogs && <p className="text-sm text-muted-foreground">Loading logs...</p>}

        <section className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{metrics.phaseCopy.label}</p>
            <h2 className="text-lg font-light text-foreground">{metrics.phaseCopy.copy}</h2>
            <p className="text-sm text-muted-foreground">Cycle day {metrics.currentDay}</p>
          </div>

          <div className="flex flex-col items-center py-6">
            <CycleRing currentDay={metrics.currentDay} cycleLength={metrics.cycleLength} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Days until next period</p>
              <p className="text-xl font-light text-foreground">{metrics.daysUntilNextPeriod}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-1">Cycle variability</p>
              <p className="text-sm text-foreground">{metrics.variability.label}</p>
            </div>
          </div>

          {metrics.latePeriod && (
            <div className="p-4 rounded-lg border border-border bg-card space-y-1">
              <p className="text-sm font-medium text-foreground">
                {metrics.latePeriod.daysLate} days late. {metrics.latePeriod.isUnusual ? 'This is unusual for you.' : "You've been this late before."}
              </p>
              <p className="text-xs text-muted-foreground">
                Your cycles have ranged from {metrics.latePeriod.rangeMin} to {metrics.latePeriod.rangeMax} days.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-light text-foreground">How are you feeling today?</h3>

          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => setActiveCard((prev) => (prev === 'mood' ? null : 'mood'))}
              className="w-full p-4 rounded-lg border border-border bg-card text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Mood</span>
                {cardSaved.mood && <span className="text-xs text-primary">Saved</span>}
              </div>
              {activeCard === 'mood' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map((mood) => {
                    const isSelected = currentMoods.includes(mood.id)
                    return (
                      <button
                        key={mood.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void toggleMood(mood.id)
                        }}
                        disabled={quickSaveBusy}
                        className={`px-3 py-1.5 rounded-full border text-xs ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-background border-border text-muted-foreground'
                        }`}
                      >
                        {mood.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCard((prev) => (prev === 'flow' ? null : 'flow'))}
              className="w-full p-4 rounded-lg border border-border bg-card text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Flow</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{currentFlow}</span>
                  {cardSaved.flow && <span className="text-xs text-primary">Saved</span>}
                </div>
              </div>
              {activeCard === 'flow' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {FLOW_OPTIONS.map((flow) => (
                    <button
                      key={flow}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void saveQuickField({ flowIntensity: flow }, 'flow')
                      }}
                      disabled={quickSaveBusy}
                      className={`px-3 py-1.5 rounded-full border text-xs ${
                        currentFlow === flow
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-background border-border text-muted-foreground'
                      }`}
                    >
                      {flow}
                    </button>
                  ))}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCard((prev) => (prev === 'cramps' ? null : 'cramps'))}
              className="w-full p-4 rounded-lg border border-border bg-card text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Cramps</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{currentDiscomfort}/5</span>
                  {cardSaved.cramps && <span className="text-xs text-primary">Saved</span>}
                </div>
              </div>
              {activeCard === 'cramps' && (
                <div className="mt-3">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={currentDiscomfort}
                    onChange={(event) => {
                      event.stopPropagation()
                      void saveQuickField({ discomfort: Number(event.target.value) }, 'cramps')
                    }}
                    className="w-full accent-primary"
                  />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCard((prev) => (prev === 'energy' ? null : 'energy'))}
              className="w-full p-4 rounded-lg border border-border bg-card text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Energy</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{currentEnergy}/10</span>
                  {cardSaved.energy && <span className="text-xs text-primary">Saved</span>}
                </div>
              </div>
              {activeCard === 'energy' && (
                <div className="mt-3">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={currentEnergy}
                    onChange={(event) => {
                      event.stopPropagation()
                      void saveQuickField({ energyLevel: Number(event.target.value) }, 'energy')
                    }}
                    className="w-full accent-primary"
                  />
                </div>
              )}
            </button>
          </div>

          <Link
            href="/log"
            className="block w-full p-3 rounded-lg bg-card border border-border text-center text-foreground hover:bg-white/15 transition-colors"
          >
            Add more details
          </Link>
        </section>

        <section className="space-y-4">
          <h3 className="text-base font-light text-foreground">Insights</h3>

          {metrics.insights.length === 0 && (
            <div className="p-4 rounded-lg border border-border bg-card">
              <p className="text-sm text-muted-foreground">Log for a few more cycles to see your patterns.</p>
            </div>
          )}

          {metrics.insights.map((insight) => (
            <div key={insight} className="p-4 rounded-lg border border-border bg-card">
              <p className="text-sm text-foreground">{insight}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3 p-4 rounded-lg border border-border bg-card">
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
                      const isPeriodDay = metrics.periodDays.has(key)
                      const isPeak = metrics.fertilePeakDays.has(key)
                      const isMedium = metrics.fertileMediumDays.has(key)
                      const isLow = metrics.fertileLowDays.has(key)

                      return (
                        <span
                          key={`${month.label}-${day}`}
                          className={`h-6 w-6 rounded-md text-[10px] flex items-center justify-center border ${
                            isPeriodDay
                              ? 'bg-white/16 border-white/35 text-foreground'
                              : isPeak
                                ? 'bg-primary/60 border-primary text-primary-foreground'
                                : isMedium
                                  ? 'bg-primary/30 border-primary/60 text-foreground'
                                  : isLow
                                    ? 'bg-primary/10 border-primary/30 text-muted-foreground'
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

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-white/30 border border-white/40" />
              Period
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-primary/60 border border-primary" />
              Most likely fertile
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-primary/30 border border-primary/60" />
              Possibly fertile
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-primary/10 border border-primary/30" />
              Less likely
            </span>
          </div>
        </section>
      </div>

      <Navigation active="dashboard" />
    </main>
  )
}
