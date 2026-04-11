import Link from 'next/link'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  href?: string
}

export default function Logo({ size = 'md', showTagline = true, href = '/' }: LogoProps) {
  const letterSizes = {
    sm: 'text-2xl',
    md: 'text-3xl sm:text-4xl',
    lg: 'text-5xl',
  }

  const taglineSizes = {
    sm: 'text-[9px] tracking-[0.14em]',
    md: 'text-[10px] tracking-[0.16em]',
    lg: 'text-xs tracking-[0.18em]',
  }

  const content = (
    <span className="group flex flex-col items-center gap-1">
      {/* Wordmark */}
      <span
        className={`font-serif font-semibold leading-none select-none ${letterSizes[size]}`}
        style={{ letterSpacing: '-0.025em' }}
      >
        <span className="text-coral group-hover:text-coral-dark transition-colors duration-200">O</span>
        <span className="text-charcoal group-hover:text-charcoal transition-colors duration-200">SCRSJ</span>
      </span>

      {/* Thin rule */}
      <span className="block w-full h-px bg-coral/30 group-hover:bg-coral/50 transition-colors duration-200" />

      {/* Tagline */}
      {showTagline && (
        <span
          className={`text-charcoal-light uppercase font-medium tracking-widest ${taglineSizes[size]}`}
        >
          Open Access · DOI Registered
        </span>
      )}
    </span>
  )

  if (href) {
    return (
      <Link href={href} aria-label="OSCRSJ — Orthopedic Surgery Case Reports & Series Journal">
        {content}
      </Link>
    )
  }

  return <span aria-label="OSCRSJ — Orthopedic Surgery Case Reports & Series Journal">{content}</span>
}
