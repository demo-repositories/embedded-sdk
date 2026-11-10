import { NextRequest } from 'next/server'
import { beginOauth, safeReturnTo } from '@/lib/oauth'

export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  return beginOauth(returnTo)
}
