export const REQUIRED_CONFIG = [
  'ASTRA_TEST_CUSTOM_PROVIDER_BASE_URL',
  'ASTRA_TEST_CUSTOM_PROVIDER_ANTHROPIC_BASE_URL',
  'ASTRA_TEST_CUSTOM_PROVIDER_API_KEY',
  'ASTRA_TEST_CUSTOM_PROVIDER_CHAT_MODEL',
  'ASTRA_TEST_CUSTOM_PROVIDER_EMBEDDING_BASE_URL',
  'ASTRA_TEST_CUSTOM_PROVIDER_EMBEDDING_API_KEY',
  'ASTRA_TEST_CUSTOM_PROVIDER_EMBEDDING_MODEL',
  'ASTRA_TEST_ASTRAIN_CHAT_MODEL',
  'ASTRA_TEST_ASTRAIN_IMAGE_MODEL',
  'ASTRA_TEST_ASTRAIN_ACCOUNT',
  'ASTRA_TEST_ASTRAIN_PASSWORD'
] as const

export type RequiredConfigName = (typeof REQUIRED_CONFIG)[number]

export interface RegressionTestConfig {
  customProvider: {
    baseUrl: string
    anthropicBaseUrl: string
    apiKey: string
    chatModel: string
  }
  customEmbeddingProvider: {
    baseUrl: string
    apiKey: string
    model: string
  }
  astraIn: {
    chatModel: string
    imageModel: string
    account: string
    password: string
  }
}

type Environment = Record<string, string | undefined>

export function loadTestConfig(environment: Environment = process.env): RegressionTestConfig {
  const missing = REQUIRED_CONFIG.filter((name) => !environment[name]?.trim())
  if (missing.length > 0) {
    throw new Error(`Missing regression test configuration: ${missing.join(', ')}`)
  }

  const value = (name: RequiredConfigName) => environment[name]!.trim()
  const absoluteUrl = (name: RequiredConfigName) => {
    const result = value(name)
    try {
      new URL(result)
      return result
    } catch {
      throw new Error(`${name} must be an absolute URL`)
    }
  }

  return {
    customProvider: {
      baseUrl: absoluteUrl('ASTRA_TEST_CUSTOM_PROVIDER_BASE_URL'),
      anthropicBaseUrl: absoluteUrl('ASTRA_TEST_CUSTOM_PROVIDER_ANTHROPIC_BASE_URL'),
      apiKey: value('ASTRA_TEST_CUSTOM_PROVIDER_API_KEY'),
      chatModel: value('ASTRA_TEST_CUSTOM_PROVIDER_CHAT_MODEL')
    },
    customEmbeddingProvider: {
      baseUrl: absoluteUrl('ASTRA_TEST_CUSTOM_PROVIDER_EMBEDDING_BASE_URL'),
      apiKey: value('ASTRA_TEST_CUSTOM_PROVIDER_EMBEDDING_API_KEY'),
      model: value('ASTRA_TEST_CUSTOM_PROVIDER_EMBEDDING_MODEL')
    },
    astraIn: {
      chatModel: value('ASTRA_TEST_ASTRAIN_CHAT_MODEL'),
      imageModel: value('ASTRA_TEST_ASTRAIN_IMAGE_MODEL'),
      account: value('ASTRA_TEST_ASTRAIN_ACCOUNT'),
      password: value('ASTRA_TEST_ASTRAIN_PASSWORD')
    }
  }
}

export function getSensitiveConfigValues(config: RegressionTestConfig): string[] {
  return [
    config.customProvider.apiKey,
    config.customEmbeddingProvider.apiKey,
    config.astraIn.account,
    config.astraIn.password
  ]
}
