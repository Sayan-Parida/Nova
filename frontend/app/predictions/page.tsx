'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { Navigation } from '@/components/navigation'
import api from '@/src/lib/api'
import { decryptCyclePayload } from '@/src/lib/crypto'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { parseDateInput } from '@/src/lib/cycle-intelligence'

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
  discomfort?: number
  energyLevel?: number
}

type PredictionResponse = {
  predictedDate: string
  confidenceRange: string
}

function toBase64(input: string) {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function buildPredictionInput(rows: Array<{ parsedDate: Date; decrypted: DecryptedCyclePayload }>) {
  const sorted = [...rows].sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
  const recent = sorted.slice(-30)
  const flowSignals = recent.filter((row) => {
    const flow = row.decrypted.flowIntensity?.toLowerCase()
    return flow === 'spotting' || flow === 'light' || flow === 'medium' || flow === 'heavy'
  }).length

  const avgDiscomfort = recent
    .map((row) => row.decrypted.discomfort)
    .filter((value): value is number => typeof value === 'number')

  const avgEnergy = recent
    .map((row) => row.decrypted.energyLevel)
    .filter((value): value is number => typeof value === 'number')

  const payload = {
    entryCount: recent.length,
    flowSignalCount: flowSignals,
    avgDiscomfort: avgDiscomfort.length > 0
      ? avgDiscomfort.reduce((sum, value) => sum + value, 0) / avgDiscomfort.length
      : 0,
    avgEnergy: avgEnergy.length > 0
      ? avgEnergy.reduce((sum, value) => sum + value, 0) / avgEnergy.length
      : 0,
    timestamp: new Date().toISOString(),
  }

  return toBase64(JSON.stringify(payload))
}

export default function PredictionsPage() {
  const router = useRouter()
  const { token, userId, password } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)

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

        const response = await api.get(`/api/cycles/${userId}?page=0&size=365`)
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

        if (cycleRows.length === 0) {
          setError('Please add at least one cycle log before requesting predictions.')
          return
        }

        const predictionResponse = await api.post('/api/predictions/run', {
          inputData: buildPredictionInput(cycleRows),
        })

        setPrediction(predictionResponse.data as PredictionResponse)
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

        {prediction && (
          <section className="space-y-4">
            <h2 className="text-base font-light text-foreground">ONNX prediction</h2>
            <div className="p-6 rounded-lg border border-border bg-card space-y-2">
              <p className="text-sm text-muted-foreground">Predicted next period date</p>
              <p className="text-3xl font-light text-foreground">{prediction.predictedDate}</p>
              <p className="text-sm text-muted-foreground">
                Confidence range: <span className="text-foreground font-medium">{prediction.confidenceRange}</span>
              </p>
            </div>
          </section>
        )}
      </div>

      <Navigation active="predictions" />
    </main>
  )
}
