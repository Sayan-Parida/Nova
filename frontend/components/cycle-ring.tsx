interface CycleRingProps {
  currentDay: number
  cycleLength: number
}

export function CycleRing({ currentDay, cycleLength }: CycleRingProps) {
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const progress = (currentDay / cycleLength) * 100
  const strokeDashoffset = circumference - (progress / 100) * circumference

  // Determine phase color
  let phaseColor = '#a89bc4' // purple for luteal
  if (currentDay < 14) {
    phaseColor = '#f5f5f5' // light for follicular
  } else if (currentDay >= 12 && currentDay <= 16) {
    phaseColor = '#d4949f' // rose for fertile
  } else if (currentDay > 24) {
    phaseColor = '#2a2a2a' // dark for menstrual
  }

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
          stroke={phaseColor}
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
          fill="rgba(212, 148, 159, 0.1)"
          stroke={phaseColor}
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
