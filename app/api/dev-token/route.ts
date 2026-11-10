import { connection, NextResponse } from 'next/server'

// TEMPORARY (Phase 1). Returns a personal dev token to the browser so the SDK
// can be exercised before OAuth exists. Disabled in production builds.
// Remove this file once the OAuth flow is verified.
export async function GET() {
  // Force per-request evaluation so the token is never read or cached at build time.
  await connection()

  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  const accessToken = process.env.SANITY_DEV_TOKEN
  if (!accessToken) {
    return NextResponse.json({ error: 'SANITY_DEV_TOKEN is not set' }, { status: 500 })
  }

  return NextResponse.json(
    { accessToken, expiresAt: null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
