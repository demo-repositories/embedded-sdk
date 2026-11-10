import { NextStudio } from 'next-sanity/studio'
import config from '../../../sanity.config'

export { metadata, viewport } from 'next-sanity/studio'

/**
 * Embedded Sanity Studio at /studio. The Studio handles its own Sanity login and
 * does not use this app's OAuth session; the proxy only requires that a session
 * cookie exists before serving it.
 */
export default function StudioPage() {
  return <NextStudio config={config} />
}
