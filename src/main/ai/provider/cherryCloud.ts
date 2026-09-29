import { application } from '@application'
import { ASTRA_CLOUD_PROVIDER_ID } from '@shared/data/presets/astra-api'
import { ENDPOINT_TYPE, type EndpointType } from '@shared/data/types/model'

import type { ProviderConfig } from '../types'

const ASTRA_CLOUD_MESSAGES_PATH = '/v1/messages'
const ASTRA_CLOUD_CHAT_COMPLETIONS_PATH = '/v1/chat/completions'
const SDK_API_KEY_PLACEHOLDER = 'managed-by-astra-cloud'
const UNSAFE_FORWARD_HEADERS = new Set([
  'authorization',
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-api-key',
  'x-astra-agent-session-id',
  'x-astra-fast-mode',
  'x-astra-internal-request-token',
  'x-astra-internal-usage-token'
])

function forwardedHeaders(source: Headers): Headers {
  const headers = new Headers()
  for (const [name, value] of source) {
    const normalizedName = name.toLowerCase()
    if (UNSAFE_FORWARD_HEADERS.has(normalizedName) || normalizedName.startsWith('sec-fetch-')) continue
    headers.append(name, value)
  }
  return headers
}

export function buildAstraCloudProviderConfig(
  endpointType: EndpointType | undefined,
  endpoint?: string
): ProviderConfig {
  const service = application.get('AstraCloudService')
  const apiOrigin = new URL(service.getApiOrigin()).origin
  const requestPath =
    endpointType === ENDPOINT_TYPE.ANTHROPIC_MESSAGES
      ? ASTRA_CLOUD_MESSAGES_PATH
      : endpointType === ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS
        ? ASTRA_CLOUD_CHAT_COMPLETIONS_PATH
        : undefined
  if (!requestPath) throw new Error(`Unsupported Astra Cloud endpoint type: ${endpointType ?? 'undefined'}`)

  const providerSettings = {
    apiKey: SDK_API_KEY_PLACEHOLDER,
    baseURL: new URL('/v1', `${apiOrigin}/`).toString(),
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      const url = new URL(request.url)
      if (url.origin !== apiOrigin || url.pathname !== requestPath) {
        throw new Error('Astra Cloud requests must stay on the configured Astra Cloud API origin')
      }

      return service.authenticatedFetch(`${url.pathname}${url.search}`, {
        method: request.method,
        headers: forwardedHeaders(request.headers),
        body: request.body ? await request.text() : undefined,
        signal: request.signal
      })
    }
  }

  if (endpointType === ENDPOINT_TYPE.ANTHROPIC_MESSAGES) {
    return { providerId: 'anthropic', endpoint, providerSettings }
  }
  return {
    providerId: 'openai-compatible',
    endpoint,
    providerSettings: { ...providerSettings, name: ASTRA_CLOUD_PROVIDER_ID, includeUsage: true }
  }
}
