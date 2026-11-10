import 'server-only'

import { ClientError, createClient } from '@sanity/client'
import { SANITY_DATASET, SANITY_ORG_ID, SANITY_PROJECT_ID } from '@/lib/public-env'

export class OrgMismatchError extends Error {
  constructor() {
    super(
      'The organization you picked does not own this project. Sign in again and choose the organization that owns this app.',
    )
    this.name = 'OrgMismatchError'
  }
}

function statusOf(error: unknown): number | 'network' {
  return error instanceof ClientError ? error.statusCode : 'network'
}

/**
 * Confirms the token can see this project and that the project belongs to the expected org.
 * Users who belong to several organizations pick one on the Sanity login screen; a token
 * issued for the wrong one cannot use this project, so the callback rejects it early.
 */
export async function assertProjectAccess(token: string): Promise<void> {
  const client = createClient({
    apiVersion: '2025-02-19',
    useCdn: false,
    useProjectHostname: false,
    token,
  })
  try {
    const project = await client.request<{ organizationId?: string }>({
      url: `/projects/${SANITY_PROJECT_ID}`,
    })
    if (project.organizationId !== SANITY_ORG_ID) throw new OrgMismatchError()
  } catch (error) {
    if (error instanceof OrgMismatchError) throw error
    const status = statusOf(error)
    if (status === 401 || status === 403 || status === 404) throw new OrgMismatchError()
    throw new Error(`Could not verify project access (${status}).`)
  }
}

/**
 * Reads `/users/me` on the global API. The account id (`id`) and the user id that
 * documents and history refer to (`sanityUserId`) are different fields; this
 * returns `sanityUserId` only. Runs on the server because the global API does not
 * honor the project's CORS origins.
 */
export async function fetchSanityUserId(token: string): Promise<string> {
  const client = createClient({
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: '2021-06-07',
    useCdn: false,
    useProjectHostname: false,
    token,
  })
  let user: { sanityUserId?: unknown }
  try {
    user = await client.request<{ sanityUserId?: unknown }>({ url: '/users/me' })
  } catch (error) {
    throw new Error(`Could not read the signed-in user (${statusOf(error)}).`)
  }
  if (typeof user.sanityUserId !== 'string' || user.sanityUserId.length === 0) {
    throw new Error('Signed in, but /users/me did not include sanityUserId.')
  }
  return user.sanityUserId
}
