import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AI_ORTHO_CATEGORIES,
  AI_ORTHO_PRIMER,
  getBriefsByCategory,
  getLatestBriefs,
  getCategory,
} from '@/lib/ai-ortho/data'

export const metadata: Metadata = {
  title: 'AI in Orthopedics',
  description:
    'OSCRSJ\u2019s curated hub on artificial intelligence in orthopedic surgery: AI imaging, surgical planning, robotics, outcomes prediction, LLMs, and research tools.',
  keywords: [
    'AI in orthopedics',
    'artificial intelligence orthopedic surgery',
    'machine learning orthopedics',
    'deep learning fracture detection',
    'ChatGPT orthopedic residents',
    'robotic surgery orthopedics',
  ],
  alternates: { canonical: 'https://oscrsj.com/news/ai-in-orthopedics' },
  openGraph: {
    title: 'AI in Orthopedics | OSCRSJ',
    description:
      'Curated research, tools, and guidance for orthopedic trainees and surgeons.',
    url: 'https://oscrsj.com/news/ai-in-orthopedics',
    type: 'website',
  },
}

const EDITORS_PICKS = [
  {
    label: 'Primer',
    title: 'AI in Orthopedic Imaging: A 2026 Primer for Residents',
    href: '#',
    summary:
      'Definitions, landscape, what is in clinical use versus research, and key sources. A reference piece written in institutional voice.',
  },
  {
    label: 'Guide',
    title: 'Large Language Models for Orthopedic Trainees: What\u2019s Safe, What\u2019s Not',
    href: '#',
    summary:
      'Ethical and practical guidance on LLM use for research, patient-facing tasks, studying, and writing. Cites ICMJE, WAME, and AAOS positions.',
  },
  {
    label: 'Reference',
    title: 'AI in Orthopedics Glossary',
    href: '#',
    summary:
      'Thirty-plus terms defined in plain language: CNN, transformer, sensitivity, specificity, generalizability, prompt, hallucination, PACS, DICOM, and more.',
  },
]

export default function AiInOrthopedicsLanding() {
  const latest = getLatestBriefs(10)

  return (
    <div>
      {/* Hero */}
      <section
        className="relative"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, var(--brown) 0%, var(--dark) 70%)',
        }}
      >
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <span
              className="uppercase font-medium mb-3 block text-peach/60"
              style={{ fontSize: '11px', letterSpacing: '0.12em' }}
            >
              News &middot; Featured Hub
            </span>
            <h1
              className="font-serif text-peach font-normal mb-4"
              style={{ fontSize: 'clamp(36px, 5vw, 52px)', letterSpacing: '-0.02em', lineHeight: 1.1 }}
            >
              AI in Orthopedics
            </h1>
            <p className="text-peach/70 text-base max-w-xl leading-relaxed">
              Curated research, tools, and guidance for orthopedic trainees and surgeons. Peer-reviewed sources, honest limitations, plain language.
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="relative aspect-[3/2] rounded-xl overflow-hidden bg-dark-card border border-peach/15">
              {/* Placeholder slot. When Kanwar drops the Canva export at
                  /public/images/ai-in-ortho-hero.png, uncomment the Image. */}
              {/* <Image
                src="/images/ai-in-ortho-hero.png"
                alt="AI in Orthopedics — editorial collage"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 480px"
                className="object-cover"
              /> */}
              <div className="absolute inset-0 flex items-center justify-center text-peach/30 text-xs uppercase tracking-widest">
                Hero image pending
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Primer */}
      <section className="bg-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="section-label">What Is This Hub?</span>
          <h2 className="section-heading mb-5">What is AI in Orthopedics?</h2>
          <p className="text-brown-dark leading-relaxed">{AI_ORTHO_PRIMER}</p>
        </div>
      </section>

      {/* Category cards */}
      <section className="bg-cream-alt">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="mb-8">
            <span className="section-label">Browse</span>
            <h2 className="section-heading">Six Categories</h2>
            <p className="text-tan text-sm max-w-xl mt-2">
              Every brief slots into one of six categories. Established to give the hub stable structure and clear topical authority.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {AI_ORTHO_CATEGORIES.map((c) => {
              const Icon = c.Icon
              const count = getBriefsByCategory(c.slug).length
              return (
                <Link
                  key={c.slug}
                  href={`/news/ai-in-orthopedics/${c.slug}`}
                  className="bg-white border border-border rounded-xl p-6 hover:border-tan hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-brown inline-flex items-center justify-center w-10 h-10 rounded-lg bg-cream-alt border border-border">
                      <Icon />
                    </span>
                    <span className="text-xs text-tan">
                      {count === 0 ? 'Coming soon' : `${count} brief${count === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <h3 className="font-serif text-lg text-brown-dark leading-snug mb-2">
                    {c.label}
                  </h3>
                  <p className="text-sm text-brown-dark/80 leading-relaxed">
                    {c.description}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Latest briefs */}
      <section className="bg-cream">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
            <div>
              <span className="section-label">Latest</span>
              <h2 className="section-heading">Recent Briefs</h2>
              <p className="text-tan text-sm max-w-xl mt-2">
                Reverse-chronological feed across all six categories. Each brief links to the primary source.
              </p>
            </div>
          </div>
          {latest.length === 0 ? (
            <div className="bg-white border border-border rounded-xl p-10 text-center">
              <p className="text-brown-dark text-base font-medium mb-1">The inaugural slate of briefs is in production.</p>
              <p className="text-tan text-sm">Ten curated summaries across all six categories publish in the next editorial cycle.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {latest.map((b) => {
                const cat = getCategory(b.category)
                return (
                  <Link
                    key={b.slug}
                    href={`/news/ai-in-orthopedics/${b.category}/${b.slug}`}
                    className="bg-white border border-border rounded-xl p-6 hover:border-tan hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-medium text-brown bg-tan/20 px-3 py-1 rounded-full">
                        {cat?.short ?? 'AI'}
                      </span>
                      <span className="text-xs text-tan">{b.readMinutes} min read</span>
                    </div>
                    <h3 className="font-serif text-lg text-brown-dark leading-snug mb-2">{b.headline}</h3>
                    <p className="text-sm text-brown-dark/80 leading-relaxed mb-3">{b.summary}</p>
                    <p className="text-xs text-tan">
                      {b.source.journal} &middot;{' '}
                      {new Date(b.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Editor's Picks */}
      <section className="bg-cream-alt">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="mb-8">
            <span className="section-label">Editor&rsquo;s Picks</span>
            <h2 className="section-heading">Start Here</h2>
            <p className="text-tan text-sm max-w-xl mt-2">
              Evergreen reference pieces written by OSCRSJ in institutional voice. These are our GEO anchors.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {EDITORS_PICKS.map((p) => (
              <Link
                key={p.title}
                href={p.href}
                className="bg-white border border-border rounded-xl p-6 hover:border-tan hover:shadow-sm transition-all"
              >
                <span className="text-xs font-medium text-brown bg-peach/40 px-3 py-1 rounded-full inline-block mb-3">
                  {p.label}
                </span>
                <h3 className="font-serif text-lg text-brown-dark leading-snug mb-2">{p.title}</h3>
                <p className="text-sm text-brown-dark/80 leading-relaxed">{p.summary}</p>
                <p className="text-xs text-tan mt-3">Coming soon</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Glossary (empty accordion placeholder) */}
      {/* TODO: Arjun to populate 20 glossary terms at launch per Page Plan §1 / §8.
          Terms slated: CNN, transformer, sensitivity, specificity, PPV, NPV,
          generalizability, prompt, hallucination, PACS, DICOM, ROC / AUC,
          overfitting, training/validation/test, federated learning, RAG,
          foundation model, and related. Render as <details>/<summary>
          accordion once content is ready. */}
      <section className="bg-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <span className="section-label">Reference</span>
          <h2 className="section-heading mb-5">AI in Orthopedics Glossary</h2>
          <p className="text-brown-dark leading-relaxed mb-4">
            A living reference of core terms. Twenty definitions at launch, growing to forty over the first quarter.
          </p>
          <div className="bg-white border border-border rounded-xl p-6 text-center">
            <p className="text-sm text-brown-dark">The glossary publishes alongside the inaugural slate of briefs.</p>
          </div>
        </div>
      </section>

      {/* For Residents callout */}
      <section className="bg-cream-alt">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white border border-border rounded-2xl p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <span className="section-label">For Residents</span>
              <h3 className="font-serif text-2xl text-brown-dark leading-snug mb-2">Built for orthopedic trainees.</h3>
              <p className="text-sm text-brown-dark/80 leading-relaxed max-w-2xl">
                Every brief is framed for a resident reader. No hype, no marketing, just what the research says and what it does not. The full For Students hub collects additional resources.
              </p>
            </div>
            <Link href="#" className="btn-primary-light whitespace-nowrap">
              For Students hub
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter + Submit CTAs */}
      <section className="bg-cream">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-border rounded-2xl p-8">
            <span className="section-label">Newsletter</span>
            <h3 className="font-serif text-xl text-brown-dark mb-2">AI in Ortho Monthly</h3>
            <p className="text-sm text-brown-dark/80 leading-relaxed mb-5">
              One email, first of the month. New briefs, the Study of the Month, and a short editor\u2019s note.
            </p>
            <Link href="/subscribe" className="btn-primary-light">
              Subscribe
            </Link>
          </div>
          <div className="bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
            <span className="section-label">For Authors</span>
            <h3 className="font-serif text-xl text-brown-dark mb-2">Publishing AI research in orthopedics?</h3>
            <p className="text-sm text-brown-dark/80 leading-relaxed mb-5">
              OSCRSJ accepts case reports and series on novel AI-assisted diagnoses and surgical planning. Free to publish in 2026.
            </p>
            <Link href="/submit" className="btn-primary-light">
              Submit a manuscript
            </Link>
          </div>
        </div>
      </section>

      {/* Methodology + disclaimer */}
      <section className="bg-cream-alt border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
          <div>
            <span className="section-label">Methodology</span>
            <h3 className="font-serif text-xl text-brown-dark mb-3">How we select and summarize</h3>
            <p className="text-sm text-brown-dark/85 leading-relaxed">
              Briefs are drawn exclusively from peer-reviewed orthopedic journals (JBJS, JAAOS, Arthroscopy, Spine Deformity, Journal of Experimental Orthopaedics, BMC journals, and specialty-society publications) and from AAOS and related society communications. We do not cite EurekAlert, ScienceDaily, or generalist aggregators. Every brief links to the primary source and attributes authorship visibly. Summaries are two to three sentences and never verbatim. We report effect sizes honestly and include a limitations section on every brief. That transparency is our differentiator from tech-blog coverage. We do not reproduce figures from paywalled sources.
            </p>
          </div>
          <div>
            <span className="section-label">Disclaimer</span>
            <p className="text-xs text-tan leading-relaxed">
              OSCRSJ News items are editorial summaries for educational purposes. They are not clinical recommendations, endorsements, or substitutes for the primary literature. Always consult the source paper and applicable specialty-society guidelines before changing practice.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
