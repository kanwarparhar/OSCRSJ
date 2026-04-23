export default function ResearchToolsIcon({ className = 'w-6 h-6' }: { className?: string }) {
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
      {/* Document with magnifying glass */}
      <path d="M5 3 L14 3 L18 7 L18 21 L5 21 Z" />
      <path d="M14 3 L14 7 L18 7" />
      <line x1="7.5" y1="11" x2="12" y2="11" />
      <line x1="7.5" y1="14" x2="10" y2="14" />
      <circle cx="14.5" cy="16" r="2.5" />
      <line x1="16.3" y1="17.8" x2="18" y2="19.5" />
    </svg>
  )
}
