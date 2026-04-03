'use client'

import { useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import api, { setAuthSession } from '@/src/lib/api'
import { OnboardingLayout } from '@/components/onboarding-layout'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')

    if (!email.trim()) {
      setError('Please enter your email')
      return
    }

    if (!password.trim()) {
      setError('Please enter your password')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      })
      setAuthSession(response.data.token, password)
      window.location.href = '/dashboard'
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setError((err.response.data as { message?: string })?.message ?? 'Invalid input')
      } else if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <OnboardingLayout
      step={1}
      title="Welcome back"
      subtitle="Log in to continue"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full mt-8 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>

        <div className="flex justify-center">
          <Link
            href="/onboarding/step-1"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Need an account? Sign up
          </Link>
        </div>
      </div>
    </OnboardingLayout>
  )
}
