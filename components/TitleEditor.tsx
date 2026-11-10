'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useDocument, useEditDocument } from '@sanity/sdk-react'

// Only writes when the user presses Save. Nothing is edited automatically.
export default function TitleEditor({
  documentId,
  documentType,
}: {
  documentId: string
  documentType: string
}) {
  // Loading and error states surface through Suspense / error boundaries in sdk-react 3.12.
  const { data } = useDocument<{ title?: string | null }>({
    documentId,
    documentType,
  })
  const editTitle = useEditDocument<string>({ documentId, documentType, path: 'title' })
  const [draft, setDraft] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const value = draft ?? data?.title ?? ''

  return (
    <section>
      <h2>
        Editing <code>{documentId}</code>
      </h2>
      <label>
        Title{' '}
        <input value={value} onChange={(e) => setDraft(e.target.value)} />
      </label>{' '}
      <Link
        href={`/studio/intent/edit/id=${encodeURIComponent(documentId)};type=${encodeURIComponent(documentType)}`}
      >
        Open in Studio
      </Link>{' '}
      <button
        type="button"
        onClick={async () => {
          setStatus('Saving…')
          try {
            const result = await editTitle(value)
            setStatus(`Saved (${result?.transactionId ?? 'ok'})`)
            setDraft(null)
          } catch (e) {
            setStatus(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`)
          }
        }}
      >
        Save
      </button>
      {status ? <p>{status}</p> : null}
    </section>
  )
}
