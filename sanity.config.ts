'use client'

import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { SANITY_DATASET, SANITY_PROJECT_ID } from '@/lib/public-env'
import { sdkProof } from '@/sanity/schema/sdkProof'

export default defineConfig({
  name: 'embedded',
  basePath: '/studio',
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  plugins: [structureTool()],
  schema: { types: [sdkProof] },
})
