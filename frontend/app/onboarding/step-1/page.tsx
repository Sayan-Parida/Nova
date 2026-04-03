'use client'

import { useState } from 'react'
import Link from 'next/link'
import { OnboardingLayout } from '@/components/onboarding-layout'
import { updateOnboardingDraft } from '@/src/lib/onboarding-state'

export default function OnboardingStep1() {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const handleNext = () => {
    const newErrors: { [key: string]: string } = {}
    
    if (!name.trim()) {
      newErrors.name = 'Please enter your name'
    }
    
    if (!age.trim()) {
      newErrors.age = 'Please enter your age'
    } else if (isNaN(Number(age)) || Number(age) < 13 || Number(age) > 120) {
      newErrors.age = 'Please enter a valid age'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    updateOnboardingDraft({ name: name.trim(), age: age.trim() })

    // Redirect to step 2
    window.location.href = '/onboarding/step-2'
  }

  return (
    <OnboardingLayout
      step={1}
      title="What's your name?"
      subtitle="Let's get to know you"
    >
      <div className="space-y-6">
        {/* Name field */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (errors.name) setErrors({ ...errors, name: '' })
            }}
            placeholder="Your name"
            className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Age field */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Age
          </label>
          <input
            type="number"
            value={age}
            onChange={(e) => {
              setAge(e.target.value)
              if (errors.age) setErrors({ ...errors, age: '' })
            }}
            placeholder="Your age"
            min="13"
            max="120"
            className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          />
          {errors.age && (
            <p className="mt-1 text-sm text-destructive">{errors.age}</p>
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
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </OnboardingLayout>
  )
}
