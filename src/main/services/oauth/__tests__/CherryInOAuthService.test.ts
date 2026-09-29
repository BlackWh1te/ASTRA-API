import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(),
  authenticatedFetch: vi.fn(),
  logout: vi.fn()
}))

const netMocks = vi.hoisted(() => ({
  fetch: vi.fn()
}))

vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  const result = mockApplicationFactory()
  const originalGet = result.application.get.getMockImplementation()!
  result.application.get.mockImplementation((name: string) => {
    if (name === 'OAuthRuntimeService') return runtimeMocks
    return originalGet(name)
  })
  return result
})

vi.mock('electron', () => ({
  net: {
    fetch: netMocks.fetch
  }
}))

import { mockMainLoggerService } from '../../../../../tests/__mocks__/MainLoggerService'
import { AstraInOAuthService } from '../AstraInOAuthService'
import { OAuthTransientError } from '../errors'

describe('AstraInOAuthService', () => {
  let astraInOAuthService: AstraInOAuthService

  beforeEach(() => {
    vi.clearAllMocks()
    // Faithful stand-in for OAuthRuntimeService.authenticatedFetch: token
    // resolution + 401 force-refresh live in the runtime (covered by its own
    // tests). Here we only drive the request shaping/response handling the
    // AstraIN service owns — build with a fixed credential, run doFetch, and
    // fire onUnauthorized on a 401 so the diagnostic log is exercised.
    runtimeMocks.authenticatedFetch.mockImplementation(async (_providerId, buildRequest, doFetch, options = {}) => {
      const { input, init } = buildRequest({ accessToken: 'oauth-access', accountId: null })
      const response = await doFetch(input, init)
      if (response.status === 401) await options.onUnauthorized?.(response)
      return response
    })
    astraInOAuthService = new AstraInOAuthService()
  })

  it('maps balance/profile data and shapes the authenticated balance request', async () => {
    netMocks.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          success: true,
          data: {
            quota: 64250000,
            used_quota: 3410000
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          display_name: 'Siin',
          username: 'siin',
          email: 'siin@gmail.com',
          group: 'Pro'
        })
      })

    const result = await astraInOAuthService.getBalance('https://open.astrain.ai')

    expect(result).toEqual({
      balance: 128.5,
      profile: {
        displayName: 'Siin',
        username: 'siin',
        email: 'siin@gmail.com',
        group: 'Pro'
      }
    })
    // Delegates to the runtime with the astrain provider id and its apiHost
    // context, and shapes the bearer/json request the runtime then drives.
    expect(runtimeMocks.authenticatedFetch).toHaveBeenCalledWith(
      'astrain',
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ context: { apiHost: 'https://open.astrain.ai' } })
    )
    expect(netMocks.fetch).toHaveBeenCalledWith(
      'https://open.astrain.ai/api/v1/oauth/balance',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer oauth-access' }) })
    )
  })

  it('logs 401 response details and surfaces balance HTTP failures', async () => {
    const errorSpy = vi.spyOn(mockMainLoggerService, 'error').mockImplementation(() => {})
    netMocks.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      clone: () =>
        ({
          text: async () => '{"error":"invalid_token","access_token":"server-token"}'
        }) as Response
    })

    await expect(astraInOAuthService.getBalance('https://open.astrain.ai')).rejects.toThrow(
      'Failed to get balance: HTTP 401 Unauthorized from /api/v1/oauth/balance'
    )

    expect(errorSpy).toHaveBeenCalledWith(
      'AstraIN request returned 401 Unauthorized',
      expect.objectContaining({
        stage: '/api/v1/oauth/balance',
        response: expect.objectContaining({ body: expect.objectContaining({ access_token: '<redacted>' }) })
      })
    )
    errorSpy.mockRestore()
  })

  it('rejects api hosts outside the allowlist on every IPC entry point', async () => {
    const forgedHost = 'https://attacker.example.com'

    await expect(astraInOAuthService.getBalance(forgedHost)).rejects.toThrow(/Unauthorized API host/)

    await expect(astraInOAuthService.logout(forgedHost)).rejects.toThrow(/Unauthorized API host/)
  })

  it('revokes remotely and delegates local token clearing to OAuthRuntimeService on logout', async () => {
    runtimeMocks.getValidAccessToken.mockResolvedValue({ accessToken: 'oauth-access' })
    netMocks.fetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

    await astraInOAuthService.logout('https://open.astrain.ai')

    expect(netMocks.fetch).toHaveBeenCalledWith(
      'https://open.astrain.ai/oauth2/revoke',
      expect.objectContaining({ method: 'POST', body: 'token=oauth-access&token_type_hint=access_token' })
    )
    expect(runtimeMocks.logout).toHaveBeenCalledWith('astrain')
  })

  it('still clears the local session on logout when the token is temporarily unavailable', async () => {
    // A transient refresh failure means no token to revoke — logout must skip
    // the remote revoke but still delegate the local clear.
    runtimeMocks.getValidAccessToken.mockRejectedValue(new OAuthTransientError('temporary, please retry'))

    await astraInOAuthService.logout('https://open.astrain.ai')

    expect(netMocks.fetch).not.toHaveBeenCalled()
    expect(runtimeMocks.logout).toHaveBeenCalledWith('astrain')
  })
})
