import ClientRoot from '@/components/ClientRoot'
import ForceRefresh from '@/components/ForceRefresh'
import ProofPanel from '@/components/ProofPanel'
import { fetchSanityUserId } from '@/lib/sanity-user'
import { getSession, sessionIsComplete } from '@/lib/session'

export default async function Home() {
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
