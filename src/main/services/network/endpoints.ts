import { RELEASE_HISTORY_URL } from '@main/services/AppUpdaterService'
import { resolveAstraCloudApiOrigin } from '@main/services/astraCloud/AstraCloudService'
import { DIAGNOSTIC_UPLOAD_URL } from '@main/services/diagnostics'
import { resolveRegistryBaseUrl } from '@main/services/ProviderRegistryUpdaterService'

import type { NetworkEndpoint } from './types'

/** Built-in URLs use their owning services' resolution, including the updater's country detection. */
export async function builtinEndpoints(): Promise<readonly NetworkEndpoint[]> {
  return [
    { id: 'update', url: RELEASE_HISTORY_URL },
    { id: 'registry', url: `${await resolveRegistryBaseUrl()}/manifest.json` },
    { id: 'cloud', url: resolveAstraCloudApiOrigin() },
    { id: 'diagnostics', url: DIAGNOSTIC_UPLOAD_URL }
  ]
}
