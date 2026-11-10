import { getIronSession, webCookies } from 'iron-session'
import { NextRequest, NextResponse } from 'next/server'
import { revokeToken } from '@/lib/oauth'
import { sessionOptions, type SessionData } from '@/lib/session'

/** Revokes the session's token with Sanity, clears the session cookie, and starts a fresh sign-in. */
async function logout(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/api/auth/sanity/login?returnTo=/', request.url))
  const session = await getIronSession<SessionData>(webCookies(request, response), sessionOptions())
  const token = session.refreshToken ?? session.accessToken
  if (token) await revokeToken(token)
  session.destroy()
  return response
}

export function GET(request: NextRequest) {
  return logout(request)
}

export function POST(request: NextRequest) {
  return logout(request)
}
