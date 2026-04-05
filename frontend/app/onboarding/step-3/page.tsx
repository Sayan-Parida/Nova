'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { OnboardingLayout } from '@/components/onboarding-layout'
import { clearOnboardingDraft } from '@/src/lib/onboarding-state'
import { useAuth } from '@/context/AuthContext'

export default function OnboardingStep3() {
  const router = useRouter()
  const { setAuthSession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const handleComplete = async () => {
    console.log('registering...')
    const newErrors: { [key: string]: string } = {}

    if (!email.trim()) {
      newErrors.email = 'Please enter your email'
    }
    
    if (!password.trim()) {
      newErrors.password = 'Please enter a password'
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }
    
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const response = await axios.post('http://localhost:8081/api/auth/register', {
        email: email.trim().toLowerCase(),
        password,
      })

      setAuthSession(response.data.token, password)
      clearOnboardingDraft()
      router.replace('/dashboard')
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setErrors({
          form: (err.response.data as { message?: string })?.message ?? 'Please check your input.',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <OnboardingLayout
      step={3}
      title="Secure your data"
      subtitle="Set a password to protect your information"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) setErrors({ ...errors, email: '' })
            }}
            placeholder="you@example.com"
            className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        {/* Info box */}
        <div className="p-4 rounded-lg bg-card border border-border">
          <p className="text-sm text-foreground">
            <span className="font-medium">Privacy notice:</span> Your password encrypts your data. We never store it on our servers. Data remains on your device.
          </p>
        </div>

        {/* Password field */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errors.password) setErrors({ ...errors, password: '' })
              }}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-destructive">{errors.password}</p>
          )}
        </div>

        {/* Confirm password field */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Confirm password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' })
            }}
            placeholder="Re-enter your password"
            className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Complete button */}
        <button
          type="button"
          onClick={handleComplete}
          disabled={loading}
          className="w-full mt-8 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? 'Creating account...' : 'Complete setup'}
        </button>

        {errors.form && (
          <p className="text-sm text-destructive text-center">{errors.form}</p>
        )}

        {/* Back link */}
        <div className="flex justify-center">
          <Link
            href="/onboarding/step-2"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to previous step
          </Link>
        </div>
        <div className="flex justify-center">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Already have an account? Log in
          </Link>
        </div>
      </div>
    </OnboardingLayout>
  )
}
