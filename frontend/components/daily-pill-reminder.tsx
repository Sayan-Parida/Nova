'use client'

import { useEffect, useRef } from 'react'
import api from '@/src/lib/api'
import { decryptCyclePayload } from '@/src/lib/crypto'
import { useAuth } from '@/context/AuthContext'

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
}

const DEFAULT_REMINDER_TIME = '08:00'

export function DailyPillReminder() {
  const { token, userId, password } = useAuth()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const sendReminder = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    if (Notification.permission !== 'granted') {
      return
    }

    new Notification('Nova', {
      body: 'Time for your daily reminder',
    })
  }

  const scheduleReminder = (timeValue: string) => {
    clearTimers()

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    if (Notification.permission !== 'granted') {
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

    const msUntilNext = next.getTime() - now.getTime()

    timeoutRef.current = setTimeout(() => {
      sendReminder()
      intervalRef.current = setInterval(sendReminder, 24 * 60 * 60 * 1000)
    }, msUntilNext)
  }

  useEffect(() => {
    if (!token || !userId || !password) {
      clearTimers()
      return
    }

    let cancelled = false

    const loadReminderProfile = async () => {
      try {
        const response = await api.get(`/api/cycles/${userId}`)
        const logs = (Array.isArray(response.data) ? response.data : []) as CycleLogItem[]
        const latestProfileLog = logs
          .filter((log) => log.dataType === 'PROFILE')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

        if (!latestProfileLog) {
          clearTimers()
          return
        }

        const decryptedProfile = await decryptCyclePayload(latestProfileLog.encryptedData, password) as {
          reminder?: ReminderProfile
        }

        if (cancelled) {
          return
        }

        const reminder = decryptedProfile.reminder
        if (!reminder?.dailyReminderEnabled) {
          clearTimers()
          return
        }

        scheduleReminder(reminder.dailyReminderTime || DEFAULT_REMINDER_TIME)
      } catch {
        clearTimers()
      }
    }

    loadReminderProfile()

    return () => {
      cancelled = true
      clearTimers()
    }
  }, [password, token, userId])

  return null
}
