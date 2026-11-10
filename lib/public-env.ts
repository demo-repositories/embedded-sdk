// Values inlined into the browser bundle. Do not put secrets here.
// These identify the project, dataset and organization; they are not credentials.
// Next only inlines literal `process.env.NEXT_PUBLIC_*` accesses, so keep these as-is.
export const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? ''
export const SANITY_DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? ''
export const SANITY_ORG_ID = process.env.NEXT_PUBLIC_SANITY_ORG_ID ?? ''

if (!SANITY_PROJECT_ID || !SANITY_DATASET || !SANITY_ORG_ID) {
  throw new Error(
    'Missing NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET or NEXT_PUBLIC_SANITY_ORG_ID. See .env.example.',
  )
}
