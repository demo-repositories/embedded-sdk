'use client'

import dynamic from 'next/dynamic'
import type { SanityProviderProps } from './SanityProvider'

// The SDK touches browser APIs, so it never renders on the server.
const SanityProvider = dynamic(() => import('./SanityProvider'), {
  ssr: false,
  loading: () => <p>Loading…</p>,
})

export default function ClientRoot(props: SanityProviderProps) {
  return <SanityProvider {...props} />
}
