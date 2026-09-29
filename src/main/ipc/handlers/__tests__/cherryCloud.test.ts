import { beforeEach, describe, expect, it, vi } from 'vitest'

const service = vi.hoisted(() => ({
  startLogin: vi.fn()
}))

vi.mock('@application', () => ({
  application: {
    get: (name: string) => {
      if (name === 'AstraCloudService') return service
      throw new Error(`Unexpected service: ${name}`)
    }
  }
}))

import {
  AstraCloudLoginUnavailableError,
  AstraCloudUpgradeRequiredError
} from '@main/services/astraCloud/AstraCloudService'
import { astraCloudErrorCodes } from '@shared/ipc/errors/astraCloud'
import { IpcError } from '@shared/ipc/errors/IpcError'

import { astraCloudHandlers } from '../astraCloud'

describe('astraCloudHandlers', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    [new AstraCloudLoginUnavailableError(), astraCloudErrorCodes.LOGIN_SERVICE_UNAVAILABLE],
    [new AstraCloudUpgradeRequiredError(), astraCloudErrorCodes.UPGRADE_REQUIRED]
  ])('preserves the login error code %s across IPC', async (failure, code) => {
    service.startLogin.mockRejectedValueOnce(failure)

    const error = await astraCloudHandlers['astra_cloud.login.start'](undefined, { senderId: 'w1' }).catch(
      (caught: unknown) => caught
    )

    expect(error).toBeInstanceOf(IpcError)
    expect(error).toHaveProperty('code', code)
  })
})
