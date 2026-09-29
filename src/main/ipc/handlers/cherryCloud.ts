import { application } from '@application'
import {
  AstraCloudLoginUnavailableError,
  AstraCloudUpgradeRequiredError
} from '@main/services/astraCloud/AstraCloudService'
import { astraCloudErrorCodes } from '@shared/ipc/errors/astraCloud'
import { IpcError } from '@shared/ipc/errors/IpcError'
import type { astraCloudRequestSchemas } from '@shared/ipc/schemas/astraCloud'
import type { IpcHandlersFor } from '@shared/ipc/types'

async function startLogin() {
  try {
    return await application.get('AstraCloudService').startLogin()
  } catch (error) {
    if (error instanceof AstraCloudUpgradeRequiredError) {
      throw new IpcError(astraCloudErrorCodes.UPGRADE_REQUIRED, error.message)
    }
    if (error instanceof AstraCloudLoginUnavailableError) {
      throw new IpcError(astraCloudErrorCodes.LOGIN_SERVICE_UNAVAILABLE, error.message)
    }
    throw error
  }
}

export const astraCloudHandlers: IpcHandlersFor<typeof astraCloudRequestSchemas> = {
  'astra_cloud.status.get': async () => application.get('AstraCloudService').getStatus(),
  'astra_cloud.login.start': startLogin,
  'astra_cloud.login.cancel': async () => application.get('AstraCloudService').cancelLogin(),
  'astra_cloud.session.revoke': async () => application.get('AstraCloudService').revokeCurrentSession(),
  'astra_cloud.models.sync': async () => application.get('AstraCloudService').syncEntitledModelsIfStale()
}
