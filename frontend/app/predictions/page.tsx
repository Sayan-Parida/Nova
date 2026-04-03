'use client'

import { CycleTimeline } from '@/components/cycle-timeline'
import { Navigation } from '@/components/navigation'

export default function PredictionsPage() {
  // Mock data
  const cycleLength = 28
  const currentDay = 14
  const lastPeriodDate = new Date()
  lastPeriodDate.setDate(lastPeriodDate.getDate() - currentDay + 1)

  // Calculate next period
  const nextPeriodDate = new Date(lastPeriodDate)
  nextPeriodDate.setDate(nextPeriodDate.getDate() + cycleLength)

  // Calculate fertile window (typically days 12-16 of a 28-day cycle)
  const fertileStartDate = new Date(lastPeriodDate)
  fertileStartDate.setDate(fertileStartDate.getDate() + 12)
  const fertileEndDate = new Date(lastPeriodDate)
  fertileEndDate.setDate(fertileEndDate.getDate() + 16)

  // Ovulation date (typically day 14)
  const ovulationDate = new Date(lastPeriodDate)
  ovulationDate.setDate(ovulationDate.getDate() + 14)

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="border-b border-border p-4 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-light text-foreground">Predictions</h1>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Next period section */}
        <section className="space-y-4">
          <h2 className="text-lg font-light text-foreground">Next period</h2>
          
          <div className="p-6 rounded-lg border border-border bg-muted/30 space-y-3">
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-light text-primary">
                {formatDate(nextPeriodDate)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Expected in{' '}
              <span className="text-foreground font-medium">
                {cycleLength - currentDay} days
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              ±2 days accuracy (based on your average cycle length of {cycleLength} days)
            </p>
          </div>
        </section>

        {/* Fertile window section */}
        <section className="space-y-4">
          <h2 className="text-lg font-light text-foreground">Fertile window</h2>

          <div className="p-4 rounded-lg border border-secondary/30 bg-secondary/5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌸</span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {formatDateShort(fertileStartDate)} – {formatDateShort(fertileEndDate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Your most fertile days this cycle
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
            <p className="text-sm font-medium text-foreground">Estimated ovulation</p>
            <p className="text-2xl font-light text-secondary">
              {formatDate(ovulationDate)}
            </p>
            <p className="text-xs text-muted-foreground">
              This is when an egg is released from your ovary
            </p>
          </div>
        </section>

        {/* Cycle timeline */}
        <section className="space-y-4">
          <h2 className="text-lg font-light text-foreground">Your cycle</h2>
          <CycleTimeline
            cycleLength={cycleLength}
            currentDay={currentDay}
            lastPeriodDate={lastPeriodDate}
          />
        </section>

        {/* Info box */}
        <section className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
          <p className="text-sm font-medium text-foreground">💡 About predictions</p>
          <p className="text-xs text-muted-foreground">
            These predictions are based on your average cycle length. Every body is different—if your cycle is irregular, these predictions may vary. Track your data over time for more accurate predictions.
          </p>
        </section>
      </div>

      {/* Navigation */}
      <Navigation active="predictions" />
    </main>
  )
}
