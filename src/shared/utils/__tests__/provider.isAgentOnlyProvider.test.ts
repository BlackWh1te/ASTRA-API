import { describe, expect, it } from 'vitest'

import { ASTRA_CLOUD_PROVIDER_ID } from '@shared/data/presets/astra-api'
import type { Provider } from '@shared/data/types/provider'

import { isAgentOnlyProvider } from '../provider'

const provider = (id: string, authMethods?: Provider['authMethods']): Pick<Provider, 'id' | 'authMethods'> => ({
  id,
  authMethods
})

describe('isAgentOnlyProvider', () => {
  it('is true for external-cli providers in every edition', () => {
    expect(isAgentOnlyProvider(provider('claude-code', ['external-cli']), 'cn')).toBe(true)
    expect(isAgentOnlyProvider(provider('claude-code', ['external-cli']), 'global')).toBe(true)
  })

  it('follows ASTRA_CLOUD_AUDIENCE for the Astra Cloud provider', () => {
    expect(isAgentOnlyProvider(provider(ASTRA_CLOUD_PROVIDER_ID), 'cn')).toBe(true)
    expect(isAgentOnlyProvider(provider(ASTRA_CLOUD_PROVIDER_ID), 'global')).toBe(false)
  })

  it('is false for api-key and oauth providers', () => {
    expect(isAgentOnlyProvider(provider('openai', ['api-key']), 'cn')).toBe(false)
    expect(isAgentOnlyProvider(provider('codex', ['oauth']), 'cn')).toBe(false)
    expect(isAgentOnlyProvider(provider('openai'), 'global')).toBe(false)
  })
})
