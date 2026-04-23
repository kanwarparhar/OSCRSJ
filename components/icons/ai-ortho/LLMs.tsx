export default function LLMsIcon({ className = 'w-6 h-6' }: { className?: string }) {
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
      {/* Speech bubble with cursor inside */}
      <path d="M4 5 L20 5 C20.6 5 21 5.4 21 6 L21 15 C21 15.6 20.6 16 20 16 L11 16 L7 20 L7 16 L4 16 C3.4 16 3 15.6 3 15 L3 6 C3 5.4 3.4 5 4 5 Z" />
      <path d="M10 9.5 L12 13 L12.8 11.2 L14.5 10.4 Z" />
      <line x1="12.8" y1="11.2" x2="15" y2="13.5" />
    </svg>
  )
}
