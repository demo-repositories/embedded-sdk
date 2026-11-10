'use client'

import Link from 'next/link'
import { useQuery } from '@sanity/sdk-react'

export interface DocRow {
  _id: string
  _type: string
  title?: string | null
}

const QUERY = `*[!(_id in path("_.**"))] | order(_updatedAt desc)[0...10]{_id, _type, title}`

export default function DocList({ onSelect }: { onSelect: (doc: DocRow) => void }) {
  // Query failures throw to the nearest error boundary (no `error` field in sdk-react 3.12).
  const { data, isPending } = useQuery<DocRow[]>({ query: QUERY })

  if (isPending) return <p>Loading documents…</p>
  if (!data || data.length === 0) return <p>No documents found.</p>

  return (
    <ul>
      {data.map((doc) => (
        <li key={doc._id}>
          <code>{doc._type}</code> {doc.title ?? <em>(no title)</em>}{' '}
          <button type="button" onClick={() => onSelect(doc)}>
            Edit title
          </button>{' '}
          <Link
            href={`/studio/intent/edit/id=${encodeURIComponent(doc._id)};type=${encodeURIComponent(doc._type)}`}
          >
            Open in Studio
          </Link>
        </li>
      ))}
    </ul>
  )
}
