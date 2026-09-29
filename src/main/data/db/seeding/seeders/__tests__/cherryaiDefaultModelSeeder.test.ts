import { setupTestDatabase } from '@test-helpers/db'
import { mockMainLoggerService } from '@test-mocks/MainLoggerService'
import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { preferenceTable } from '@data/db/schemas/preference'
import { userModelTable } from '@data/db/schemas/userModel'
import { userProviderTable } from '@data/db/schemas/userProvider'
import {
  Astra-apiDefaultModelSeeder,
  DEFAULT_MODEL_PREFERENCE_KEYS
} from '@data/db/seeding/seeders/astra-apiDefaultModelSeeder'
import { generateOrderKeyBetween } from '@data/services/utils/orderKey'
import {
  ASTRA_CLOUD_PROVIDER_ID,
  ASTRA-API_API_BASE_URL,
  ASTRA-API_DEFAULT_MODEL_GROUP,
  ASTRA-API_DEFAULT_MODEL_ID,
  ASTRA-API_DEFAULT_MODEL_NAME,
  ASTRA-API_DEFAULT_UNIQUE_MODEL_ID,
  ASTRA-API_PROVIDER_ID
} from '@shared/data/presets/astra-api'
import { ENDPOINT_TYPE } from '@shared/data/types/model'

describe('Astra-apiDefaultModelSeeder', () => {
  const dbh = setupTestDatabase()

  beforeEach(() => {
    mockMainLoggerService.warn.mockClear()
  })

  async function readPreferenceValue(key: string) {
    const [preference] = await dbh.db
      .select()
      .from(preferenceTable)
      .where(and(eq(preferenceTable.scope, 'default'), eq(preferenceTable.key, key)))
      .limit(1)
    return preference?.value
  }

  async function expectSeededDefaultModelPreferences() {
    for (const key of DEFAULT_MODEL_PREFERENCE_KEYS) {
      expect(await readPreferenceValue(key)).toBe(ASTRA-API_DEFAULT_UNIQUE_MODEL_ID)
    }
  }

  it('seeds branded Astra-api providers, Qwen model, and missing default model preferences', async () => {
    new Astra-apiDefaultModelSeeder().run(dbh.db)

    const [provider] = await dbh.db
      .select()
      .from(userProviderTable)
      .where(eq(userProviderTable.providerId, ASTRA-API_PROVIDER_ID))
      .limit(1)
    const [model] = await dbh.db
      .select()
      .from(userModelTable)
      .where(eq(userModelTable.id, ASTRA-API_DEFAULT_UNIQUE_MODEL_ID))
      .limit(1)
    const [cloudProvider] = await dbh.db
      .select()
      .from(userProviderTable)
      .where(eq(userProviderTable.providerId, ASTRA_CLOUD_PROVIDER_ID))
      .limit(1)

    expect(provider).toMatchObject({
      providerId: ASTRA-API_PROVIDER_ID,
      presetProviderId: ASTRA-API_PROVIDER_ID,
      name: 'Astra-api',
      defaultChatEndpoint: ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS,
      isEnabled: true
    })
    expect(provider?.endpointConfigs?.[ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]?.baseUrl).toBe(ASTRA-API_API_BASE_URL)
    expect(cloudProvider).toMatchObject({
      providerId: ASTRA_CLOUD_PROVIDER_ID,
      presetProviderId: ASTRA-API_PROVIDER_ID,
      name: 'Astra-api',
      defaultChatEndpoint: ENDPOINT_TYPE.ANTHROPIC_MESSAGES,
      isEnabled: true
    })
    expect(model).toMatchObject({
      id: ASTRA-API_DEFAULT_UNIQUE_MODEL_ID,
      providerId: ASTRA-API_PROVIDER_ID,
      modelId: ASTRA-API_DEFAULT_MODEL_ID,
      name: ASTRA-API_DEFAULT_MODEL_NAME,
      group: ASTRA-API_DEFAULT_MODEL_GROUP,
      isEnabled: true,
      isHidden: false
    })
    await expectSeededDefaultModelPreferences()
    expect(mockMainLoggerService.warn).toHaveBeenCalledWith('Self-healed missing Astra-api default provider', {
      providerId: ASTRA-API_PROVIDER_ID
    })
    expect(mockMainLoggerService.warn).toHaveBeenCalledWith('Self-healed missing Astra-api default model', {
      modelId: ASTRA-API_DEFAULT_UNIQUE_MODEL_ID
    })
    expect(mockMainLoggerService.warn).toHaveBeenCalledWith('Self-healed missing default model preference', {
      key: 'chat.default_model_id',
      value: ASTRA-API_DEFAULT_UNIQUE_MODEL_ID
    })
    expect(await readPreferenceValue('topic.naming.model_id')).toBeUndefined()
  })

  it('does not overwrite existing non-empty default model preferences', async () => {
    await dbh.db.insert(preferenceTable).values([
      {
        scope: 'default',
        key: 'chat.default_model_id',
        value: 'openai::gpt-4o'
      },
      {
        scope: 'default',
        key: 'feature.quick_assistant.model_id',
        value: 'anthropic::claude-3-haiku'
      },
      {
        scope: 'default',
        key: 'feature.translate.model_id',
        value: 'google::gemini-2.5-flash'
      }
    ])

    new Astra-apiDefaultModelSeeder().run(dbh.db)

    expect(await readPreferenceValue('chat.default_model_id')).toBe('openai::gpt-4o')
    expect(await readPreferenceValue('feature.quick_assistant.model_id')).toBe('anthropic::claude-3-haiku')
    expect(await readPreferenceValue('feature.translate.model_id')).toBe('google::gemini-2.5-flash')
  })

  it('preserves existing null default model preferences', async () => {
    await dbh.db.insert(preferenceTable).values(
      DEFAULT_MODEL_PREFERENCE_KEYS.map((key) => ({
        scope: 'default',
        key,
        value: null
      }))
    )

    new Astra-apiDefaultModelSeeder().run(dbh.db)

    for (const key of DEFAULT_MODEL_PREFERENCE_KEYS) {
      expect(await readPreferenceValue(key)).toBeNull()
    }
  })

  it('preserves existing empty default model preferences', async () => {
    await dbh.db.insert(preferenceTable).values(
      DEFAULT_MODEL_PREFERENCE_KEYS.map((key) => ({
        scope: 'default',
        key,
        value: ''
      }))
    )

    new Astra-apiDefaultModelSeeder().run(dbh.db)

    for (const key of DEFAULT_MODEL_PREFERENCE_KEYS) {
      expect(await readPreferenceValue(key)).toBe('')
    }
  })

  it('preserves an existing Astra-api provider row', async () => {
    await dbh.db.insert(userProviderTable).values({
      providerId: ASTRA-API_PROVIDER_ID,
      presetProviderId: ASTRA-API_PROVIDER_ID,
      name: 'Renamed Astra-api',
      orderKey: generateOrderKeyBetween(null, null)
    })

    new Astra-apiDefaultModelSeeder().run(dbh.db)

    const [provider] = await dbh.db
      .select()
      .from(userProviderTable)
      .where(eq(userProviderTable.providerId, ASTRA-API_PROVIDER_ID))
      .limit(1)
    const [model] = await dbh.db
      .select()
      .from(userModelTable)
      .where(eq(userModelTable.id, ASTRA-API_DEFAULT_UNIQUE_MODEL_ID))
      .limit(1)

    expect(provider?.name).toBe('Renamed Astra-api')
    expect(model?.id).toBe(ASTRA-API_DEFAULT_UNIQUE_MODEL_ID)
  })
})
