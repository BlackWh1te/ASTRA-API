import { astraInOAuthService } from '@main/services/oauth/AstraInOAuthService'
import { OAuthServiceError } from '@main/services/oauth/errors'
import type { astrainRequestSchemas } from '@shared/ipc/schemas/astrain'
import type { IpcHandlersFor } from '@shared/ipc/types'
import { SystemProviderIds } from '@shared/utils/systemProviderId'

import { runOAuthSignIn } from './oauthSignIn'

export const astrainHandlers: IpcHandlersFor<typeof astrainRequestSchemas> = {
  'astrain.sign_in': async ({ requestId, oauthServer, apiHost }, ctx) => {
    const { apiKeys } = await runOAuthSignIn(ctx.senderId, SystemProviderIds.astrain, requestId, {
      oauthServer,
      apiHost
    })
    if (!apiKeys) throw new OAuthServiceError('No API keys received')
    return { apiKeys }
  },
  'astrain.get_balance': ({ apiHost }) => astraInOAuthService.getBalance(apiHost),
  'astrain.logout': ({ apiHost }) => astraInOAuthService.logout(apiHost)
}
