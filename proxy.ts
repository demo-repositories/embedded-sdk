import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/cookie-names'

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => {
    return cookie.name === SESSION_COOKIE_NAME || cookie.name.startsWith(`${SESSION_COOKIE_NAME}.`)
  })
}

/**
 * Optimistic gate only. Route handlers and the home page still check the session.
 * `/api/*` is excluded so the login and token routes can run without a session.
 */
export function proxy(request: NextRequest) {
  if (hasSessionCookie(request)) return NextResponse.next()
  const login = new URL('/api/auth/sanity/login', request.url)
  const returnTo = request.nextUrl.pathname + request.nextUrl.search
  login.searchParams.set('returnTo', returnTo)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
