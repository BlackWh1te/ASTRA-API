import { and, eq } from 'drizzle-orm'

import { ENDPOINT_TYPE } from '@astra-api/provider-registry'
import { preferenceTable } from '@data/db/schemas/preference'
import type { InsertUserModelRow } from '@data/db/schemas/userModel'
import { userModelTable } from '@data/db/schemas/userModel'
import type { InsertUserProviderRow } from '@data/db/schemas/userProvider'
import { providerService } from '@data/services/ProviderService'
import { insertManyWithOrderKey } from '@data/services/utils/orderKey'
import { loggerService } from '@logger'
import {
  ASTRA_CLOUD_PROVIDER_ID,
  ASTRA-API_API_BASE_URL,
  ASTRA-API_DEFAULT_MODEL_GROUP,
  ASTRA-API_DEFAULT_MODEL_ID,
  ASTRA-API_DEFAULT_MODEL_NAME,
  ASTRA-API_DEFAULT_UNIQUE_MODEL_ID,
  ASTRA-API_PROVIDER_ID,
  ASTRA-API_PROVIDER_NAME
} from '@shared/data/presets/astra-api'
import type { ModelCapability } from '@shared/data/types/model'

import type { DbType, ISeeder } from '../../types'
import { hashObject } from '../hashObject'

const logger = loggerService.withContext('Astra-apiDefaultModelSeeder')

const DEFAULT_MODEL_PREFERENCE_SCOPE = 'default' as const
export const DEFAULT_MODEL_PREFERENCE_KEYS = [
  'chat.default_model_id',
  'feature.quick_assistant.model_id',
  'feature.translate.model_id'
] as const

type TxLike = Pick<DbType, 'select' | 'insert' | 'update'>
type ManagedAstraProviderRow = Omit<InsertUserProviderRow, 'orderKey'>
type Astra-apiDefaultModelRow = Omit<InsertUserModelRow, 'orderKey'>
type DefaultModelPreferenceRow = {
  scope: typeof DEFAULT_MODEL_PREFERENCE_SCOPE
  key: (typeof DEFAULT_MODEL_PREFERENCE_KEYS)[number]
  value: typeof ASTRA-API_DEFAULT_UNIQUE_MODEL_ID
}

function createAstra-apiProviderRow(): ManagedAstraProviderRow {
  return {
    providerId: ASTRA-API_PROVIDER_ID,
    presetProviderId: ASTRA-API_PROVIDER_ID,
    name: ASTRA-API_PROVIDER_NAME,
    endpointConfigs: {
      [ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]: {
        baseUrl: ASTRA-API_API_BASE_URL
      }
    },
    defaultChatEndpoint: ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS,
    authConfig: null,
    providerSettings: null,
    isEnabled: true
  }
}

function createAstraCloudProviderRow(): ManagedAstraProviderRow {
  return {
    providerId: ASTRA_CLOUD_PROVIDER_ID,
    presetProviderId: ASTRA-API_PROVIDER_ID,
    name: ASTRA-API_PROVIDER_NAME,
    endpointConfigs: null,
    defaultChatEndpoint: ENDPOINT_TYPE.ANTHROPIC_MESSAGES,
    authConfig: null,
    providerSettings: null,
    isEnabled: true
  }
}

function createAstra-apiDefaultModelRow(): Astra-apiDefaultModelRow {
  return {
    id: ASTRA-API_DEFAULT_UNIQUE_MODEL_ID,
    providerId: ASTRA-API_PROVIDER_ID,
    modelId: ASTRA-API_DEFAULT_MODEL_ID,
    presetModelId: null,
    name: ASTRA-API_DEFAULT_MODEL_NAME,
    description: null,
    group: ASTRA-API_DEFAULT_MODEL_GROUP,
    capabilities: [] as ModelCapability[],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    contextWindow: null,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: true,
    isHidden: false,
    isDeprecated: false,
    notes: null
  }
}

// Exported solely for v1->v2 migration reuse; make private when migration support is dropped.
export function ensureAstra-apiDefaultProviderAndModelTx(tx: TxLike): void {
  const insertedProviderCount = providerService.batchUpsertTx(tx, [createAstra-apiProviderRow()])
  if (insertedProviderCount > 0) {
    logger.warn('Self-healed missing Astra-api default provider', { providerId: ASTRA-API_PROVIDER_ID })
  }

  const insertedCloudProviderCount = providerService.batchUpsertTx(tx, [createAstraCloudProviderRow()])
  if (insertedCloudProviderCount > 0) {
    logger.warn('Self-healed missing Astra Cloud provider', { providerId: ASTRA_CLOUD_PROVIDER_ID })
  }

  const [existing] = tx
    .select({ id: userModelTable.id })
    .from(userModelTable)
    .where(eq(userModelTable.id, ASTRA-API_DEFAULT_UNIQUE_MODEL_ID))
    .limit(1)
    .all()

  if (existing) return

  logger.warn('Self-healed missing Astra-api default model', { modelId: ASTRA-API_DEFAULT_UNIQUE_MODEL_ID })
  insertManyWithOrderKey(tx, userModelTable, [createAstra-apiDefaultModelRow()], {
    pkColumn: userModelTable.id,
    scope: eq(userModelTable.providerId, ASTRA-API_PROVIDER_ID)
  })
}

function createDefaultModelPreferenceRows(): DefaultModelPreferenceRow[] {
  return DEFAULT_MODEL_PREFERENCE_KEYS.map((key) => ({
    scope: DEFAULT_MODEL_PREFERENCE_SCOPE,
    key,
    value: ASTRA-API_DEFAULT_UNIQUE_MODEL_ID
  }))
}

function ensureDefaultModelPreferencesTx(tx: TxLike): void {
  for (const { scope, key, value } of createDefaultModelPreferenceRows()) {
    const [existing] = tx
      .select({ value: preferenceTable.value })
      .from(preferenceTable)
      .where(and(eq(preferenceTable.scope, scope), eq(preferenceTable.key, key)))
      .limit(1)
      .all()

    if (!existing) {
      logger.warn('Self-healed missing default model preference', { key, value })
      tx.insert(preferenceTable)
        .values({
          scope,
          key,
          value
        })
        .run()
    }
  }
}

function ensureAstra-apiDefaultModelSetupTx(tx: TxLike): void {
  ensureAstra-apiDefaultProviderAndModelTx(tx)
  ensureDefaultModelPreferencesTx(tx)
}

export class Astra-apiDefaultModelSeeder implements ISeeder {
  readonly name = 'astra-apiDefaultModel'
  readonly description = 'Ensure Astra-api providers, default model, and default model preferences'
  readonly version: string

  constructor() {
    this.version = hashObject({
      provider: createAstra-apiProviderRow(),
      cloudProvider: createAstraCloudProviderRow(),
      model: createAstra-apiDefaultModelRow(),
      preferences: createDefaultModelPreferenceRows()
    })
  }

  run(db: DbType): void {
    db.transaction((tx) => ensureAstra-apiDefaultModelSetupTx(tx))
  }
}
