










































import p_openai from './openai'
import p_openai_codex from './openai-codex'















import type { Provider } from './types'






/** Every provider, in registry order. Source of truth for data/providers.json + data/provider-models.json. */
export const PROVIDERS: Provider[] = [
  p_openai
]
