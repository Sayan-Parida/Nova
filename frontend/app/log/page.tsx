'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/navigation'
import api from '@/src/lib/api'
import { encryptCyclePayload } from '@/src/lib/crypto'
import { useAuth } from '@/context/AuthContext'

const SYMPTOM_OPTIONS = [
  { id: 'flow', label: 'Flow', emoji: '💧' },
  { id: 'cramps', label: 'Cramps', emoji: '😣' },
  { id: 'mood', label: 'Mood changes', emoji: '😊' },
  { id: 'energy', label: 'Energy', emoji: '⚡' },
  { id: 'headache', label: 'Headache', emoji: '🤕' },
  { id: 'bloating', label: 'Bloating', emoji: '🎈' },
  { id: 'sleep', label: 'Sleep', emoji: '😴' },
  { id: 'breast-tenderness', label: 'Breast tenderness', emoji: '💔' },
]

export default function LogPage() {
  const router = useRouter()
  const { token, password } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!token) {
      router.replace('/login')
    }
  }, [router, token])

  const toggleSymptom = (symptomId: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptomId)
        ? prev.filter((id) => id !== symptomId)
        : [...prev, symptomId]
    )
  }

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
          symptoms: selectedSymptoms,
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
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setSaveError((err.response.data as { message?: string })?.message ?? 'Please check your input.')
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
          <h1 className="text-2xl font-light text-foreground">Log your day</h1>
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
            className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          />
        </section>

        {/* Symptoms */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-light text-foreground mb-4">
              What are you experiencing?
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {SYMPTOM_OPTIONS.map((symptom) => (
                <button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.id)}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedSymptoms.includes(symptom.id)
                      ? 'bg-primary/20 border-primary'
                      : 'bg-muted/50 border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-1">{symptom.emoji}</div>
                  <div className="text-sm font-medium">{symptom.label}</div>
                </button>
              ))}
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
            className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors resize-none"
          />
        </section>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
            saved
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          } disabled:opacity-60`}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save entry'}
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
