import type {
  AstraMessagePart,
  AstraUIMessage,
  MessageSnapshot,
  MessageStats,
  MessageStatus
} from '@shared/data/types/message'

import type { Model } from './model'
import type { Message } from './newMessage'

export interface MessageExportView {
  id: string
  role: AstraUIMessage['role']
  assistantId?: string
  topicId: string
  createdAt: string
  updatedAt?: string
  status: MessageStatus
  modelId?: string
  model?: Model
  /** Frozen producing author (assistant/agent, model nested) — drives export headers after rename/delete. */
  messageSnapshot?: MessageSnapshot
  parentId?: string | null
  siblingsGroupId?: number
  stats?: MessageStats
  parts: AstraMessagePart[]
  /** Citable tool parts of earlier messages, so an id re-cited from a previous turn exports like it renders. */
  priorCitationParts?: readonly AstraMessagePart[]
}

// `Message` (v1) is still produced only by the v1-block-based export/copy test
// fixtures; all live producers now yield `MessageExportView`. Dropping the arm
// is gated on migrating `export.test.ts` / `copy.test.ts` off the v1 block model.
export type ExportableMessage = Message | MessageExportView
