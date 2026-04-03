import { ReactNode } from 'react'

interface OnboardingLayoutProps {
  step: number
  title: string
  subtitle: string
  children: ReactNode
}

export function OnboardingLayout({
  step,
  title,
  subtitle,
  children,
}: OnboardingLayoutProps) {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full mx-1 transition-colors ${
                  s <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Step {step} of 3
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
              <svg
                className="w-6 h-6 text-primary"
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
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-muted-foreground text-sm">
              {subtitle}
            </p>
          </div>

          {/* Form content */}
          {children}
        </div>
      </div>
    </main>
  )
}
