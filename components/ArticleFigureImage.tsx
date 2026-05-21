'use client'

// Small client island for the homepage article card figure.
// Attempts to load the first figure via the /api/articles/[id]/figure
// proxy route. Falls back to the gradient placeholder if no figure
// exists or if the image fails to load (404 from proxy = no figure).

import { useState } from 'react'

interface ArticleFigureImageProps {
  articleId: string
  title: string
  height: 'tall' | 'short'
}

export default function ArticleFigureImage({
  articleId,
  title,
  height,
}: ArticleFigureImageProps) {
  const [failed, setFailed] = useState(false)
  const heightClass = height === 'tall' ? 'h-48' : 'h-32'

  if (failed) {
    return (
      <div
        className={`w-full rounded-lg mb-4 flex items-center justify-center bg-cream-alt ${heightClass}`}
        style={{ background: 'linear-gradient(135deg, var(--cream-alt) 0%, var(--taupe) 100%)' }}
      >
        <span className="text-ink/50 text-xs uppercase tracking-widest">Figure</span>
      </div>
    )
  }

  return (
    <div className={`w-full rounded-lg mb-4 overflow-hidden bg-cream-alt ${heightClass}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/articles/${articleId}/figure`}
        alt={`Figure from: ${title}`}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
