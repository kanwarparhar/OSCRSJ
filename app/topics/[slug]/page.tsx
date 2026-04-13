import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

const topicData: Record<string, { name: string; desc: string }> = {
  trauma: {
    name: 'Trauma & Fractures',
    desc: 'Case reports and series involving fracture management, polytrauma, periprosthetic fractures, nonunions, malunions, open fractures, and complex musculoskeletal reconstruction. Trauma remains the most common reason patients present to orthopedic surgeons, making this literature essential for surgical education.',
  },
  sports: {
    name: 'Sports Medicine',
    desc: 'Case reports and series in arthroscopic surgery, ligament reconstruction (ACL, PCL, MPFL), meniscal repair and transplantation, rotator cuff surgery, labral repairs, cartilage restoration, and return-to-play decision-making. Sports medicine continues to evolve rapidly with new techniques and biologics.',
  },
  spine: {
    name: 'Spine',
    desc: 'Case reports and series in cervical, thoracic, and lumbar spine pathology including degenerative disc disease, spinal stenosis, spondylolisthesis, spinal deformity correction, minimally invasive approaches, spinal cord injury, and adjacent segment disease.',
  },
  arthroplasty: {
    name: 'Arthroplasty',
    desc: 'Case reports and series in total hip, knee, shoulder, and ankle arthroplasty, including primary and revision procedures, periprosthetic joint infection, implant failure, bearing surface complications, instability, and novel surgical approaches to complex reconstruction.',
  },
  pediatrics: {
    name: 'Pediatric Orthopedics',
    desc: 'Case reports and series involving congenital and developmental musculoskeletal conditions, growth plate injuries, developmental dysplasia of the hip, clubfoot, pediatric fractures, limb length discrepancies, scoliosis, and neuromuscular disorders in children.',
  },
  hand: {
    name: 'Hand & Wrist',
    desc: 'Case reports and series in tendon repair and reconstruction, carpal instability, distal radius fractures, scaphoid pathology, nerve compression syndromes (carpal tunnel, cubital tunnel), replantation, Dupuytren contracture, and complex hand trauma.',
  },
  'foot-ankle': {
    name: 'Foot & Ankle',
    desc: 'Case reports and series involving ankle fractures and instability, Achilles tendon rupture and tendinopathy, flatfoot reconstruction, Charcot neuroarthropathy, hallux valgus, midfoot injuries (Lisfranc), and total ankle arthroplasty.',
  },
  tumor: {
    name: 'Tumor & Oncology',
    desc: 'Case reports and series in primary bone tumors (osteosarcoma, Ewing sarcoma, giant cell tumor), soft tissue sarcomas, metastatic bone disease, pathologic fractures, limb salvage surgery, endoprosthetic reconstruction, and rare musculoskeletal neoplasms.',
  },
}

export function generateStaticParams() {
  return Object.keys(topicData).map((slug) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const topic = topicData[params.slug]
  return { title: topic ? `${topic.name} — OSCRSJ` : 'Topic Not Found' }
}

export default function TopicPage({ params }: { params: { slug: string } }) {
  const topic = topicData[params.slug]
  if (!topic) notFound()

  return (
    <div>
      <PageHeader
        label="Topics"
        title={topic.name}
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-4">
          <Link href="/topics" className="text-sm text-brown hover:text-brown transition-colors font-medium">
            &larr; All Topics
          </Link>
        </div>

        <section className="mb-12 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
          <span className="section-label">Overview</span>
          <h2 className="section-heading mb-3">About This Topic</h2>
          <p className="text-brown-dark leading-relaxed">
            {topic.desc}
          </p>
        </section>

        <section className="mb-12 bg-cream-alt border border-border rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">📝</div>
          <h2 className="section-heading mb-3">Articles Coming Soon</h2>
          <p className="text-brown-dark leading-relaxed max-w-lg mx-auto">
            We are currently accepting submissions in {topic.name.toLowerCase()}. Published articles in this subspecialty will appear here as they are peer-reviewed and accepted.
          </p>
        </section>

        <section className="mb-12">
          <span className="section-label">Contribute</span>
          <h2 className="section-heading mb-3">Submit Your Case</h2>
          <p className="text-brown-dark leading-relaxed mb-4">
            Have a compelling case in {topic.name.toLowerCase()}? OSCRSJ welcomes case reports and case series from medical students, residents, fellows, and attending surgeons. APCs are waived through the end of 2026.
          </p>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/submit" className="btn-primary-light">Submit a Manuscript</Link>
          <Link href="/guide-for-authors" className="btn-outline">Guide for Authors</Link>
          <Link href="/topics" className="btn-ghost">All Topics</Link>
        </div>
      </div>
    </div>
  )
}
