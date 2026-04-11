import Link from 'next/link'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  href?: string
  variant?: 'light' | 'dark'
}

export default function Logo({ size = 'md', showTagline = true, href = '/', variant = 'dark' }: LogoProps) {
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

  const accentColor = 'text-peach'
  const mainColor = variant === 'light' ? 'text-peach/80' : 'text-brown-dark'
  const ruleColor = variant === 'light' ? 'bg-peach/30' : 'bg-tan/30'
  const taglineColor = variant === 'light' ? 'text-peach/50' : 'text-tan'

  const content = (
    <span className="group flex flex-col items-center gap-1">
      <span
        className={`font-serif font-normal leading-none select-none ${letterSizes[size]}`}
        style={{ letterSpacing: '-0.025em' }}
      >
        <span className={`${accentColor} transition-colors duration-200`}>O</span>
        <span className={`${mainColor} transition-colors duration-200`}>SCRSJ</span>
      </span>

      <span className={`block w-full h-px ${ruleColor} transition-colors duration-200`} />

      {showTagline && (
        <span className={`${taglineColor} uppercase font-medium tracking-widest ${taglineSizes[size]}`}>
          Open Access &middot; DOI Registered
        </span>
      )}
    </span>
  )

  if (href) {
    return (
      <Link href={href} aria-label="OSCRSJ - Orthopedic Surgery Case Reports & Series Journal">
        {content}
      </Link>
    )
  }

  return <span aria-label="OSCRSJ - Orthopedic Surgery Case Reports & Series Journal">{content}</span>
}
