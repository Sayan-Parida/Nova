'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clearOnboardingDraft } from '@/src/lib/onboarding-state'
import { useAuth } from '@/context/AuthContext'

export default function SettingsPage() {
  const router = useRouter()
  const { clearAuthSession } = useAuth()

  const handleClearData = () => {
    if (typeof window !== 'undefined') {
      if (window.confirm('Are you sure? This will delete all your data.')) {
        clearAuthSession()
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
          <h1 className="text-2xl font-light text-foreground">Settings</h1>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Account section */}
        <section className="space-y-4">
          <h2 className="text-lg font-light text-foreground">Account</h2>
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <p className="text-sm text-muted-foreground mb-2">Luna Version</p>
            <p className="text-foreground font-medium">1.0.0</p>
          </div>
        </section>

        {/* Privacy section */}
        <section className="space-y-4">
          <h2 className="text-lg font-light text-foreground">Privacy</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-border bg-muted/30">
              <p className="text-sm font-medium text-foreground mb-1">🔒 Data Storage</p>
              <p className="text-xs text-muted-foreground">
                All your data is stored locally on your device. We never send it to our servers or share it with third parties.
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-muted/30">
              <p className="text-sm font-medium text-foreground mb-1">🔐 Encryption</p>
              <p className="text-xs text-muted-foreground">
                Your password is used to encrypt your sensitive data. It&apos;s never stored or transmitted.
              </p>
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="space-y-4">
          <h2 className="text-lg font-light text-foreground">Danger Zone</h2>
          <button
            onClick={handleClearData}
            className="w-full px-4 py-3 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors font-medium text-left"
          >
            Clear all data
          </button>
          <p className="text-xs text-muted-foreground">
            This will permanently delete all your stored information. This action cannot be undone.
          </p>
        </section>

        {/* Footer */}
        <div className="pt-8 border-t border-border space-y-2 text-center text-xs text-muted-foreground">
          <p>Made with 🌙 for your privacy</p>
          <p>Luna &copy; 2024</p>
        </div>
      </div>
    </main>
  )
}
