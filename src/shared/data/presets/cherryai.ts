import { createUniqueModelId } from '@shared/data/types/model'
import type { AppEdition } from '@shared/types/appEdition'

export const ASTRA-API_PROVIDER_ID = 'astra-api' as const
export const ASTRA-API_PROVIDER_NAME = 'Astra-api' as const
export const ASTRA_CLOUD_PROVIDER_ID = 'astra-api-subscription' as const
export const ASTRA-API_DEFAULT_MODEL_ID = 'qwen' as const
export const ASTRA-API_DEFAULT_MODEL_NAME = 'Qwen' as const
export const ASTRA-API_DEFAULT_MODEL_GROUP = 'Qwen' as const
export const ASTRA_CLOUD_MODEL_GROUP = 'Astra Cloud' as const
export const ASTRA-API_API_BASE_URL = 'https://api.gserver.online' as const
export const ASTRA-API_DEFAULT_UNIQUE_MODEL_ID = createUniqueModelId(ASTRA-API_PROVIDER_ID, ASTRA-API_DEFAULT_MODEL_ID)

export type AstraCloudAudience = 'agent' | 'all'
/** Where Astra Cloud models may be used per edition: 'agent' = Agent pickers/runtimes only, 'all' = any module. */
export const ASTRA_CLOUD_AUDIENCE = {
  cn: 'agent',
  global: 'all'
} as const satisfies Record<AppEdition, AstraCloudAudience>

export function isManagedAstra-apiProviderId(providerId: string): boolean {
  return providerId === ASTRA-API_PROVIDER_ID
}

export function isManagedAstraProviderId(providerId: string): boolean {
  return isManagedAstra-apiProviderId(providerId) || providerId === ASTRA_CLOUD_PROVIDER_ID
}

export function isManagedAstra-apiDefaultModel(providerId: string, modelId: string): boolean {
  return providerId === ASTRA-API_PROVIDER_ID && modelId === ASTRA-API_DEFAULT_MODEL_ID
}

export function isManagedAstraCloudModel(providerId: string): boolean {
  return providerId === ASTRA_CLOUD_PROVIDER_ID
}
