/**
 * Filter that gates the model picker shown to an agent.
 *
 * Each runtime contributes its compatibility predicate through the shared
 * capability matrix. Claude Code uses the API Gateway's routability predicate;
 * Pi additionally validates that its provider wire protocol is supported.
 *
 * Default `null`-typed agents fall through to the shared "agent-friendly"
 * filter (drops embedding / rerank / image-generation models — none of
 * those make sense as chat targets).
 */

import { useMemo } from 'react'
import useSWR from 'swr'

import { ipcApi, useIpcOn } from '@renderer/ipc'
import { AGENT_RUNTIME_CAPABILITIES } from '@shared/ai/agentRuntimeCapabilities'
import { isManagedAstraCloudModel } from '@shared/data/presets/astra-api'
import type { AgentType } from '@shared/data/types/agent'
import type { Model } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'
import { isNonChatModel } from '@shared/utils/model'

const baseAgentFilter = (model: Model): boolean => !isNonChatModel(model)
const ASTRA_CLOUD_AVAILABILITY_KEY = 'astra-cloud/model-availability'
const ASTRA_CLOUD_AVAILABILITY_REFRESH_INTERVAL_MS = 60_000
const EMPTY_ASTRA_CLOUD_AVAILABILITY = {
  entitledModelIds: [],
  quotaExhaustedModelIds: []
}

type ModelPredicate = (model: Model, provider?: Provider) => boolean

/**
 * Returns a memoized `(model) => boolean` predicate that matches the agent's
 * runtime constraints. Pair with `<ModelSelector filter={...}>`.
 */
export function useAgentModelFilter(agentType: AgentType | undefined): ModelPredicate {
  return useMemo<ModelPredicate>(() => {
    const caps = agentType ? AGENT_RUNTIME_CAPABILITIES[agentType] : undefined
    return (model, provider) => {
      if (!baseAgentFilter(model)) return false
      return !caps?.isModelCompatible || caps.isModelCompatible(provider, model)
    }
  }, [agentType])
}

/** Returns the Agent selector rule for models that stay visible but cannot be selected. */
export function useAgentModelDisabled(enabled = true): ModelPredicate {
  const { data: cloudAvailability, mutate } = useSWR(
    enabled ? ASTRA_CLOUD_AVAILABILITY_KEY : null,
    () => ipcApi.request('astra_cloud.models.sync'),
    {
      dedupingInterval: 5_000,
      refreshInterval: ASTRA_CLOUD_AVAILABILITY_REFRESH_INTERVAL_MS,
      revalidateOnReconnect: false,
      shouldRetryOnError: false
    }
  )

  useIpcOn('astra_cloud.status_changed', () => {
    if (!enabled) return
    void mutate(EMPTY_ASTRA_CLOUD_AVAILABILITY, { revalidate: true }).catch(() => undefined)
  })

  return useMemo(() => {
    const entitledModelIds = new Set(cloudAvailability?.entitledModelIds)
    const quotaExhaustedModelIds = new Set(cloudAvailability?.quotaExhaustedModelIds)
    return (model: Model) =>
      isManagedAstraCloudModel(model.providerId) &&
      (!cloudAvailability || !entitledModelIds.has(model.id) || quotaExhaustedModelIds.has(model.id))
  }, [cloudAvailability])
}
