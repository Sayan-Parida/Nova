'use client'

import type { FallbackProps } from 'react-error-boundary'
import { ErrorBoundary } from 'react-error-boundary'

function AppErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  console.error(error)

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Something went wrong</p>
          <h1 className="text-2xl font-light text-foreground">Nova hit a problem</h1>
          <p className="text-sm text-muted-foreground">
            Refresh the page or try again. Your data is encrypted on your device before being stored — we can never read it.
          </p>
        </div>

        <button
          type="button"
          onClick={resetErrorBoundary}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={AppErrorFallback}
      onError={(error) => {
        console.error(error)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
