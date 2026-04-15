export default function ImagingIcon({ className = 'w-6 h-6' }: { className?: string }) {
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
      {/* Stylized radiograph: film frame with long-bone silhouette */}
      <rect x="3.5" y="3" width="17" height="18" rx="1.5" />
      <path d="M9.5 4.5 L9.5 7 C9.5 7.8 9 8.2 8.5 8.8 L8.5 15 C8.5 15.9 9 16.3 9.5 17 L9.5 19.5" />
      <path d="M14.5 4.5 L14.5 7 C14.5 7.8 15 8.2 15.5 8.8 L15.5 15 C15.5 15.9 15 16.3 14.5 17 L14.5 19.5" />
      <line x1="7.5" y1="11.9" x2="16.5" y2="11.9" />
    </svg>
  )
}
