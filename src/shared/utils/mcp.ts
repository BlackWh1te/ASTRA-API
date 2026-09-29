import type { ContentBlock } from '@modelcontextprotocol/sdk/types.js'
import { ContentBlockSchema } from '@modelcontextprotocol/sdk/types.js'

import type { McpServer } from '@shared/data/types/mcpServer'

export const BuiltinMcpServerNames = {
  flomo: '@astra/flomo',
  qveris: '@astra/qveris',
  mcpAutoInstall: '@astra/mcp-auto-install',
  memory: '@astra/memory',
  sequentialThinking: '@astra/sequentialthinking',
  braveSearch: '@astra/brave-search',
  fetch: '@astra/fetch',
  filesystem: '@astra/filesystem',
  difyKnowledge: '@astra/dify-knowledge',
  python: '@astra/python',
  didiMcp: '@astra/didi-mcp',
  browser: '@astra/browser',
  nowledgeMem: '@astra/nowledge-mem',
  hub: '@astra/hub'
} as const

export type BuiltinMcpServerName = (typeof BuiltinMcpServerNames)[keyof typeof BuiltinMcpServerNames]

export const BuiltinMcpServerNamesArray = Object.values(BuiltinMcpServerNames)

export const isBuiltinMcpServerName = (name: string): name is BuiltinMcpServerName => {
  return BuiltinMcpServerNamesArray.some((n) => n === name)
}

export type BuiltinMcpServer = McpServer & {
  type: 'inMemory' | 'stdio'
  name: BuiltinMcpServerName
}

export const isInMemoryBuiltinMcpServer = (server: McpServer): server is BuiltinMcpServer & { type: 'inMemory' } => {
  return server.type === 'inMemory' && isBuiltinMcpServerName(server.name)
}

export const isBrowserMcpServer = (server: Pick<McpServer, 'type' | 'name'>): boolean =>
  server.type === 'inMemory' && server.name === BuiltinMcpServerNames.browser

/**
 * Spec-aligned guard for a single MCP `CallToolResult` content block
 * (text / image / audio / resource_link / embedded resource).
 */
export const isMcpContentBlock = (value: unknown): value is ContentBlock => {
  return ContentBlockSchema.safeParse(value).success
}
