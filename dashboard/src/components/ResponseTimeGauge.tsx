interface ResponseTimeGaugeProps {
  percentage: number
}

function ResponseTimeGauge({ percentage }: ResponseTimeGaugeProps) {
  const getColor = (pct: number) => {
    if (pct >= 80) return { stroke: 'var(--accent)', label: 'Excellent' }
    if (pct >= 50) return { stroke: 'var(--amber)', label: 'Good' }
    return { stroke: 'var(--red)', label: 'Needs Improvement' }
  }

  const color = getColor(percentage)

  const size = 120
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const fillPercent = Math.min(Math.max(percentage, 0), 100)
  const strokeDashoffset = circumference - (fillPercent / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color.stroke}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-metric" style={{ fontSize: 28, color: color.stroke }}>
            {Math.round(percentage)}%
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>under 60s</span>
        </div>
      </div>
      <span style={{ marginTop: 8, fontSize: 12, fontWeight: 500, color: color.stroke }}>
        {color.label}
      </span>
    </div>
  )
}

export default ResponseTimeGauge
