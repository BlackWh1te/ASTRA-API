import * as z from 'zod'

export const ASTRAIN_CONFIG = {
  CLIENT_ID: '2a348c87-bae1-4756-a62f-b2e97200fd6d',
  ALLOWED_HOSTS: ['https://open.astrain.ai', 'https://open.astrain.dev'],
  REDIRECT_URI: 'http://127.0.0.1:29873/oauth/callback',
  CALLBACK_PORT: 29873,
  CALLBACK_PATH: '/oauth/callback',
  SCOPES: 'openid profile email offline_access balance:read usage:read tokens:read tokens:write'
} as const

export class AstraInOAuthServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'AstraInOAuthServiceError'
  }
}

export function validateAstraInApiHost(apiHost: string): void {
  if (!(ASTRAIN_CONFIG.ALLOWED_HOSTS as readonly string[]).includes(apiHost)) {
    throw new AstraInOAuthServiceError(`Unauthorized API host: ${apiHost}`)
  }
}

const ApiKeyItemSchema = z
  .union([z.string(), z.object({ key: z.string() }), z.object({ token: z.string() })])
  .transform((item): string => {
    if (typeof item === 'string') return item
    if ('key' in item) return item.key
    return item.token
  })

export const ApiKeysResponseSchema = z
  .union([z.array(ApiKeyItemSchema), z.object({ data: z.array(ApiKeyItemSchema) })])
  .transform((data): string[] => (Array.isArray(data) ? data : data.data))
