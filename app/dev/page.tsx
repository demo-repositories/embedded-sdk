import { notFound } from 'next/navigation'
import ClientRoot from '@/components/ClientRoot'
import ProofPanel from '@/components/ProofPanel'

// TEMPORARY (Phase 1) proof page using the dev token. Not reachable in production.
export default function DevPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main>
      <h1>Phase 1: SDK proof (dev token)</h1>
      <ClientRoot tokenUrl="/api/dev-token" rotate={false}>
        <ProofPanel />
      </ClientRoot>
    </main>
  )
}
