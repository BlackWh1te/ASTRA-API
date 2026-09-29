import {
  type BranchMessage,
  type AstraMessagePart,
  type AstraUIMessage,
  type Message as SharedMessage,
  toContentRole
} from '@shared/data/types/message'
import { isBlankUserTurn } from '@shared/data/types/uiParts'

export function sharedMessageToUIMessage(shared: SharedMessage): AstraUIMessage {
  return {
    id: shared.id,
    role: toContentRole(shared.role),
    parts: shared.data?.parts ?? [],
    metadata: {
      parentId: shared.parentId,
      siblingsGroupId: shared.siblingsGroupId || undefined,
      modelId: shared.modelId ?? undefined,
      modelSelection: shared.data.modelSelection,
      messageSnapshot: shared.messageSnapshot ?? undefined,
      status: shared.status,
      turnOptions: shared.data.turnOptions,
      createdAt: shared.createdAt,
      stats: shared.stats ?? undefined,
      ...(shared.stats?.totalTokens ? { totalTokens: shared.stats.totalTokens } : {})
    }
  }
}

export function isRenderableConversationMessage(message: AstraUIMessage): boolean {
  return !isBlankUserTurn({ role: message.role, status: message.metadata?.status, parts: message.parts })
}

export function uiMessagesToPartsMap(messages: AstraUIMessage[]): Record<string, AstraMessagePart[]> {
  const map: Record<string, AstraMessagePart[]> = {}
  for (const message of messages) {
    if (message.parts.length > 0) {
      map[message.id] = message.parts
    }
  }
  return map
}

export function branchMessagesToFullUIMessages(branchItems: BranchMessage[]): AstraUIMessage[] {
  const messages: AstraUIMessage[] = []
  const seen = new Set<string>()

  const pushMessage = (message: SharedMessage) => {
    if (seen.has(message.id)) return
    seen.add(message.id)
    messages.push(sharedMessageToUIMessage(message))
  }

  for (const item of branchItems) {
    if (!item.siblingsGroup?.length) {
      pushMessage(item.message)
      continue
    }

    const group = [item.message, ...item.siblingsGroup].sort((a, b) => {
      const timeCompare = a.createdAt.localeCompare(b.createdAt)
      return timeCompare === 0 ? a.id.localeCompare(b.id) : timeCompare
    })
    group.forEach(pushMessage)
  }

  return messages
}
