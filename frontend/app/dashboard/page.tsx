'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { CycleRing } from '@/components/cycle-ring'
import { SymptomButton } from '@/components/symptom-button'
import { Navigation } from '@/components/navigation'
import api from '@/src/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

type CycleLogItem = {
  id: string
  userId: string
  encryptedData: string
  timestamp: string
  dataType: 'CYCLE' | 'SYMPTOM' | 'NOTE'
}

export default function DashboardPage() {
  const router = useRouter()
  const { token, userId } = useAuth()
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [logsError, setLogsError] = useState('')
  const [cycleLogs, setCycleLogs] = useState<CycleLogItem[]>([])
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
      try {
        const response = await api.get(`/api/cycles/${userId}`)
        setCycleLogs(response.data)
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 400) {
          setLogsError((err.response.data as { message?: string })?.message ?? 'Unable to load logs.')
        }
      } finally {
        setLoadingLogs(false)
      }
    }

    loadLogs()
  }, [router, token, userId])

  const toggleSymptom = (symptom: string) => {
    setSymptoms((prev) => ({ ...prev, [symptom]: !prev[symptom] }))
  }

  // Mock data
  const currentDay = 14
  const cycleLength = 28
  const daysUntilNextPeriod = cycleLength - currentDay
  const isFertileWindow = currentDay >= 12 && currentDay <= 16

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-light text-foreground">Luna</h1>
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
            <h2 className="text-xl font-light text-foreground">Your cycle</h2>
            <p className="text-sm text-muted-foreground">Day {currentDay} of {cycleLength}</p>
          </div>

          <div className="flex flex-col items-center py-6">
            <CycleRing currentDay={currentDay} cycleLength={cycleLength} />
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Days until next period</p>
              <p className="text-2xl font-light text-primary">{daysUntilNextPeriod}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Phase</p>
              <p className="text-lg font-light text-secondary">
                {isFertileWindow ? '🌸 Fertile' : currentDay < 14 ? '📍 Follicular' : '🌙 Luteal'}
              </p>
            </div>
          </div>

          {/* Fertile window indicator */}
          {isFertileWindow && (
            <div className="p-4 rounded-lg border border-secondary/30 bg-secondary/5">
              <p className="text-sm text-foreground">
                <span className="font-medium">Fertile window</span>
                <br />
                <span className="text-muted-foreground text-xs">You're in your fertile window. This is the best time to conceive if you're trying to get pregnant.</span>
              </p>
            </div>
          )}
        </section>

        {/* Quick symptom log */}
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-light text-foreground mb-4">How are you feeling today?</h3>
            <div className="grid grid-cols-2 gap-3">
              <SymptomButton
                name="Mood"
                icon="😊"
                active={symptoms.mood}
                onClick={() => toggleSymptom('mood')}
              />
              <SymptomButton
                name="Flow"
                icon="💧"
                active={symptoms.flow}
                onClick={() => toggleSymptom('flow')}
              />
              <SymptomButton
                name="Cramps"
                icon="😣"
                active={symptoms.cramps}
                onClick={() => toggleSymptom('cramps')}
              />
              <SymptomButton
                name="Energy"
                icon="⚡"
                active={symptoms.energy}
                onClick={() => toggleSymptom('energy')}
              />
            </div>
          </div>

          {/* Log notes button */}
          <Link
            href="/log"
            className="block w-full p-3 rounded-lg bg-muted border border-border text-center text-foreground hover:bg-muted/80 transition-colors"
          >
            Add more details to today's log
          </Link>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-light text-foreground">Recent encrypted logs</h3>
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
                <div key={log.id} className="p-3 rounded-lg bg-muted/50 border border-border">
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
