'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Navigation } from '@/components/navigation'
import api from '@/src/lib/api'
import { encryptCyclePayload } from '@/src/lib/crypto'
import { useAuth } from '@/context/AuthContext'
import {
  calculateCycleDay,
  dateKey,
  detectLogAnomaly,
  derivePeriodStarts,
  getAverageCycleLength,
  getCycleDayForDate,
  parseDateInput,
  uniqueSortedDates,
} from '@/src/lib/cycle-intelligence'

const FLOW_INTENSITY_OPTIONS = ['None', 'Spotting', 'Light', 'Medium', 'Heavy']

const MOOD_OPTIONS = [
  { id: 'happy', label: 'Happy' },
  { id: 'calm', label: 'Calm' },
  { id: 'anxious', label: 'Anxious' },
  { id: 'irritable', label: 'Irritable' },
  { id: 'sad', label: 'Sad' },
  { id: 'energetic', label: 'Energetic' },
]

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
  painSeverity?: {
    cramps?: number
    headache?: number
    backPain?: number
    bloating?: number
  }
  sleepQuality?: number
}

export default function LogPage() {
  const router = useRouter()
  const { token, password, userId } = useAuth()
  const selectedDate = dateKey(new Date())
  const [flowIntensity, setFlowIntensity] = useState('None')
  const [discomfort, setDiscomfort] = useState(1)
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const [energyLevel, setEnergyLevel] = useState(7)
  const [notes, setNotes] = useState('')
  const [existingLogId, setExistingLogId] = useState<string | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!token) {
      router.replace('/login')
    }
  }, [router, token])

  useEffect(() => {
    const loadTodayLog = async () => {
      setLoadingExisting(true)

      if (!token || !userId || !password) {
        setLoadingExisting(false)
        return
      }

      try {
        const response = await api.get(`/api/cycles/${userId}?page=0&size=365`)
        const logs = (Array.isArray(response.data) ? response.data : []) as CycleLogItem[]
        const { decryptCyclePayload } = await import('@/src/lib/crypto')

        const rows = await Promise.all(
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
                  id: log.id,
                  timestamp: log.timestamp,
                  payload,
                  dateValue: dateKey(parsedDate),
                }
              } catch {
                return null
              }
            }),
        )

        const todayRow = rows
          .filter((row): row is { id: string; timestamp: string; payload: CyclePayload; dateValue: string } => row !== null)
          .filter((row) => row.dateValue === selectedDate)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

        if (!todayRow) {
          setExistingLogId(null)
          return
        }

        setExistingLogId(todayRow.id)
        setFlowIntensity(todayRow.payload.flowIntensity ?? 'None')
        setDiscomfort(todayRow.payload.discomfort ?? todayRow.payload.painSeverity?.cramps ?? 1)
        setSelectedMoods(Array.isArray(todayRow.payload.moods) ? todayRow.payload.moods : [])
        setEnergyLevel(todayRow.payload.energyLevel ?? todayRow.payload.sleepQuality ?? 7)
        setNotes(todayRow.payload.notes ?? '')
      } catch {
        setExistingLogId(null)
      } finally {
        setLoadingExisting(false)
      }
    }

    loadTodayLog()
  }, [password, selectedDate, token, userId])

  const toggleMood = (moodId: string) => {
    setSelectedMoods((prev) =>
      prev.includes(moodId)
        ? prev.filter((id) => id !== moodId)
        : [...prev, moodId],
    )
  }

  const selectedMoodLabels = MOOD_OPTIONS
    .filter((mood) => selectedMoods.includes(mood.id))
    .map((mood) => mood.label)

  const quickSummary = [
    `Flow: ${flowIntensity}`,
    selectedMoodLabels.length > 0 ? `Mood: ${selectedMoodLabels.join(', ')}` : 'Mood: None selected',
    `Discomfort: ${discomfort}/5`,
    `Energy: ${energyLevel}/10`,
  ].join(' • ')

  const maybeShowAnomalyToast = async (todayPayload: CyclePayload) => {
    if (!password || !userId) {
      return
    }

    const todayDate = parseDateInput(todayPayload.selectedDate) ?? new Date()

    try {
      const response = await api.get(`/api/cycles/${userId}?page=0&size=365`)
      const logs = (Array.isArray(response.data) ? response.data : []) as CycleLogItem[]
      const { decryptCyclePayload } = await import('@/src/lib/crypto')

      const decryptedRows = await Promise.all(
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

              return { payload, date: parsedDate }
            } catch {
              return null
            }
          }),
      )

      const entries = decryptedRows.filter((row): row is { payload: CyclePayload; date: Date } => row !== null)
      const periodSignalDates = entries
        .filter((entry) => {
          const flow = entry.payload.flowIntensity?.toLowerCase()
          return flow === 'spotting' || flow === 'light' || flow === 'medium' || flow === 'heavy'
        })
        .map((entry) => entry.date)

      const periodStarts = derivePeriodStarts(uniqueSortedDates(periodSignalDates.length > 0 ? periodSignalDates : entries.map((entry) => entry.date)))
      const averageCycleLength = getAverageCycleLength(periodStarts)
      const cycleDay = periodStarts.length > 0
        ? getCycleDayForDate(todayDate, periodStarts, averageCycleLength)
        : calculateCycleDay(todayDate)

      if (!cycleDay) {
        return
      }

      const historicalLogs = entries
        .filter((entry) => dateKey(entry.date) !== dateKey(todayDate))
        .map((entry) => ({
          date: entry.date,
          cycleDay: getCycleDayForDate(entry.date, periodStarts, averageCycleLength) ?? undefined,
          discomfort: entry.payload.discomfort
            ?? entry.payload.painSeverity?.cramps
            ?? undefined,
          energyLevel: entry.payload.energyLevel
            ?? entry.payload.sleepQuality
            ?? undefined,
        }))

      const message = detectLogAnomaly(
        {
          date: todayDate,
          cycleDay,
          discomfort: todayPayload.discomfort,
          energyLevel: todayPayload.energyLevel,
        },
        historicalLogs,
        cycleDay,
      )

      if (message) {
        toast.info(message, { duration: 4000 })
      }
    } catch {
      // Silent fallback for privacy-first UX; no user data leaves the client here.
    }
  }

  const handleSave = async () => {
    setSaveError('')

    if (!password) {
      setSaveError('Session expired. Please log in again.')
      return
    }

    if (loadingExisting) {
      setSaveError('Preparing today\'s log. Please try again.')
      return
    }

    setSaving(true)
    try {
      const payload: CyclePayload = {
        selectedDate,
        flowIntensity,
        discomfort,
        moods: selectedMoods,
        energyLevel,
        quickSummary,
        notes,
        timestamp: new Date().toISOString(),
      }

      const encryptedData = await encryptCyclePayload(
        payload,
        password,
      )

      const requestBody = {
        encryptedData,
        dataType: 'CYCLE',
        logDate: selectedDate,
      }

      if (existingLogId) {
        await api.put(`/api/cycles/${existingLogId}`, requestBody)
      } else {
        const response = await api.post('/api/cycles', requestBody)
        if (response?.data?.id) {
          setExistingLogId(response.data.id as string)
        }
      }

      await maybeShowAnomalyToast(payload)

      setSaved(true)
      toast.success('Entry saved')
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setSaveError((err.response.data as { message?: string })?.message ?? 'Please check your input.')
      } else {
        setSaveError('Unable to save entry. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-light text-foreground">Log your day</h1>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Date */}
        <section className="space-y-4">
          <label className="block text-sm font-medium text-foreground">
            Date
          </label>
          <div className="w-full px-4 py-2 rounded-lg bg-card border border-border text-foreground">
            {selectedDate}
          </div>
          <p className="text-xs text-muted-foreground">Logging is limited to today.</p>
        </section>

        {/* Flow intensity */}
        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Flow intensity</h2>
          <div className="flex flex-wrap gap-2">
            {FLOW_INTENSITY_OPTIONS.map((option) => {
              const isSelected = flowIntensity === option

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFlowIntensity(option)}
                  className={`px-4 py-2 rounded-full border text-sm transition-all ${
                    isSelected
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </section>

        {/* Discomfort */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-light text-foreground">Discomfort</h2>
            <p className="text-xs text-muted-foreground">1 = low, 5 = high</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Discomfort level</p>
              <span className="text-sm text-primary font-medium">{discomfort}</span>
            </div>

            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={discomfort}
              onChange={(e) => setDiscomfort(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </section>

        {/* Mood selector */}
        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Mood</h2>
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map((mood) => {
              const isSelected = selectedMoods.includes(mood.id)

              return (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => toggleMood(mood.id)}
                  className={`px-3 py-2 rounded-full border text-sm transition-all ${
                    isSelected
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mood.label}
                </button>
              )
            })}
          </div>
        </section>

        {/* Energy level */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-light text-foreground">Energy level</h2>
            <span className="text-sm text-primary font-medium">{energyLevel}/10</span>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={energyLevel}
              onChange={(e) => setEnergyLevel(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="space-y-4">
          <label className="block text-sm font-medium text-foreground">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes..."
            rows={4}
            className="w-full px-4 py-2 rounded-lg bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors resize-none"
          />
        </section>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || loadingExisting}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
            saved
              ? 'bg-card border border-border text-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          } disabled:opacity-60`}
        >
          {saving ? 'Saving...' : saved ? 'Saved' : existingLogId ? 'Update today\'s entry' : 'Save today\'s entry'}
        </button>
        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}
      </div>

      {/* Navigation */}
      <Navigation active="log" />
    </main>
  )
}
