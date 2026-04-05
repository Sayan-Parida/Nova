'use client'

import Link from 'next/link'

export default function LandingPage() {

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-2xl text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-light tracking-tight text-pretty">
              Nova
            </h1>
            <p className="text-base md:text-lg text-muted-foreground font-light">
              Private cycle tracking with encrypted records.
            </p>
          </div>

          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Data is encrypted with your password. No advertising and no data sharing.
          </p>

          <div className="pt-6">
            <Link
              href="/onboarding/step-1"
              className="inline-block px-8 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
            <div className="mt-4">
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Already have an account? Log in
              </Link>
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-8">
            All data stays on your device. We never collect or store any information.
          </p>
        </div>
      </div>
    </main>
  )
}
