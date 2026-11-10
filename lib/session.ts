import 'server-only'

import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME } from '@/lib/cookie-names'
import { serverEnv } from '@/lib/env'

export interface SessionData {
  accessToken: string
  refreshToken: string
  /** Access-token expiry, as milliseconds since the epoch. */
  expiresAt: number
  sanityUserId: string
}

export function sessionOptions(): SessionOptions {
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: serverEnv.sessionSecret,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
    // Access and refresh tokens plus the seal can exceed one browser cookie.
    chunk: true,
  }
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions())
}

export function sessionIsComplete(session: Partial<SessionData>): session is SessionData {
  return (
    typeof session.accessToken === 'string' &&
    session.accessToken.length > 0 &&
    typeof session.refreshToken === 'string' &&
    session.refreshToken.length > 0 &&
    typeof session.expiresAt === 'number' &&
    Number.isFinite(session.expiresAt) &&
    typeof session.sanityUserId === 'string' &&
    session.sanityUserId.length > 0
  )
}
