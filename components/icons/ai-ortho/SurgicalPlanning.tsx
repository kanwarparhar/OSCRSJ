export default function SurgicalPlanningIcon({ className = 'w-6 h-6' }: { className?: string }) {
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
      {/* 3D mesh cube suggestion */}
      <path d="M12 3 L20.5 7.5 L20.5 16.5 L12 21 L3.5 16.5 L3.5 7.5 Z" />
      <path d="M12 3 L12 21" />
      <path d="M3.5 7.5 L20.5 16.5" />
      <path d="M20.5 7.5 L3.5 16.5" />
    </svg>
  )
}
