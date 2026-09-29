import { beforeEach, describe, expect, it, vi } from 'vitest'

const { astraInOAuthService, runtimeService } = vi.hoisted(() => ({
  astraInOAuthService: {
    getBalance: vi.fn(() => Promise.resolve({ balance: 1, profile: null })),
    logout: vi.fn(() => Promise.resolve())
  },
  runtimeService: {
    signIn: vi.fn(() => Promise.resolve({ accountId: null, apiKeys: 'sk-astrain' }))
  }
}))
vi.mock('@main/services/oauth/AstraInOAuthService', () => ({ astraInOAuthService }))

import { application } from '@application'
import { OAuthSignInCancelledError } from '@main/services/oauth/errors'
import { IpcError } from '@shared/ipc/errors/IpcError'
import { oauthErrorCodes } from '@shared/ipc/errors/oauth'

import { astrainHandlers } from '../astrain'

const mainWindowService = {
  showMainWindow: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(application.get).mockImplementation((name: string) => {
    if (name === 'MainWindowService') return mainWindowService as never
    if (name === 'OAuthRuntimeService') return runtimeService as never
    throw new Error(`Unexpected application.get(${name})`)
  })
})

describe('astrainHandlers', () => {
  it('returns provisioned API keys and asks MainWindowService to raise the main window after sign-in', async () => {
    await expect(
      astrainHandlers['astrain.sign_in'](
        {
          requestId: 'request-1',
          oauthServer: 'https://open.astrain.ai',
          apiHost: 'https://open.astrain.ai'
        },
        { senderId: 'w1' }
      )
    ).resolves.toEqual({ apiKeys: 'sk-astrain' })
    expect(runtimeService.signIn).toHaveBeenCalledWith('w1', 'astrain', 'request-1', {
      oauthServer: 'https://open.astrain.ai',
      apiHost: 'https://open.astrain.ai'
    })
    expect(mainWindowService.showMainWindow).toHaveBeenCalledOnce()
  })

  it('maps sign-in cancellation to the shared OAuth IPC error', async () => {
    runtimeService.signIn.mockRejectedValueOnce(new OAuthSignInCancelledError('astrain'))

    const error = await astrainHandlers['astrain.sign_in'](
      { requestId: 'request-1', oauthServer: 'https://open.astrain.ai' },
      { senderId: 'w1' }
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(IpcError)
    expect(error).toHaveProperty('code', oauthErrorCodes.SIGN_IN_CANCELLED)
    expect(mainWindowService.showMainWindow).not.toHaveBeenCalled()
  })

  it('dispatches get_balance to the service', async () => {
    await expect(
      astrainHandlers['astrain.get_balance']({ apiHost: 'https://open.astrain.ai' }, { senderId: 'w1' })
    ).resolves.toEqual({ balance: 1, profile: null })
    expect(astraInOAuthService.getBalance).toHaveBeenCalledWith('https://open.astrain.ai')
  })

  it('dispatches logout to the service', async () => {
    await astrainHandlers['astrain.logout']({ apiHost: 'https://open.astrain.ai' }, { senderId: 'w1' })
    expect(astraInOAuthService.logout).toHaveBeenCalledWith('https://open.astrain.ai')
  })
})
