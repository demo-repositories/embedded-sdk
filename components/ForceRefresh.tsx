'use client'

import { useState } from 'react'

/** Dev-only checkpoint. Asks the token route to refresh immediately, then tells the SDK. */
export default function ForceRefresh() {
  const [status, setStatus] = useState<string | null>(null)

  if (process.env.NODE_ENV === 'production') return null

  return (
    <p>
      <button
        type="button"
        onClick={async () => {
          setStatus('Refreshing…')
          const response = await fetch('/api/auth/sanity/token?forceRefresh=1', {
            cache: 'no-store',
            credentials: 'same-origin',
          })
          if (!response.ok) {
            setStatus(`Refresh failed (${response.status})`)
            return
          }
          await response.json()
          window.dispatchEvent(new Event('sanity-token-refresh'))
          setStatus('Refresh succeeded')
        }}
      >
        Dev: force token refresh
      </button>{' '}
      {status}
    </p>
  )
}
