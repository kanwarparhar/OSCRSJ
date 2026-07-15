import Link from 'next/link'

interface Props {
  currentPage: number
  totalPages: number
  totalRows: number
  pageSize: number
  // Builds the href for a given page number. Owner controls
  // which other query params get preserved (tab=, etc.).
  hrefForPage: (page: number) => string
}

export default function RosterPagination({
  currentPage,
  totalPages,
  totalRows,
  pageSize,
  hrefForPage,
}: Props) {
  if (totalPages <= 1) return null

  const startIdx = (currentPage - 1) * pageSize + 1
  const endIdx = Math.min(currentPage * pageSize, totalRows)
  const prevDisabled = currentPage <= 1
  const nextDisabled = currentPage >= totalPages

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mt-4 text-xs text-brown">
      <p>
        Showing <span className="text-ink font-medium">{startIdx}</span>–
        <span className="text-ink font-medium">{endIdx}</span> of{' '}
        <span className="text-ink font-medium">{totalRows}</span>
      </p>
      <div className="flex items-center gap-2">
        {prevDisabled ? (
          <span className="px-3 py-1.5 border border-border rounded-md text-brown/40 cursor-not-allowed select-none">
            ← Prev
          </span>
        ) : (
          <Link
            href={hrefForPage(currentPage - 1)}
            className="px-3 py-1.5 border border-border rounded-md text-ink bg-white hover:border-tan"
          >
            ← Prev
          </Link>
        )}
        <span className="px-3 py-1.5 text-brown">
          Page <span className="text-ink font-medium">{currentPage}</span> of{' '}
          <span className="text-ink font-medium">{totalPages}</span>
        </span>
        {nextDisabled ? (
          <span className="px-3 py-1.5 border border-border rounded-md text-brown/40 cursor-not-allowed select-none">
            Next →
          </span>
        ) : (
          <Link
            href={hrefForPage(currentPage + 1)}
            className="px-3 py-1.5 border border-border rounded-md text-ink bg-white hover:border-tan"
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  )
}
