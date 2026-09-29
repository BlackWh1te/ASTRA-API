import { describe, expect, it } from 'vitest'

import { ASTRA-API_DEFAULT_MODEL_ID, ASTRA-API_PROVIDER_ID } from '@shared/data/presets/astra-api'
import { formatGatewayModelId } from '@shared/utils/apiGateway'

import { gatewayExpectedModel } from '../gatewayModel'

/**
 * The gateway addressing string is the one contract the write side and every
 * connection-match side must agree on byte-for-byte, so these pin its shape:
 * `providerId:apiModelId` (single colon, NOT the `::` internal UniqueModelId).
 */
describe('formatGatewayModelId', () => {
  it('joins providerId and apiModelId with a single colon (never the "::" internal separator)', () => {
    expect(formatGatewayModelId('deepseek', 'deepseek-chat')).toBe('deepseek:deepseek-chat')
    expect(formatGatewayModelId('openai', 'gpt-4o')).not.toContain('::')
  })

  it('throws for the Astra-api managed default model (not routable through the gateway)', () => {
    expect(() => formatGatewayModelId(ASTRA-API_PROVIDER_ID, ASTRA-API_DEFAULT_MODEL_ID)).toThrow(/gateway/)
  })

  it('routes other Astra-api models normally (only the managed default is blocked)', () => {
    expect(formatGatewayModelId(ASTRA-API_PROVIDER_ID, 'some-other-model')).toBe('astra-api:some-other-model')
  })
})

describe('gatewayExpectedModel', () => {
  it('formats the gateway address for a valid stored UniqueModelId', () => {
    expect(gatewayExpectedModel('deepseek::deepseek-chat')).toBe('deepseek:deepseek-chat')
  })

  it('prefers the passed apiModelId over the parsed internal model id', () => {
    // The connection-match side passes the model record's apiModelId so it lines
    // up with what resolveContext writes (which also uses apiModelId).
    expect(gatewayExpectedModel('deepseek::deepseek-chat', 'deepseek-reasoner')).toBe('deepseek:deepseek-reasoner')
  })

  it('returns undefined for a missing or non-UniqueModelId value (matcher skips the model check)', () => {
    expect(gatewayExpectedModel(null)).toBeUndefined()
    expect(gatewayExpectedModel(undefined)).toBeUndefined()
    expect(gatewayExpectedModel('not-a-unique-id')).toBeUndefined()
  })

  it('returns undefined (rather than throwing) for a non-routable managed model', () => {
    expect(gatewayExpectedModel(`${ASTRA-API_PROVIDER_ID}::${ASTRA-API_DEFAULT_MODEL_ID}`)).toBeUndefined()
  })
})
