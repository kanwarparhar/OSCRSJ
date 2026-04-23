export default function RoboticsIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Articulating robotic arm: base, two segments, end effector */}
      <rect x="3" y="18" width="8" height="3" rx="0.5" />
      <circle cx="7" cy="14.5" r="1.5" />
      <path d="M7 14.5 L13 9" />
      <circle cx="13" cy="9" r="1.5" />
      <path d="M13 9 L18 5.5" />
      <path d="M18 5.5 L20 4" />
      <path d="M18 5.5 L20.5 6.5" />
    </svg>
  )
}
