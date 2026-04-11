interface PageHeaderProps {
  label: string
  title: string
  subtitle?: string
}

export default function PageHeader({ label, title, subtitle }: PageHeaderProps) {
  return (
    <section
      className="relative flex items-center justify-center text-center"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, var(--brown) 0%, var(--dark) 70%)',
        minHeight: '280px',
        padding: '80px 24px',
      }}
    >
      <div className="max-w-content mx-auto">
        <span
          className="uppercase font-medium mb-3 block text-peach/60"
          style={{ fontSize: '11px', letterSpacing: '0.12em' }}
        >
          {label}
        </span>
        <h1
          className="font-serif text-peach font-normal mb-1"
          style={{ fontSize: 'clamp(30px, 4vw, 40px)', letterSpacing: '-0.02em' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-peach/60 text-base max-w-xl mx-auto mt-3 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  )
}
