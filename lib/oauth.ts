/**
 * Sanity OAuth, server side. This app is a confidential client using the
 * authorization code flow with PKCE (S256):
 *
 * 1. `beginOauth` generates `state` and a PKCE verifier, seals them into a
 *    short-lived cookie, and redirects the browser to Sanity's authorize URL.
 * 2. Sanity sends the browser back to the callback route with `code` and `state`.
 * 3. The callback checks `state`, then `exchangeCode` trades the code (plus the
 *    verifier and the client secret) for an access token and a refresh token.
 * 4. `refreshTokens` swaps the refresh token for new tokens before expiry.
 *
 * The client secret is only ever sent from this server to Sanity's token and
 * revoke endpoints. It never reaches the browser.
 */
import 'server-only'

import { timingSafeEqual } from 'node:crypto'
import { sealData, unsealData } from 'iron-session'
import { NextResponse, type NextRequest } from 'next/server'
import { OAUTH_TX_COOKIE_NAME } from '@/lib/cookie-names'
import { serverEnv } from '@/lib/env'
import { SANITY_ORG_ID } from '@/lib/public-env'

const TX_TTL_SECONDS = 10 * 60

export class OAuthRequestError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`OAuth request failed (${status})`)
    this.status = status
  }
}

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface OauthTx {
  state: string
  verifier: string
  returnTo: string
}

interface TokenEndpointResponse {
  access_token?: unknown
  expires_in?: unknown
  refresh_token?: unknown
}

/**
 * RFC 8707 resource indicator. Scopes the issued tokens to the organization
 * that owns the project, and is sent on every authorize and token request.
 */
function resourceIndicator(): string {
  return `urn:io.sanity:organization:${SANITY_ORG_ID}`
}

function cookieFlags(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

function randomUrlSafe(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  let binary = ''
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Only a same-origin path. Rejects protocol-relative and absolute URLs so the
 * post-login redirect cannot be used as an open redirect.
 */
export function safeReturnTo(input: string | null): string {
  if (!input) return '/'
  if (!input.startsWith('/') || input.startsWith('//') || input.includes('\\')) return '/'
  if (input.includes('\n') || input.includes('\r')) return '/'
  return input
}

export function authorizeUrl(state: string, challenge: string): string {
  const url = new URL(serverEnv.authorizeUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', serverEnv.clientId)
  url.searchParams.set('redirect_uri', serverEnv.redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('resource', resourceIndicator())
  return url.toString()
}

/**
 * `state` (CSRF protection), the PKCE verifier and `returnTo` are sealed with
 * SESSION_SECRET into an httpOnly cookie, so the callback can verify them
 * without any server-side storage. Only the derived challenge goes to Sanity.
 */
export async function beginOauth(returnTo: string): Promise<NextResponse> {
  const state = randomUrlSafe()
  const verifier = randomUrlSafe()
  const challenge = await codeChallenge(verifier)
  const seal = await sealData(
    { state, verifier, returnTo },
    { password: serverEnv.sessionSecret, ttl: TX_TTL_SECONDS },
  )
  const response = NextResponse.redirect(authorizeUrl(state, challenge))
  response.cookies.set(OAUTH_TX_COOKIE_NAME, seal, cookieFlags(TX_TTL_SECONDS))
  return response
}

export async function readOauthTx(request: NextRequest): Promise<OauthTx | null> {
  const raw = request.cookies.get(OAUTH_TX_COOKIE_NAME)?.value
  if (!raw) return null
  try {
    const data = await unsealData<Partial<OauthTx>>(raw, {
      password: serverEnv.sessionSecret,
      ttl: TX_TTL_SECONDS,
    })
    if (
      !data ||
      typeof data.state !== 'string' ||
      typeof data.verifier !== 'string' ||
      typeof data.returnTo !== 'string'
    ) {
      return null
    }
    return { state: data.state, verifier: data.verifier, returnTo: safeReturnTo(data.returnTo) }
  } catch {
    return null
  }
}

export function statesMatch(expected: string, returned: string): boolean {
  return sameString(expected, returned)
}

export function clearOauthTx(response: NextResponse) {
  response.cookies.set(OAUTH_TX_COOKIE_NAME, '', cookieFlags(0))
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function authErrorResponse(title: string, detail: string): NextResponse {
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family: sans-serif; padding: 1.5rem">
<main>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(detail)}</p>
<p><a href="/api/auth/sanity/login?returnTo=/">Try signing in again</a></p>
</main>
</body>
</html>`
  const response = new NextResponse(html, {
    status: 400,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
  clearOauthTx(response)
  return response
}

async function postForm(url: string, params: URLSearchParams): Promise<TokenEndpointResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: params,
    cache: 'no-store',
  })
  if (!response.ok) {
    await response.text()
    throw new OAuthRequestError(response.status)
  }
  return (await response.json()) as TokenEndpointResponse
}

function confidentialParams(grant: Record<string, string>): URLSearchParams {
  return new URLSearchParams({
    ...grant,
    client_id: serverEnv.clientId,
    client_secret: serverEnv.clientSecret,
    resource: resourceIndicator(),
  })
}

/**
 * A refresh response may omit `refresh_token`. In that case the previous one
 * stays valid and is kept.
 */
function parseTokens(body: TokenEndpointResponse, previousRefreshToken?: string): OAuthTokens {
  const accessToken = body.access_token
  const expiresIn = body.expires_in
  const refreshToken =
    typeof body.refresh_token === 'string' && body.refresh_token.length > 0
      ? body.refresh_token
      : previousRefreshToken
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new OAuthRequestError(502)
  }
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new OAuthRequestError(502)
  }
  if (!refreshToken) throw new OAuthRequestError(502)
  return { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 }
}

export async function exchangeCode(code: string, verifier: string): Promise<OAuthTokens> {
  const body = await postForm(
    serverEnv.tokenUrl,
    confidentialParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: serverEnv.redirectUri,
    }),
  )
  return parseTokens(body)
}

export async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  const body = await postForm(
    serverEnv.tokenUrl,
    confidentialParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  )
  return parseTokens(body, refreshToken)
}

/**
 * Revoke failures are ignored. Revoking the token does not necessarily end the
 * user's sanity.io login session, so the next sign-in may skip the login screen.
 */
export async function revokeToken(token: string): Promise<void> {
  try {
    const response = await fetch(serverEnv.revokeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        client_id: serverEnv.clientId,
        client_secret: serverEnv.clientSecret,
      }),
      cache: 'no-store',
    })
    await response.text()
  } catch {
    // Logout still clears the local session.
  }
}
