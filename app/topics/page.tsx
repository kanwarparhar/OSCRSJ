import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Browse by Topic — OSCRSJ' }

const topics = [
  { slug: 'trauma', name: 'Trauma & Fractures', desc: 'Fracture management, polytrauma, periprosthetic fractures, nonunions, malunions, and complex reconstruction cases.' },
  { slug: 'sports', name: 'Sports Medicine', desc: 'Arthroscopic surgery, ligament reconstruction, meniscal repair, rotator cuff injuries, and sports-related cartilage pathology.' },
  { slug: 'spine', name: 'Spine', desc: 'Degenerative disc disease, spinal deformity, spinal cord injury, minimally invasive spine surgery, and cervical and lumbar pathology.' },
  { slug: 'arthroplasty', name: 'Arthroplasty', desc: 'Total joint replacement, revision arthroplasty, periprosthetic infection, bearing surface failures, and implant-related complications.' },
  { slug: 'pediatrics', name: 'Pediatric Orthopedics', desc: 'Congenital deformities, growth plate injuries, developmental dysplasia, scoliosis in children, and limb length discrepancies.' },
  { slug: 'hand', name: 'Hand & Wrist', desc: 'Tendon injuries, carpal instability, nerve compression syndromes, replantation, and complex hand trauma.' },
  { slug: 'foot-ankle', name: 'Foot & Ankle', desc: 'Ankle fractures, Achilles tendon pathology, flatfoot reconstruction, Charcot arthropathy, and forefoot deformity correction.' },
  { slug: 'tumor', name: 'Tumor & Oncology', desc: 'Primary bone tumors, soft tissue sarcomas, metastatic bone disease, limb salvage procedures, and rare musculoskeletal neoplasms.' },
]

export default function TopicsPage() {
  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-normal text-brown-dark">Browse by Topic</h1>
        <p className="text-tan mt-2 text-lg">
          Explore case reports and series across all orthopedic subspecialties
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {topics.map((topic) => (
          <Link
            key={topic.slug}
            href={`/topics/${topic.slug}`}
            className="group bg-cream border border-border rounded-xl p-5 hover:border-peach/40 hover:shadow-sm transition-all"
          >
            <h2 className="font-serif text-lg font-normal text-brown-dark group-hover:text-brown transition-colors mb-2">
              {topic.name}
            </h2>
            <p className="text-sm text-tan leading-relaxed">
              {topic.desc}
            </p>
            <span className="inline-block mt-3 text-xs font-medium text-brown">
              View articles &rarr;
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-12 flex flex-col sm:flex-row gap-3">
        <Link href="/articles" className="btn-primary">Browse All Articles</Link>
        <Link href="/submit" className="btn-outline">Submit a Manuscript</Link>
      </div>
    </div>
  )
}
