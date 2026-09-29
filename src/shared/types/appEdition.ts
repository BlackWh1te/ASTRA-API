import type { ProviderEdition } from '@astra-api/provider-registry'

export const APP_EDITIONS = ['global', 'cn'] as const satisfies readonly ProviderEdition[]

export type AppEdition = (typeof APP_EDITIONS)[number]
