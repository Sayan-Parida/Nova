'use client'

import Link from 'next/link'
import { DotDecoration } from '@/components/dot-decoration'

export default function LandingPage() {

  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Dot decorations background */}
      <div className="absolute inset-0 pointer-events-none">
        <DotDecoration />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-2xl text-center space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
              <svg
                className="w-8 h-8 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="9" strokeWidth="1.5" opacity="0.5" />
                <circle cx="12" cy="12" r="4" strokeWidth="1.5" fill="currentColor" />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-light tracking-tight text-pretty">
              Luna
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-light">
              Track your cycle. Own your data.
            </p>
          </div>

          {/* Privacy badge */}
          <div className="flex justify-center">
            <div className="px-4 py-1.5 rounded-full border border-primary/40 bg-primary/5 text-sm text-primary font-medium">
              🔒 Privacy First
            </div>
          </div>

          {/* Description */}
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            A privacy-first period tracker that keeps your data secure and local. No tracking, no ads, no data sharing. Just you and your cycle.
          </p>

          {/* CTA Button */}
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

          {/* Footer text */}
          <p className="text-xs text-muted-foreground pt-8">
            All data stays on your device. We never collect or store any information.
          </p>
        </div>
      </div>
    </main>
  )
}
