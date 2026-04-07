'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { clearOnboardingDraft } from '@/src/lib/onboarding-state'
import api from '@/src/lib/api'
import { decryptCyclePayload, encryptCyclePayload } from '@/src/lib/crypto'
import { clearAuthSession as clearStoredAuthSession, useAuth } from '@/context/AuthContext'

type CycleLogItem = {
  id: string
  userId: string
  encryptedData: string
  timestamp: string
  dataType: 'CYCLE' | 'SYMPTOM' | 'NOTE' | 'PROFILE'
}

type ReminderProfile = {
  dailyReminderEnabled?: boolean
  dailyReminderTime?: string
  updatedAt?: string
}

type CyclePayload = {
  selectedDate?: string
  timestamp?: string
  flowIntensity?: string
  discomfort?: number
  energyLevel?: number
  symptoms?: string[]
  moods?: string[]
  painSeverity?: {
    cramps?: number
    headache?: number
    backPain?: number
    bloating?: number
  }
}

const DEFAULT_REMINDER_TIME = '08:00'
const DEFAULT_CYCLE_LENGTH = 28

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
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

function dateKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10)
}

function dayDiff(from: Date, to: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / millisecondsPerDay)
}

function uniqueSortedDates(dates: Date[]) {
  const deduped = new Map<string, Date>()
  for (const date of dates) {
    deduped.set(dateKey(date), date)
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

function computeAverageCycleLength(periodStarts: Date[]) {
  if (periodStarts.length < 2) {
    return DEFAULT_CYCLE_LENGTH
  }

  const lengths: number[] = []
  for (let i = 1; i < periodStarts.length; i += 1) {
    const length = dayDiff(periodStarts[i - 1], periodStarts[i])
    if (length >= 20 && length <= 60) {
      lengths.push(length)
    }
  }

  if (lengths.length === 0) {
    return DEFAULT_CYCLE_LENGTH
  }

  return Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length)
}

export default function SettingsPage() {
  const router = useRouter()
  const { token, userId, password } = useAuth()
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false)
  const [dailyReminderTime, setDailyReminderTime] = useState(DEFAULT_REMINDER_TIME)
  const [loadingReminder, setLoadingReminder] = useState(true)
  const [savingReminder, setSavingReminder] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [recentHistory, setRecentHistory] = useState<Array<{ date: string; flow: string; discomfort: string }>>([])
  const reminderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reminderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const notificationSupported = typeof window !== 'undefined' && 'Notification' in window

  const clearReminderTimers = () => {
    if (reminderTimeoutRef.current) {
      clearTimeout(reminderTimeoutRef.current)
      reminderTimeoutRef.current = null
    }
    if (reminderIntervalRef.current) {
      clearInterval(reminderIntervalRef.current)
      reminderIntervalRef.current = null
    }
  }

  const showPillReminderNotification = () => {
    if (!notificationSupported || Notification.permission !== 'granted') {
      return
    }

    // Notification body intentionally short for lock-screen readability.
    new Notification('Nova', {
      body: 'Time for your daily reminder',
    })
  }

  const scheduleDailyReminder = (timeValue: string) => {
    clearReminderTimers()

    if (!dailyReminderEnabled || !notificationSupported || Notification.permission !== 'granted') {
      return
    }

    const [hourStr, minuteStr] = timeValue.split(':')
    const hours = Number(hourStr)
    const minutes = Number(minuteStr)

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return
    }

    const now = new Date()
    const next = new Date()
    next.setHours(hours, minutes, 0, 0)
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1)
    }

    const msUntilFirstReminder = next.getTime() - now.getTime()

    reminderTimeoutRef.current = setTimeout(() => {
      showPillReminderNotification()
      reminderIntervalRef.current = setInterval(
        showPillReminderNotification,
        24 * 60 * 60 * 1000,
      )
    }, msUntilFirstReminder)
  }

  useEffect(() => {
    if (!token) {
      router.replace('/login')
      return
    }

    const loadReminderPreference = async () => {
      setLoadingReminder(true)
      try {
        if (!userId || !password) {
          return
        }

        const response = await api.get(`/api/cycles/${userId}`)
        const logs = (Array.isArray(response.data) ? response.data : []) as CycleLogItem[]

        const historyRows = await Promise.all(
          logs
            .filter((log) => log.dataType === 'CYCLE')
            .slice(0, 20)
            .map(async (log) => {
              try {
                const payload = await decryptCyclePayload(log.encryptedData, password) as CyclePayload
                const parsedDate =
                  parseCycleDate(payload.selectedDate)
                  ?? parseCycleDate(payload.timestamp)
                  ?? parseCycleDate(log.timestamp)

                if (!parsedDate) {
                  return null
                }

                return {
                  date: parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  flow: payload.flowIntensity ?? '-',
                  discomfort: String(payload.discomfort ?? payload.painSeverity?.cramps ?? '-'),
                }
              } catch {
                return null
              }
            }),
        )

        setRecentHistory(historyRows.filter((row): row is { date: string; flow: string; discomfort: string } => row !== null).slice(0, 8))

        const latestProfileLog = logs
          .filter((log) => log.dataType === 'PROFILE')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

        if (!latestProfileLog) {
          return
        }

        const decryptedProfile = await decryptCyclePayload(latestProfileLog.encryptedData, password) as {
          reminder?: ReminderProfile
        }

        const reminder = decryptedProfile.reminder
        if (!reminder) {
          return
        }

        setDailyReminderEnabled(Boolean(reminder.dailyReminderEnabled))
        setDailyReminderTime(reminder.dailyReminderTime || DEFAULT_REMINDER_TIME)
      } catch {
        toast.error('Could not load reminder preferences')
      } finally {
        setLoadingReminder(false)
      }
    }

    loadReminderPreference()
  }, [password, router, token, userId])

  useEffect(() => {
    scheduleDailyReminder(dailyReminderTime)
    return () => {
      clearReminderTimers()
    }
  }, [dailyReminderEnabled, dailyReminderTime])

  const saveReminderPreference = async () => {
    if (!password || !token || !userId) {
      toast.error('Session expired. Please log in again.')
      return
    }

    setSavingReminder(true)
    try {
      if (dailyReminderEnabled && notificationSupported && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          toast.error('Enable browser notifications to use daily reminders')
          setDailyReminderEnabled(false)
          return
        }
      }

      const encryptedData = await encryptCyclePayload(
        {
          reminder: {
            dailyReminderEnabled,
            dailyReminderTime,
            updatedAt: new Date().toISOString(),
          },
        },
        password,
      )

      await api.post('/api/cycles', {
        encryptedData,
        dataType: 'PROFILE',
      })

      scheduleDailyReminder(dailyReminderTime)
      toast.success('Reminder preferences saved')
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        toast.error((err.response.data as { message?: string })?.message ?? 'Please check your reminder settings')
      } else {
        toast.error('Could not save reminder preferences')
      }
    } finally {
      setSavingReminder(false)
    }
  }

  const exportDataAsPdf = async () => {
    if (typeof window === 'undefined') {
      return
    }

    if (!password || !token || !userId) {
      toast.error('Session expired. Please log in again.')
      return
    }

    setExportingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')

      const response = await api.get(`/api/cycles/${userId}`)
      const logs = (Array.isArray(response.data) ? response.data : []) as CycleLogItem[]

      const cycleEntries = await Promise.all(
        logs
          .filter((log) => log.dataType === 'CYCLE')
          .map(async (log) => {
            try {
              const payload = await decryptCyclePayload(log.encryptedData, password) as CyclePayload
              const date =
                parseCycleDate(payload.selectedDate)
                ?? parseCycleDate(payload.timestamp)
                ?? parseCycleDate(log.timestamp)

              if (!date) {
                return null
              }

              return {
                date,
                payload,
              }
            } catch {
              return null
            }
          }),
      )

      const entries = cycleEntries
        .filter((entry): entry is { date: Date; payload: CyclePayload } => entry !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime())

      const periodStarts = derivePeriodStarts(uniqueSortedDates(entries.map((entry) => entry.date)))
      const averageCycleLength = computeAverageCycleLength(periodStarts)

      const cycleLengthByDate = new Map<string, string>()
      for (let i = 0; i < periodStarts.length; i += 1) {
        const key = dateKey(periodStarts[i])
        if (i === 0) {
          cycleLengthByDate.set(key, 'N/A')
        } else {
          cycleLengthByDate.set(key, String(dayDiff(periodStarts[i - 1], periodStarts[i])))
        }
      }

      const doc = new jsPDF()
      let y = 16

      doc.setFontSize(18)
      doc.text('Nova Data Export', 14, y)
      y += 8

      doc.setFontSize(11)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y)
      y += 7
      doc.text(`Average cycle length: ${averageCycleLength} days`, 14, y)
      y += 9

      doc.setFontSize(13)
      doc.text('Cycle History', 14, y)
      y += 7

      doc.setFontSize(10)
      doc.text('Date', 14, y)
      doc.text('Cycle length', 55, y)
      doc.text('Flow', 95, y)
      doc.text('Symptoms', 125, y)
      y += 2
      doc.line(14, y, 196, y)
      y += 5

      const rows = [...entries].sort((a, b) => b.date.getTime() - a.date.getTime())
      for (const row of rows) {
        if (y > 270) {
          doc.addPage()
          y = 18
        }

        const formattedDate = row.date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })

        const cycleLength = cycleLengthByDate.get(dateKey(row.date)) ?? '-'
        const flow = row.payload.flowIntensity ?? '-'

        const symptomParts: string[] = []
        if (Array.isArray(row.payload.symptoms) && row.payload.symptoms.length > 0) {
          symptomParts.push(...row.payload.symptoms)
        }
        if (Array.isArray(row.payload.moods) && row.payload.moods.length > 0) {
          symptomParts.push(...row.payload.moods.map((mood) => `mood:${mood}`))
        }
        if (row.payload.painSeverity) {
          const painSummary = Object.entries(row.payload.painSeverity)
            .filter(([, value]) => typeof value === 'number' && value >= 3)
            .map(([name]) => name)
          if (painSummary.length > 0) {
            symptomParts.push(...painSummary)
          }
        }

        const symptomText = symptomParts.length > 0 ? symptomParts.join(', ') : '-'

        doc.text(formattedDate, 14, y)
        doc.text(cycleLength, 55, y)
        doc.text(flow, 95, y)

        const wrappedSymptoms = doc.splitTextToSize(symptomText, 70)
        doc.text(wrappedSymptoms, 125, y)

        y += Math.max(6, wrappedSymptoms.length * 5)
      }

      if (y > 262) {
        doc.addPage()
        y = 18
      }

      y += 4
      doc.setFontSize(10)
      doc.text('Generated by Nova — your data never touched our servers', 14, y)

      doc.save(`nova-data-export-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success('PDF export generated')
    } catch {
      toast.error('Could not export PDF right now')
    } finally {
      setExportingPdf(false)
    }
  }

  const notificationStatusLabel = useMemo(() => {
    if (!notificationSupported) {
      return 'Notifications not supported in this browser'
    }

    if (Notification.permission === 'granted') {
      return 'Notifications are enabled'
    }

    if (Notification.permission === 'denied') {
      return 'Notifications are blocked in browser settings'
    }

    return 'Notifications will be requested when saving'
  }, [notificationSupported, dailyReminderEnabled])

  const handleClearData = () => {
    if (typeof window !== 'undefined') {
      if (window.confirm('Are you sure? This will delete all your data.')) {
        clearStoredAuthSession()
        clearOnboardingDraft()
        router.replace('/login')
      }
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-light text-foreground">Settings</h1>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Reminders section */}
        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Reminders</h2>
          <div className="p-4 rounded-lg border border-border bg-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Daily reminder</p>
                <p className="text-xs text-muted-foreground">Daily medication reminder</p>
              </div>
              <button
                type="button"
                onClick={() => setDailyReminderEnabled((prev) => !prev)}
                disabled={loadingReminder}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  dailyReminderEnabled ? 'bg-primary' : 'bg-muted-foreground/40'
                } ${loadingReminder ? 'opacity-60' : ''}`}
                aria-label="Toggle daily reminder"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-background transition-transform ${
                    dailyReminderEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-muted-foreground">Reminder time</label>
              <input
                type="time"
                value={dailyReminderTime}
                onChange={(e) => setDailyReminderTime(e.target.value)}
                disabled={!dailyReminderEnabled || loadingReminder}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground disabled:opacity-50"
              />
            </div>

            <p className="text-xs text-muted-foreground">{notificationStatusLabel}</p>

            <button
              type="button"
              onClick={saveReminderPreference}
              disabled={savingReminder || loadingReminder}
              className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {savingReminder ? 'Saving reminder...' : 'Save reminder settings'}
            </button>
          </div>
        </section>

        {/* Data section */}
        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Your data</h2>
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <p className="text-xs text-muted-foreground">
              Export your cycle history to a local PDF summary.
            </p>
            <button
              type="button"
              onClick={exportDataAsPdf}
              disabled={exportingPdf}
              className="w-full px-4 py-2 rounded-lg border border-border text-foreground hover:bg-white/15 transition-colors disabled:opacity-60"
            >
              {exportingPdf ? 'Exporting PDF...' : 'Export my data'}
            </button>
          </div>

          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <p className="text-sm font-medium text-foreground">Recent history</p>
            {recentHistory.length === 0 && (
              <p className="text-xs text-muted-foreground">No cycle entries yet.</p>
            )}
            {recentHistory.length > 0 && (
              <div className="space-y-2">
                {recentHistory.map((row) => (
                  <div key={`${row.date}-${row.flow}-${row.discomfort}`} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{row.date}</span>
                    <span className="text-muted-foreground">Flow {row.flow} • Discomfort {row.discomfort}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Account section */}
        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Account</h2>
          <div className="p-4 rounded-lg border border-border bg-card">
            <p className="text-sm text-muted-foreground mb-2">Nova Version</p>
            <p className="text-foreground font-medium">1.0.0</p>
          </div>
        </section>

        {/* Privacy section */}
        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Privacy</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-border bg-card">
              <p className="text-sm font-medium text-foreground mb-1">Data storage</p>
              <p className="text-xs text-muted-foreground">
                All your data is stored locally on your device. We never send it to our servers or share it with third parties.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <p className="text-sm font-medium text-foreground mb-1">Encryption</p>
              <p className="text-xs text-muted-foreground">
                Your password is used to encrypt your sensitive data. It&apos;s never stored or transmitted.
              </p>
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="space-y-4">
          <h2 className="text-base font-light text-foreground">Data reset</h2>
          <button
            onClick={handleClearData}
            className="w-full px-4 py-3 rounded-lg border border-border text-foreground hover:bg-white/15 transition-colors font-medium text-left"
          >
            Clear all data
          </button>
          <p className="text-xs text-muted-foreground">
            This will permanently delete all your stored information. This action cannot be undone.
          </p>
        </section>

        {/* Footer */}
        <div className="pt-8 border-t border-border space-y-2 text-center text-xs text-muted-foreground">
          <p>Nova &copy; 2024</p>
        </div>
      </div>
    </main>
  )
}
