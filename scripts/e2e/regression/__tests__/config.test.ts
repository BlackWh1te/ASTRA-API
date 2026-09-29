import { getSensitiveConfigValues, loadTestConfig } from '../config'

describe('regression test configuration', () => {
  const validEnv = {
    ASTRA_TEST_CUSTOM_PROVIDER_BASE_URL: 'https://gateway.example.test/v1',
    ASTRA_TEST_CUSTOM_PROVIDER_ANTHROPIC_BASE_URL: ' https://anthropic.example.test ',
    ASTRA_TEST_CUSTOM_PROVIDER_API_KEY: 'provider-secret',
    ASTRA_TEST_CUSTOM_PROVIDER_CHAT_MODEL: 'Qwen/Qwen3.6-27B',
    ASTRA_TEST_CUSTOM_PROVIDER_EMBEDDING_BASE_URL: 'https://embedding.example.test/v1',
    ASTRA_TEST_CUSTOM_PROVIDER_EMBEDDING_API_KEY: 'embedding-secret',
    ASTRA_TEST_CUSTOM_PROVIDER_EMBEDDING_MODEL: 'text-embedding-test',
    ASTRA_TEST_ASTRAIN_CHAT_MODEL: 'astra-chat-test',
    ASTRA_TEST_ASTRAIN_IMAGE_MODEL: 'image-test',
    ASTRA_TEST_ASTRAIN_ACCOUNT: 'automation@example.test',
    ASTRA_TEST_ASTRAIN_PASSWORD: 'account-secret'
  }

  it('requires a separate Anthropic URL instead of reusing the OpenAI URL', () => {
    expect(() => loadTestConfig({ ...validEnv, ASTRA_TEST_CUSTOM_PROVIDER_ANTHROPIC_BASE_URL: undefined })).toThrow(
      'Missing regression test configuration: ASTRA_TEST_CUSTOM_PROVIDER_ANTHROPIC_BASE_URL'
    )
  })

  it('loads provider-scoped values for Playwright', () => {
    const config = loadTestConfig(validEnv)

    expect(config.customProvider).toEqual({
      baseUrl: 'https://gateway.example.test/v1',
      anthropicBaseUrl: 'https://anthropic.example.test',
      apiKey: 'provider-secret',
      chatModel: 'Qwen/Qwen3.6-27B'
    })
    expect(config.customEmbeddingProvider).toEqual({
      apiKey: 'embedding-secret',
      baseUrl: 'https://embedding.example.test/v1',
      model: 'text-embedding-test'
    })
    expect(config.astraIn.imageModel).toBe('image-test')
    expect(config.customProvider.apiKey).toBe('provider-secret')
    expect(config.customEmbeddingProvider.apiKey).toBe('embedding-secret')
    expect(config.astraIn.password).toBe('account-secret')
    expect(getSensitiveConfigValues(config)).toEqual([
      'provider-secret',
      'embedding-secret',
      'automation@example.test',
      'account-secret'
    ])
  })

  it('fails before application launch when any required value is blank', () => {
    expect(() =>
      loadTestConfig({
        ...validEnv,
        ASTRA_TEST_CUSTOM_PROVIDER_CHAT_MODEL: '   ',
        ASTRA_TEST_ASTRAIN_ACCOUNT: undefined
      })
    ).toThrow(
      'Missing regression test configuration: ASTRA_TEST_CUSTOM_PROVIDER_CHAT_MODEL, ASTRA_TEST_ASTRAIN_ACCOUNT'
    )
  })

  it.each([
    'ASTRA_TEST_CUSTOM_PROVIDER_BASE_URL',
    'ASTRA_TEST_CUSTOM_PROVIDER_ANTHROPIC_BASE_URL',
    'ASTRA_TEST_CUSTOM_PROVIDER_EMBEDDING_BASE_URL'
  ])('validates %s before application launch', (name) => {
    expect(() =>
      loadTestConfig({
        ...validEnv,
        [name]: 'not-a-url'
      })
    ).toThrow(`${name} must be an absolute URL`)
  })
})
