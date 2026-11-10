import Link from 'next/link'
import { Suspense } from 'react'
import ClientRoot from '@/components/ClientRoot'
import ForceRefresh from '@/components/ForceRefresh'
import ProofPanel from '@/components/ProofPanel'
import { fetchSanityUserId } from '@/lib/sanity-user'
import { getSession, sessionIsComplete } from '@/lib/session'

// With Cache Components, reading cookies() must happen behind a Suspense boundary.
export default function Home() {
  return (
    <Suspense fallback={<main style={{ fontFamily: 'sans-serif', padding: '1.5rem' }}>Loading…</main>}>
      <HomeContent />
    </Suspense>
  )
}

/**
 * Reads the encrypted session cookie; with a valid session it renders the
 * SDK-powered panel, which gets its access token from the token route.
 */
async function HomeContent() {
  const session = await getSession()
  if (!sessionIsComplete(session)) {
    return (
      <main style={{ fontFamily: 'sans-serif', padding: '1.5rem' }}>
        <h1>Sanity SDK app</h1>
        <p>
          <a href="/api/auth/sanity/login?returnTo=/">Sign in with Sanity</a>
        </p>
      </main>
    )
  }

  let sanityUserId: string
  try {
    sanityUserId = await fetchSanityUserId(session.accessToken)
  } catch (error) {
    return (
      <main style={{ fontFamily: 'sans-serif', padding: '1.5rem' }}>
        <h1>Signed in, but your user could not be read</h1>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
        <form action="/api/auth/sanity/logout" method="post">
          <button type="submit">Log out</button>
        </form>
      </main>
    )
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '1.5rem' }}>
      <h1>Signed in</h1>
      <p>
        sanityUserId: <code>{sanityUserId}</code>
      </p>
      <p>
        <Link href="/studio">Open Studio</Link>
      </p>
      <form action="/api/auth/sanity/logout" method="post">
        <button type="submit">Log out</button>
      </form>
      <ForceRefresh />
      <ClientRoot tokenUrl="/api/auth/sanity/token" rotate>
        <ProofPanel />
      </ClientRoot>
    </main>
  )
}
