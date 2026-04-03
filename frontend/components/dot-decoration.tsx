export function DotDecoration() {
  return (
    <svg
      className="w-full h-full"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Large faint circle background patterns */}
      <circle
        cx="100"
        cy="150"
        r="120"
        fill="none"
        stroke="url(#fadeGradient1)"
        strokeWidth="1"
        opacity="0.15"
      />
      <circle
        cx="100"
        cy="150"
        r="90"
        fill="none"
        stroke="url(#fadeGradient1)"
        strokeWidth="1"
        opacity="0.12"
      />
      <circle
        cx="100"
        cy="150"
        r="60"
        fill="none"
        stroke="url(#fadeGradient1)"
        strokeWidth="1"
        opacity="0.1"
      />

      {/* Right side decorations */}
      <circle
        cx="1100"
        cy="650"
        r="140"
        fill="none"
        stroke="url(#fadeGradient2)"
        strokeWidth="1"
        opacity="0.12"
      />
      <circle
        cx="1100"
        cy="650"
        r="100"
        fill="none"
        stroke="url(#fadeGradient2)"
        strokeWidth="1"
        opacity="0.1"
      />
      <circle
        cx="1100"
        cy="650"
        r="60"
        fill="none"
        stroke="url(#fadeGradient2)"
        strokeWidth="1"
        opacity="0.08"
      />

      {/* Center subtle dots */}
      <circle cx="600" cy="400" r="2" fill="#d4949f" opacity="0.15" />
      <circle cx="650" cy="350" r="1.5" fill="#a89bc4" opacity="0.12" />
      <circle cx="550" cy="450" r="1" fill="#d4949f" opacity="0.1" />
      <circle cx="700" cy="500" r="2" fill="#a89bc4" opacity="0.08" />
      <circle cx="500" cy="300" r="1" fill="#d4949f" opacity="0.12" />

      {/* Gradient definitions */}
      <defs>
        <linearGradient id="fadeGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4949f" />
          <stop offset="100%" stopColor="#a89bc4" />
        </linearGradient>
        <linearGradient id="fadeGradient2" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#a89bc4" />
          <stop offset="100%" stopColor="#d4949f" />
        </linearGradient>
      </defs>
    </svg>
  )
}
