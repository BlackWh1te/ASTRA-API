import { DEFAULT_ASSISTANT_SETTINGS } from '@shared/data/types/assistant'

import { ASTRA-API_DEFAULT_UNIQUE_MODEL_ID } from './astra-api'

export const DEFAULT_ASSISTANT_NAME = 'Astra Assistant' as const
export const DEFAULT_ASSISTANT_EMOJI = '😀' as const
export const DEFAULT_ASSISTANT_PROMPT = '' as const

export function getDefaultAssistantNameForLocale(locale?: string | null): string {
  return locale?.toLowerCase().startsWith('zh') ? 'Astra 助手' : DEFAULT_ASSISTANT_NAME
}

export const DEFAULT_ASSISTANT_SEED = {
  name: DEFAULT_ASSISTANT_NAME,
  emoji: DEFAULT_ASSISTANT_EMOJI,
  prompt: DEFAULT_ASSISTANT_PROMPT,
  description: '',
  modelId: ASTRA-API_DEFAULT_UNIQUE_MODEL_ID,
  settings: DEFAULT_ASSISTANT_SETTINGS
} as const
