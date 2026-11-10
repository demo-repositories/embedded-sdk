import { NextRequest } from 'next/server'
import { beginOauth, safeReturnTo } from '@/lib/oauth'

/** Starts sign-in: redirects to Sanity's authorize URL. `?returnTo=` is where to land afterwards. */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  return beginOauth(returnTo)
}
