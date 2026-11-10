import { NextRequest, NextResponse } from 'next/server'
import { OAuthRequestError, refreshTokens } from '@/lib/oauth'
import { getSession, sessionIsComplete } from '@/lib/session'
import { serverEnv } from '@/lib/env'

const noStore = { 'Cache-Control': 'no-store' }

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore })
}

/**
 * The browser's only way to get an access token. Returns the current token from
 * the session, refreshing it first once it is inside the refresh window
 * (SANITY_TOKEN_REFRESH_WINDOW_SECONDS before expiry).
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!sessionIsComplete(session)) return unauthorized()

  // Dev checkpoint: pretend the access token is inside the refresh window.
  const forceRefresh =
    process.env.NODE_ENV !== 'production' && request.nextUrl.searchParams.get('forceRefresh') === '1'
  const refreshAt = session.expiresAt - serverEnv.refreshWindowSeconds * 1000
  const shouldRefresh = forceRefresh || Date.now() >= refreshAt

  if (shouldRefresh) {
    try {
      const next = await refreshTokens(session.refreshToken)
      session.accessToken = next.accessToken
      session.refreshToken = next.refreshToken
      session.expiresAt = next.expiresAt
      await session.save()
    } catch (error) {
      // A 4xx (other than timeout or rate limit) means the refresh token is no longer
      // valid, so the session is dropped and the client sends the user to sign in.
      // Network errors and 5xx are treated as temporary and keep the session.
      const status = error instanceof OAuthRequestError ? error.status : 0
      const unrecoverable = status >= 400 && status < 500 && status !== 408 && status !== 429
      if (unrecoverable) {
        session.destroy()
        return unauthorized()
      }
      return NextResponse.json({ error: 'refresh failed' }, { status: 503, headers: noStore })
    }
  }

  return NextResponse.json(
    { accessToken: session.accessToken, expiresAt: session.expiresAt },
    { headers: noStore },
  )
}
