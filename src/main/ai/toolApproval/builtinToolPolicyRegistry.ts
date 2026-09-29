/**
 * Runtime-neutral approval policy for Astra-owned MCP tools.
 *
 * This is a registry of tool entries, not parallel allow/approval name lists. Each tool declares
 * its canonical MCP identity and approval behavior once; Claude, Pi, and DSH only translate that
 * identity into their runtime-specific wire names. Arrays or sets produced by consumers are
 * derived boundary formats for the SDK/bridge and are never policy sources.
 *
 * This deliberately does not extend the AI-SDK `ToolEntry`: that adapter does not own or even see
 * every Astra-owned tool (Assistant MCP and the other agent runtimes bypass it). Cross-runtime
 * approval is a security policy and belongs in the runtime-neutral approval layer.
 */

import { CLI_INSTALL_TOOL_NAME, CLI_LIST_TOOL_NAME, CLI_SEARCH_TOOL_NAME } from '@main/ai/mcp/servers/astraCliTools'
import { MOVE_TO_TRASH_TOOL_NAME } from '@main/ai/tools/moveToTrash'
import { SAVE_ATTACHMENT_TOOL_NAME } from '@main/ai/tools/saveAttachment'
import {
  SESSION_CREATE_TOOL_NAME,
  SESSION_DELIVERIES_TOOL_NAME,
  SESSION_LIST_TOOL_NAME,
  SESSION_READ_TOOL_NAME,
  SESSION_SEARCH_TOOL_NAME,
  SESSION_SEND_TOOL_NAME
} from '@shared/ai/agentSessionDelivery'
import {
  CONFIG_TOOL_NAME,
  CRON_TOOL_NAME,
  GENERATE_IMAGE_TOOL_NAME,
  KB_LIST_TOOL_NAME,
  KB_MANAGE_TOOL_NAME,
  KB_READ_TOOL_NAME,
  KB_SEARCH_TOOL_NAME,
  NOTIFY_TOOL_NAME,
  READ_FILE_TOOL_NAME,
  REPORT_ARTIFACTS_TOOL_NAME,
  TO_MARKDOWN_TOOL_NAME,
  WEB_FETCH_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME
} from '@shared/ai/builtinTools'

import { listBrowserToolPolicies } from './browserToolPolicy'

export type BuiltinToolApproval = 'auto' | 'required' | 'runtime'
export type BuiltinToolBypassApproval = 'lift' | 'enforce'

/** The Astra-owned MCP servers. Which of them a session mounts is the runtime's call. */
export const ASTRA_MCP_SERVER = {
  ASTRA_TOOLS: 'astra-tools',
  BROWSER: 'browser',
  AGENT_MEMORY: 'agent-memory',
  SKILLS: 'skills',
  MCP_MANAGER: 'mcp-manager',
  ASSISTANT: 'assistant',
  ASSISTANT_FILES: 'assistant-files'
} as const

export interface BuiltinToolPolicyEntry {
  readonly serverName: string
  readonly toolName: string
  /**
   * `auto`: Astra pre-approves the tool; `required`: every interactive call asks unless bypassed;
   * `runtime`: the runtime's ordinary permission-mode semantics decide.
   */
  readonly approval: BuiltinToolApproval
  /** Whether Full Access lifts a `required` approval. */
  readonly bypassApproval: BuiltinToolBypassApproval
}

function tool(
  serverName: string,
  toolName: string,
  approval: BuiltinToolApproval,
  bypassApproval: BuiltinToolBypassApproval = 'lift'
): BuiltinToolPolicyEntry {
  return { serverName, toolName, approval, bypassApproval }
}

/**
 * Every Astra-owned MCP tool with host approval semantics. A future tool must declare one entry;
 * omitting it is fail-closed for auto-approval because every consumer selects explicit entries.
 */
const BUILTIN_TOOL_POLICIES = {
  astraWebSearch: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, WEB_SEARCH_TOOL_NAME, 'auto'),
  astraWebFetch: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, WEB_FETCH_TOOL_NAME, 'auto'),
  astraKnowledgeSearch: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, KB_SEARCH_TOOL_NAME, 'auto'),
  astraKnowledgeRead: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, KB_READ_TOOL_NAME, 'auto'),
  astraKnowledgeList: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, KB_LIST_TOOL_NAME, 'auto'),
  astraKnowledgeManage: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, KB_MANAGE_TOOL_NAME, 'required'),
  astraReportArtifacts: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, REPORT_ARTIFACTS_TOOL_NAME, 'auto'),
  astraCron: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, CRON_TOOL_NAME, 'auto'),
  astraNotify: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, NOTIFY_TOOL_NAME, 'auto'),
  astraConfig: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, CONFIG_TOOL_NAME, 'auto'),
  astraSessionList: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, SESSION_LIST_TOOL_NAME, 'auto'),
  astraSessionSearch: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, SESSION_SEARCH_TOOL_NAME, 'auto'),
  astraSessionRead: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, SESSION_READ_TOOL_NAME, 'auto'),
  astraAgentList: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, 'agent_list', 'auto'),
  astraSessionDeliveries: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, SESSION_DELIVERIES_TOOL_NAME, 'auto'),
  astraSessionCreate: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, SESSION_CREATE_TOOL_NAME, 'required', 'enforce'),
  astraSessionSend: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, SESSION_SEND_TOOL_NAME, 'required', 'enforce'),
  astraCliList: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, CLI_LIST_TOOL_NAME, 'auto'),
  astraCliSearch: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, CLI_SEARCH_TOOL_NAME, 'auto'),
  astraCliInstall: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, CLI_INSTALL_TOOL_NAME, 'required'),
  astraToMarkdown: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, TO_MARKDOWN_TOOL_NAME, 'auto'),
  astraGenerateImage: tool(ASTRA_MCP_SERVER.ASTRA_TOOLS, GENERATE_IMAGE_TOOL_NAME, 'required'),

  agentMemory: tool(ASTRA_MCP_SERVER.AGENT_MEMORY, 'memory', 'auto'),
  searchSkills: tool(ASTRA_MCP_SERVER.SKILLS, 'search_skills', 'auto'),
  installSkill: tool(ASTRA_MCP_SERVER.SKILLS, 'install_skill', 'runtime'),
  // A stdio install launches an arbitrary local command with the caller's env, so this asks per call
  // like cli_install rather than deferring to the runtime's permission mode.
  installMcpServer: tool(ASTRA_MCP_SERVER.MCP_MANAGER, 'install_mcp_server', 'required'),

  assistantNavigate: tool(ASTRA_MCP_SERVER.ASSISTANT, 'navigate', 'auto'),
  assistantProductInfo: tool(ASTRA_MCP_SERVER.ASSISTANT, 'product_info', 'auto'),
  assistantDiagnose: tool(ASTRA_MCP_SERVER.ASSISTANT, 'diagnose', 'required'),
  assistantApplySetting: tool(ASTRA_MCP_SERVER.ASSISTANT, 'apply_setting', 'required'),
  assistantCreateAgent: tool(ASTRA_MCP_SERVER.ASSISTANT, 'create_agent', 'required'),
  assistantPrepareDiagnosticReport: tool(ASTRA_MCP_SERVER.ASSISTANT, 'prepare_diagnostic_report', 'auto'),
  assistantReadFile: tool(ASTRA_MCP_SERVER.ASSISTANT_FILES, READ_FILE_TOOL_NAME, 'auto'),
  assistantMoveToTrash: tool(ASTRA_MCP_SERVER.ASSISTANT_FILES, MOVE_TO_TRASH_TOOL_NAME, 'required'),
  assistantSaveAttachment: tool(ASTRA_MCP_SERVER.ASSISTANT_FILES, SAVE_ATTACHMENT_TOOL_NAME, 'required')
} as const satisfies Record<string, BuiltinToolPolicyEntry>

export const BUILTIN_TOOL_POLICY_ENTRIES: readonly BuiltinToolPolicyEntry[] = Object.values(BUILTIN_TOOL_POLICIES)
export const MOUNTED_TOOL_POLICY_PROVIDERS: ReadonlyMap<string, () => BuiltinToolPolicyEntry[]> = new Map([
  [ASTRA_MCP_SERVER.BROWSER, listBrowserToolPolicies]
])
