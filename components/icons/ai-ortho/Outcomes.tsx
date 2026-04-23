export default function OutcomesIcon({ className = 'w-6 h-6' }: { className?: string }) {
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
      {/* Trend line with axes and data points */}
      <path d="M4 4 L4 20 L20 20" />
      <path d="M4 16 L9 12 L13 14 L20 6" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="20" cy="6" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
