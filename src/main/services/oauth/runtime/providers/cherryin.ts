import { net } from 'electron'

import { SystemProviderIds } from '@shared/utils/systemProviderId'

import { ApiKeysResponseSchema, ASTRAIN_CONFIG, validateAstraInApiHost } from '../../AstraInOAuthConfig'
import { OAuthServiceError } from '../../errors'
import { PkceOAuthClient } from '../PkceOAuthClient'
import type { OAuthAccount, OAuthRuntimeProviderContext, OAuthRuntimeProviderDefinition } from '../types'

export interface AstraInOAuthContext extends OAuthRuntimeProviderContext {
  oauthServer?: string
  apiHost?: string
}

export interface AstraInSignInResult extends OAuthAccount {
  apiKeys: string
}

const API_KEYS_HTTP_TIMEOUT_MS = 30_000

function resolveAstraInContext(context?: AstraInOAuthContext): { oauthServer: string; apiHost: string } {
  const oauthServer = context?.oauthServer ?? ASTRAIN_CONFIG.ALLOWED_HOSTS[0]
  validateAstraInApiHost(oauthServer)

  const apiHost = context?.apiHost ?? oauthServer
  validateAstraInApiHost(apiHost)
  return { oauthServer, apiHost }
}

async function fetchAstraInApiKeys(accessToken: string, apiHost: string): Promise<string> {
  const response = await net.fetch(`${apiHost}/api/v1/oauth/tokens`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(API_KEYS_HTTP_TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new OAuthServiceError(`Failed to fetch API keys: ${response.status}`)
  }

  const keysArray = ApiKeysResponseSchema.parse(await response.json())
  const apiKeys = keysArray.filter(Boolean).join(',')
  if (!apiKeys) {
    throw new OAuthServiceError('No API keys received')
  }
  return apiKeys
}

export const astraInOAuthProvider = {
  providerId: SystemProviderIds.astrain,
  clientId: ASTRAIN_CONFIG.CLIENT_ID,
  transport: {
    hosts: ['127.0.0.1'],
    port: ASTRAIN_CONFIG.CALLBACK_PORT,
    path: ASTRAIN_CONFIG.CALLBACK_PATH,
    redirectUri: ASTRAIN_CONFIG.REDIRECT_URI
  },
  matchesSignInContext: (current, requested) =>
    current.oauthServer === requested.oauthServer && current.apiHost === requested.apiHost,
  createClient: (context?: AstraInOAuthContext) => {
    const { oauthServer, apiHost } = resolveAstraInContext(context)
    const tokenHost = context?.oauthServer ?? apiHost
    return new PkceOAuthClient({
      clientId: ASTRAIN_CONFIG.CLIENT_ID,
      authorizeUrl: `${oauthServer}/oauth2/auth`,
      tokenUrl: `${tokenHost}/oauth2/token`,
      redirectUri: ASTRAIN_CONFIG.REDIRECT_URI,
      scope: ASTRAIN_CONFIG.SCOPES
    })
  },
  afterPersistTokens: async (tokenData, context) => {
    const { apiHost } = resolveAstraInContext(context)
    return { apiKeys: await fetchAstraInApiKeys(tokenData.access_token, apiHost) }
  }
} satisfies OAuthRuntimeProviderDefinition<AstraInOAuthContext, Pick<AstraInSignInResult, 'apiKeys'>>
