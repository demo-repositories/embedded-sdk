import { getIronSession, webCookies } from 'iron-session'
import { NextRequest, NextResponse } from 'next/server'
import {
  authErrorResponse,
  clearOauthTx,
  exchangeCode,
  readOauthTx,
  revokeToken,
  statesMatch,
} from '@/lib/oauth'
import { assertProjectAccess, fetchSanityUserId, OrgMismatchError } from '@/lib/sanity-user'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const oauthError = params.get('error')
  if (oauthError) {
    return authErrorResponse('Sign-in was cancelled', params.get('error_description') ?? oauthError)
  }

  const code = params.get('code')
  const returnedState = params.get('state')
  if (!code || !returnedState) {
    return authErrorResponse('Sign-in did not finish', 'Sanity did not return an authorization code.')
  }

  const tx = await readOauthTx(request)
  if (!tx || !statesMatch(tx.state, returnedState)) {
    return authErrorResponse(
      'Sign-in could not be verified',
      'This callback did not match the sign-in this browser started. Start again.',
    )
  }

  let tokens
  try {
    tokens = await exchangeCode(code, tx.verifier)
  } catch {
    return authErrorResponse('Sign-in was rejected', 'Sanity did not accept the authorization code.')
  }

  try {
    await assertProjectAccess(tokens.accessToken)
  } catch (error) {
    await revokeToken(tokens.refreshToken)
    if (error instanceof OrgMismatchError) return authErrorResponse('Wrong organization', error.message)
    return authErrorResponse(
      'Could not verify project access',
      error instanceof Error ? error.message : 'Start again.',
    )
  }

  let sanityUserId: string
  try {
    sanityUserId = await fetchSanityUserId(tokens.accessToken)
  } catch (error) {
    await revokeToken(tokens.refreshToken)
    return authErrorResponse(
      'Could not read your user',
      error instanceof Error ? error.message : 'Start again.',
    )
  }

  const response = NextResponse.redirect(new URL(tx.returnTo, request.url))
  clearOauthTx(response)
  const session = await getIronSession<SessionData>(webCookies(request, response), sessionOptions())
  session.accessToken = tokens.accessToken
  session.refreshToken = tokens.refreshToken
  session.expiresAt = tokens.expiresAt
  session.sanityUserId = sanityUserId
  await session.save()
  return response
}
