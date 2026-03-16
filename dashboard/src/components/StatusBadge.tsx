interface StatusBadgeProps {
  label: string
  variant:
    | 'blue'
    | 'green'
    | 'yellow'
    | 'red'
    | 'purple'
    | 'gray'
    | 'pink'
    | 'orange'
}

const variantStyles: Record<StatusBadgeProps['variant'], { background: string; color: string }> = {
  blue: { background: 'var(--blue-dim)', color: 'var(--blue)' },
  green: { background: 'var(--accent-dim)', color: 'var(--accent)' },
  yellow: { background: 'var(--amber-dim)', color: 'var(--amber)' },
  red: { background: 'var(--red-dim)', color: 'var(--red)' },
  purple: { background: 'rgba(167, 139, 250, 0.12)', color: '#A78BFA' },
  gray: { background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)' },
  pink: { background: 'rgba(244, 114, 182, 0.12)', color: '#F472B6' },
  orange: { background: 'rgba(251, 146, 60, 0.12)', color: '#FB923C' },
}

// Mapping for patient lead statuses
const statusVariantMap: Record<string, StatusBadgeProps['variant']> = {
  new: 'blue',
  contacted: 'yellow',
  nurturing: 'purple',
  booked: 'green',
  inactive: 'gray',
}

// Mapping for appointment statuses
const appointmentVariantMap: Record<string, StatusBadgeProps['variant']> = {
  scheduled: 'blue',
  confirmed: 'green',
  completed: 'gray',
  no_show: 'red',
  cancelled: 'orange',
}

// Mapping for service categories
const serviceVariantMap: Record<string, StatusBadgeProps['variant']> = {
  Preventive: 'green',
  Restorative: 'blue',
  Cosmetic: 'pink',
  Emergency: 'red',
  Surgical: 'orange',
}

export function getStatusVariant(status: string): StatusBadgeProps['variant'] {
  return statusVariantMap[status] ?? 'gray'
}

export function getAppointmentVariant(status: string): StatusBadgeProps['variant'] {
  return appointmentVariantMap[status] ?? 'gray'
}

export function getServiceVariant(category: string): StatusBadgeProps['variant'] {
  return serviceVariantMap[category] ?? 'gray'
}

function StatusBadge({ label, variant }: StatusBadgeProps) {
  const style = variantStyles[variant]
  return (
    <span
      className="badge"
      style={{ background: style.background, color: style.color }}
    >
      {label}
    </span>
  )
}

export default StatusBadge
