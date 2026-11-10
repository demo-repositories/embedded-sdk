// Server-only configuration, validated once at startup. `server-only` makes the
// build fail if a client component imports this, so these values (including the
// OAuth client secret) never end up in the browser bundle.
import 'server-only'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}. See .env.example.`)
  return value
}

function requiredUrl(name: string): string {
  const value = required(name)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} is not an absolute URL.`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${name} must be an http(s) URL.`)
  }
  return value
}

const sessionSecret = required('SESSION_SECRET')
if (sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters.')
}

const refreshWindowSeconds = Number(process.env.SANITY_TOKEN_REFRESH_WINDOW_SECONDS ?? '86400')
if (!Number.isFinite(refreshWindowSeconds) || refreshWindowSeconds < 0) {
  throw new Error('SANITY_TOKEN_REFRESH_WINDOW_SECONDS must be a non-negative number.')
}

export const serverEnv = {
  clientId: required('SANITY_OAUTH_CLIENT_ID'),
  clientSecret: required('SANITY_OAUTH_CLIENT_SECRET'),
  sessionSecret,
  authorizeUrl: requiredUrl('SANITY_OAUTH_AUTHORIZE_URL'),
  tokenUrl: requiredUrl('SANITY_OAUTH_TOKEN_URL'),
  revokeUrl: requiredUrl('SANITY_OAUTH_REVOKE_URL'),
  redirectUri: requiredUrl('SANITY_OAUTH_REDIRECT_URI'),
  refreshWindowSeconds,
}
