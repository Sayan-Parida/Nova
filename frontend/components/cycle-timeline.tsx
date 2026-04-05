interface CycleTimelineProps {
  cycleLength: number
  currentDay: number
  lastPeriodDate: Date
}

export function CycleTimeline({
  cycleLength,
  currentDay,
  lastPeriodDate,
}: CycleTimelineProps) {
  // Create phases for the cycle
  const phases = [
    {
      name: 'Menstrual',
      color: '#ffffff1a',
      start: 1,
      end: 5,
    },
    {
      name: 'Follicular',
      color: '#ffffff24',
      start: 6,
      end: 13,
    },
    {
      name: 'Ovulation',
      color: '#ffffff2e',
      start: 14,
      end: 14,
    },
    {
      name: 'Luteal',
      color: '#ffffff16',
      start: 15,
      end: cycleLength,
    },
  ]

  const getPhaseForDay = (day: number) => {
    return phases.find((phase) => day >= phase.start && day <= phase.end)
  }

  return (
    <div className="space-y-6">
      {/* Timeline bar */}
      <div className="space-y-3">
        <div className="relative h-12 rounded-full bg-muted/30 border border-border overflow-hidden">
          {phases.map((phase) => {
            const phaseWidth =
              ((phase.end - phase.start + 1) / cycleLength) * 100
            const phaseStart = ((phase.start - 1) / cycleLength) * 100

            return (
              <div
                key={phase.name}
                className="absolute h-full"
                style={{
                  left: `${phaseStart}%`,
                  width: `${phaseWidth}%`,
                  backgroundColor: phase.color,
                  opacity: 0.6,
                }}
              />
            )
          })}

          {/* Current day indicator */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-foreground transition-all"
            style={{
              left: `${(currentDay / cycleLength) * 100}%`,
            }}
          />
        </div>

        {/* Day labels */}
        <div className="flex justify-between text-xs text-muted-foreground px-2">
          <span>Day 1</span>
          <span>Day {Math.ceil(cycleLength / 2)}</span>
          <span>Day {cycleLength}</span>
        </div>
      </div>

      {/* Phase cards */}
      <div className="space-y-2">
        {phases.map((phase) => {
          const phaseStart = new Date(lastPeriodDate)
          phaseStart.setDate(phaseStart.getDate() + phase.start - 1)

          const phaseEnd = new Date(lastPeriodDate)
          phaseEnd.setDate(phaseEnd.getDate() + phase.end - 1)

          const isCurrentPhase =
            currentDay >= phase.start && currentDay <= phase.end

          return (
            <div
              key={phase.name}
              className={`p-4 rounded-lg border transition-all ${
                isCurrentPhase
                  ? 'border-primary/70 bg-card'
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div>
                    <p className="font-medium text-foreground">
                      {phase.name}
                      {isCurrentPhase && (
                        <span className="ml-2 text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Days {phase.start}-{phase.end}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
