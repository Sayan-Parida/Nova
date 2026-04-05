interface CycleRingProps {
  currentDay: number
  cycleLength: number
}

export function CycleRing({ currentDay, cycleLength }: CycleRingProps) {
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const progress = (currentDay / cycleLength) * 100
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="240" height="240" className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="120"
          cy="120"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted"
          opacity="0.3"
        />

        {/* Progress circle */}
        <circle
          cx="120"
          cy="120"
          r={radius}
          fill="none"
          stroke="#ffffffcc"
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* Center circle with day number */}
        <circle
          cx="120"
          cy="120"
          r="50"
          fill="rgba(255, 255, 255, 0.06)"
          stroke="#ffffff33"
          strokeWidth="1"
          opacity="0.5"
        />
      </svg>

      {/* Center content */}
      <div className="absolute flex flex-col items-center justify-center space-y-1">
        <div className="text-5xl font-light text-foreground">{currentDay}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Day</div>
      </div>
    </div>
  )
}
