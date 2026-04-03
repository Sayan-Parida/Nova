'use client'

import { useState } from 'react'
import Link from 'next/link'
import { OnboardingLayout } from '@/components/onboarding-layout'
import { updateOnboardingDraft } from '@/src/lib/onboarding-state'

export default function OnboardingStep2() {
  const [cycleLength, setCycleLength] = useState('')
  const [lastPeriodDate, setLastPeriodDate] = useState('')
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const handleNext = () => {
    const newErrors: { [key: string]: string } = {}
    
    if (!cycleLength.trim()) {
      newErrors.cycleLength = 'Please enter your cycle length'
    } else if (isNaN(Number(cycleLength)) || Number(cycleLength) < 20 || Number(cycleLength) > 60) {
      newErrors.cycleLength = 'Cycle length should be between 20 and 60 days'
    }
    
    if (!lastPeriodDate.trim()) {
      newErrors.lastPeriodDate = 'Please select your last period date'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    updateOnboardingDraft({
      cycleLength: String(Number(cycleLength)),
      lastPeriodDate,
    })

    // Redirect to step 3
    window.location.href = '/onboarding/step-3'
  }

  return (
    <OnboardingLayout
      step={2}
      title="About your cycle"
      subtitle="Help us understand your patterns"
    >
      <div className="space-y-6">
        {/* Cycle length field */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Average cycle length (days)
          </label>
          <input
            type="number"
            value={cycleLength}
            onChange={(e) => {
              setCycleLength(e.target.value)
              if (errors.cycleLength) setErrors({ ...errors, cycleLength: '' })
            }}
            placeholder="e.g., 28"
            min="20"
            max="60"
            className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          />
          {errors.cycleLength && (
            <p className="mt-1 text-sm text-destructive">{errors.cycleLength}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Usually 21-35 days, typical is 28
          </p>
        </div>

        {/* Last period date */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            First day of last period
          </label>
          <input
            type="date"
            value={lastPeriodDate}
            onChange={(e) => {
              setLastPeriodDate(e.target.value)
              if (errors.lastPeriodDate) setErrors({ ...errors, lastPeriodDate: '' })
            }}
            className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          />
          {errors.lastPeriodDate && (
            <p className="mt-1 text-sm text-destructive">{errors.lastPeriodDate}</p>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="w-full mt-8 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Next
        </button>

        {/* Back link */}
        <div className="flex justify-center">
          <Link
            href="/onboarding/step-1"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to previous step
          </Link>
        </div>
      </div>
    </OnboardingLayout>
  )
}
