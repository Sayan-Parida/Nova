'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Navigation } from '@/components/navigation'
import api from '@/src/lib/api'
import { encryptCyclePayload } from '@/src/lib/crypto'
import { useAuth } from '@/context/AuthContext'

type PainType = 'cramps' | 'headache' | 'backPain' | 'bloating'

const FLOW_INTENSITY_OPTIONS = ['None', 'Spotting', 'Light', 'Medium', 'Heavy']

const PAIN_TRACKERS: Array<{ id: PainType; label: string }> = [
  { id: 'cramps', label: 'Cramps' },
  { id: 'headache', label: 'Headache' },
  { id: 'backPain', label: 'Back pain' },
  { id: 'bloating', label: 'Bloating' },
]

const MOOD_OPTIONS = [
  { id: 'happy', label: 'Happy' },
  { id: 'calm', label: 'Calm' },
  { id: 'anxious', label: 'Anxious' },
  { id: 'irritable', label: 'Irritable' },
  { id: 'sad', label: 'Sad' },
  { id: 'energetic', label: 'Energetic' },
]

export default function LogPage() {
  const router = useRouter()
  const { token, password } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [flowIntensity, setFlowIntensity] = useState('None')
  const [painSeverity, setPainSeverity] = useState<Record<PainType, number>>({
    cramps: 1,
    headache: 1,
    backPain: 1,
    bloating: 1,
  })
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const [sleepQuality, setSleepQuality] = useState(7)
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!token) {
      router.replace('/login')
    }
  }, [router, token])

  const toggleMood = (moodId: string) => {
    setSelectedMoods((prev) =>
      prev.includes(moodId)
        ? prev.filter((id) => id !== moodId)
        : [...prev, moodId],
    )
  }

  const setPainValue = (painType: PainType, value: number) => {
    setPainSeverity((prev) => ({
      ...prev,
      [painType]: value,
    }))
  }

  const selectedMoodLabels = MOOD_OPTIONS
    .filter((mood) => selectedMoods.includes(mood.id))
    .map((mood) => mood.label)

  const averagePain = (
    Object.values(painSeverity).reduce((sum, value) => sum + value, 0)
    / Object.values(painSeverity).length
  ).toFixed(1)

  const quickSummary = [
    `Flow: ${flowIntensity}`,
    selectedMoodLabels.length > 0 ? `Mood: ${selectedMoodLabels.join(', ')}` : 'Mood: None selected',
    `Sleep: ${sleepQuality}/10`,
    `Avg pain: ${averagePain}/5`,
  ].join(' • ')

  const handleSave = async () => {
    setSaveError('')

    if (!password) {
      setSaveError('Session expired. Please log in again.')
      return
    }

    setSaving(true)
    try {
      const encryptedData = await encryptCyclePayload(
        {
          selectedDate,
          flowIntensity,
          painSeverity,
          moods: selectedMoods,
          sleepQuality,
          quickSummary,
          notes,
          timestamp: new Date().toISOString(),
        },
        password,
      )

      await api.post('/api/cycles', {
        encryptedData,
        dataType: 'CYCLE',
      })

      setSaved(true)
      toast.success('Entry saved securely')
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
        {/* Date picker */}
        <section className="space-y-4">
          <label className="block text-sm font-medium text-foreground">
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          />
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

        {/* Pain tracker */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-light text-foreground">Pain tracker</h2>
            <p className="text-xs text-muted-foreground">1 = low, 5 = high</p>
          </div>

          <div className="space-y-4">
            {PAIN_TRACKERS.map((pain) => (
              <div key={pain.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{pain.label}</p>
                  <span className="text-sm text-primary font-medium">{painSeverity[pain.id]}</span>
                </div>

                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={painSeverity[pain.id]}
                  onChange={(e) => setPainValue(pain.id, Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            ))}
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

        {/* Sleep quality */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-light text-foreground">Sleep quality</h2>
            <span className="text-sm text-primary font-medium">{sleepQuality}/10</span>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={sleepQuality}
              onChange={(e) => setSleepQuality(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Poor</span>
              <span>Great</span>
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
          disabled={saving}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
            saved
              ? 'bg-card border border-border text-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          } disabled:opacity-60`}
        >
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save entry'}
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
