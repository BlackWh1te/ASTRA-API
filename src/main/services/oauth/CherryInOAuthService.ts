import { net } from 'electron'
import * as z from 'zod'

import { application } from '@application'
import { loggerService } from '@logger'
import type { AstraInBalance, AstraInProfile } from '@shared/ipc/schemas/astrain'
import { isSensitiveKey, REDACTED, redactSecretText } from '@shared/utils/redaction'
import { SystemProviderIds } from '@shared/utils/systemProviderId'

import { AstraInOAuthServiceError, validateAstraInApiHost } from './AstraInOAuthConfig'
import { describeOAuthError, OAuthTransientError } from './errors'

const logger = loggerService.withContext('AstraInOAuthService')

const BalanceDataSchema = z.object({
  quota: z.number(),
  used_quota: z.number()
})

const BalanceResponseSchema = z.object({
  success: z.boolean(),
  data: BalanceDataSchema
})

const UserSelfProfileSchema = z.object({
  display_name: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  group: z.string().optional().nullable()
})

const UserSelfResponseSchema = z
  .union([
    z
      .object({ data: UserSelfProfileSchema.nullable() })
      .passthrough()
      .transform((payload) => payload.data),
    UserSelfProfileSchema.transform((profile) => profile)
  ])
  .transform((payload): AstraInProfile | null => {
    const profile = payload

    if (!profile) {
      return null
    }

    return {
      displayName: profile.display_name ?? null,
      username: profile.username ?? null,
      email: profile.email ?? null,
      group: profile.group ?? null
    }
  })

/**
 * AstraIN's REST operations (balance/profile/logout) layered over the OAuth
 * session that `OAuthRuntimeService` owns. Stateless orchestration — owns no
 * long-lived resources and registers no side effects — so it is a direct-import
 * singleton, not a lifecycle service (see lifecycle-decision-guide.md).
 */
export class AstraInOAuthService {
  private validateApiHost(apiHost: string): void {
    validateAstraInApiHost(apiHost)
  }

  public getToken = async (apiHost = 'https://open.astrain.ai'): Promise<string | null> => {
    this.validateApiHost(apiHost)
    try {
      const credentials = await application
        .get('OAuthRuntimeService')
        .getValidAccessToken(SystemProviderIds.astrain, { apiHost })
      return credentials?.accessToken ?? null
    } catch (error) {
      // A transient refresh failure means the session is still valid but we
      // can't produce a token right now. The sole caller is logout, which must
      // still clear the local session — treat it as "no token to revoke".
      if (error instanceof OAuthTransientError) {
        logger.debug('AstraIN token temporarily unavailable, skipping remote revoke', describeOAuthError(error))
        return null
      }
      throw error
    }
  }

  // OAuth's `code` is sensitive in text but must not redact JSON keys globally — scope it here.
  private redactDiagnosticValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return redactSecretText(value, ['code'])
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redactDiagnosticValue(item))
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          isSensitiveKey(key) ? REDACTED : this.redactDiagnosticValue(item)
        ])
      )
    }

    return value
  }

  private readResponseBodyForDiagnostics = async (response: Response): Promise<unknown> => {
    if (typeof response.clone !== 'function') {
      return null
    }

    try {
      const text = await response.clone().text()
      if (!text) {
        return null
      }

      try {
        return this.redactDiagnosticValue(JSON.parse(text))
      } catch {
        return this.redactDiagnosticValue(text)
      }
    } catch (error) {
      logger.warn('Failed to read AstraIN error response body for diagnostics:', error as Error)
      return null
    }
  }

  private logUnauthorizedResponse = async (
    apiHost: string,
    endpoint: string,
    response: Response,
    requestOptions: RequestInit
  ): Promise<void> => {
    logger.error('AstraIN request returned 401 Unauthorized', {
      stage: endpoint,
      request: {
        url: `${apiHost}${endpoint}`,
        method: requestOptions.method ?? 'GET',
        headers: this.redactDiagnosticValue(requestOptions.headers ?? {}),
        body: requestOptions.body ? this.redactDiagnosticValue(String(requestOptions.body)) : null
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: {},
        body: await this.readResponseBodyForDiagnostics(response)
      }
    })
  }

  // Token fetch, the not-signed-in guard and the 401 force-refresh+retry live in
  // OAuthRuntimeService.authenticatedFetch (shared with Codex/Grok). AstraIN only
  // shapes the request (apiHost + bearer/json headers), threads its `apiHost`
  // context for refresh, and supplies the 401 diagnostic log.
  private authenticatedFetch = (apiHost: string, endpoint: string, options: RequestInit = {}): Promise<Response> => {
    return application.get('OAuthRuntimeService').authenticatedFetch(
      SystemProviderIds.astrain,
      (creds) => ({
        input: `${apiHost}${endpoint}`,
        init: {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      }),
      (input, init) => net.fetch(input as RequestInfo, init),
      {
        context: { apiHost },
        notSignedInMessage: 'OAuth session expired: failed to refresh access token',
        onUnauthorized: (response) =>
          this.logUnauthorizedResponse(apiHost, endpoint, response, {
            ...options,
            headers: {
              ...options.headers,
              Authorization: 'Bearer <redacted>',
              'Content-Type': 'application/json'
            }
          })
      }
    )
  }

  private getProfile = async (apiHost: string): Promise<AstraInProfile | null> => {
    try {
      const response = await this.authenticatedFetch(apiHost, '/api/user/self')

      if (!response.ok) {
        logger.warn('Failed to fetch AstraIN profile', {
          status: response.status,
          statusText: response.statusText,
          body: await this.readResponseBodyForDiagnostics(response)
        })
        return null
      }

      const json = await response.json()
      return UserSelfResponseSchema.parse(json)
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Failed to parse AstraIN profile response:', error.issues)
      } else {
        logger.warn('Failed to fetch AstraIN profile:', error as Error)
      }
      return null
    }
  }

  public getBalance = async (apiHost: string): Promise<AstraInBalance> => {
    this.validateApiHost(apiHost)

    try {
      const response = await this.authenticatedFetch(apiHost, '/api/v1/oauth/balance')

      if (!response.ok) {
        throw new AstraInOAuthServiceError(`HTTP ${response.status} ${response.statusText} from /api/v1/oauth/balance`)
      }

      const json = await response.json()
      logger.debug('Balance API raw response:', json)
      const parsed = BalanceResponseSchema.parse(json)

      if (!parsed.success) {
        throw new AstraInOAuthServiceError('API returned success: false')
      }

      const { quota, used_quota: usedQuota } = parsed.data
      const profile = await this.getProfile(apiHost)
      const balance = quota / 500000
      logger.info('Balance fetched successfully', { balance, usedQuota })
      return {
        balance,
        profile
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Invalid balance response format:', error.issues)
        throw new AstraInOAuthServiceError('Invalid response format from server', error)
      }
      logger.error('Failed to get balance:', error as Error)
      const detail = error instanceof Error && error.message ? `: ${error.message}` : ''
      throw new AstraInOAuthServiceError(`Failed to get balance${detail}`, error)
    }
  }

  public logout = async (apiHost: string): Promise<void> => {
    this.validateApiHost(apiHost)

    try {
      const token = await this.getToken(apiHost)

      if (token) {
        try {
          await net.fetch(`${apiHost}/oauth2/revoke`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              token,
              token_type_hint: 'access_token'
            }).toString()
          })
          logger.debug('Successfully revoked token on server')
        } catch (revokeError) {
          logger.warn('Failed to revoke token on server:', revokeError as Error)
        }
      }

      await application.get('OAuthRuntimeService').logout(SystemProviderIds.astrain)
      logger.debug('Successfully cleared AstraIN OAuth tokens from auth config')
    } catch (error) {
      logger.error('Failed to logout:', error as Error)
      throw new AstraInOAuthServiceError('Failed to logout', error)
    }
  }
}

export const astraInOAuthService = new AstraInOAuthService()
