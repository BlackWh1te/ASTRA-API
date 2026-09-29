/**
 * Unit tests for `finalizeInterruptedParts` — the listener runs this helper
 * over `finalMessage.parts` before composing stats and calling a backend, so
 * an interrupted or errored turn does not leave a part stuck in a non-terminal
 * (in-progress) state.
 *
 * The function is pure, so it is tested directly with no mocks.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AstraMessagePart } from '@shared/data/types/message'

import { dropEmptyContentParts, finalizeInterruptedParts, stripTransientStatusParts } from '../PersistenceBackend'

// AI SDK tool-call UIMessagePart shapes. The non-terminal states the helper
// targets are anything NOT in {output-available, output-error, output-denied}.
function inProgressToolPart(state: 'input-streaming' | 'input-available'): AstraMessagePart {
  return {
    type: 'tool-search',
    toolCallId: 'tc-1',
    toolName: 'search',
    state,
    input: { q: 'hello' }
  } as unknown as AstraMessagePart
}

function inProgressDynamicToolPart(): AstraMessagePart {
  return {
    type: 'dynamic-tool',
    toolCallId: 'tc-dyn',
    toolName: 'mcp_tool',
    state: 'input-available',
    input: { foo: 'bar' }
  } as unknown as AstraMessagePart
}

const textPart = (text: string): AstraMessagePart => ({ type: 'text', text }) as unknown as AstraMessagePart

describe('finalizeInterruptedParts', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parts unchanged (by reference) on success', () => {
    const parts: AstraMessagePart[] = [textPart('hi'), inProgressToolPart('input-available')]

    const result = finalizeInterruptedParts(parts, 'success')

    // success short-circuits: same array, untouched in-progress tool part.
    expect(result).toBe(parts)
  })

  describe("status='paused' (interrupted by user)", () => {
    it('rewrites an in-progress tool part to output-error with the paused reason', () => {
      const parts: AstraMessagePart[] = [inProgressToolPart('input-available')]

      const result = finalizeInterruptedParts(parts, 'paused')

      expect(result[0]).toMatchObject({
        type: 'tool-search',
        toolCallId: 'tc-1',
        toolName: 'search',
        state: 'output-error',
        errorText: 'Interrupted by user',
        // original fields are preserved
        input: { q: 'hello' }
      })
    })

    it('rewrites an in-progress input-streaming tool part too', () => {
      const parts: AstraMessagePart[] = [inProgressToolPart('input-streaming')]

      const result = finalizeInterruptedParts(parts, 'paused')

      expect(result[0]).toMatchObject({ state: 'output-error', errorText: 'Interrupted by user' })
    })

    it('rewrites an in-progress dynamic-tool part', () => {
      const parts: AstraMessagePart[] = [inProgressDynamicToolPart()]

      const result = finalizeInterruptedParts(parts, 'paused')

      expect(result[0]).toMatchObject({
        type: 'dynamic-tool',
        state: 'output-error',
        errorText: 'Interrupted by user'
      })
    })

    it('does not mutate the original part (returns a copy)', () => {
      const original = inProgressToolPart('input-available')
      const parts: AstraMessagePart[] = [original]

      const result = finalizeInterruptedParts(parts, 'paused')

      expect(result[0]).not.toBe(original)
      expect((original as { state: string }).state).toBe('input-available')
    })
  })

  describe("status='error' (stream errored before tool completed)", () => {
    it('rewrites an in-progress tool part to output-error with the error reason', () => {
      const parts: AstraMessagePart[] = [inProgressToolPart('input-available')]

      const result = finalizeInterruptedParts(parts, 'error')

      expect(result[0]).toMatchObject({
        state: 'output-error',
        errorText: 'Stream errored before tool completed'
      })
    })
  })

  it('leaves terminal tool parts untouched on paused/error', () => {
    const completed = {
      type: 'tool-search',
      toolCallId: 'done',
      toolName: 'search',
      state: 'output-available',
      output: { hits: 3 }
    } as unknown as AstraMessagePart
    const errored = {
      type: 'tool-search',
      toolCallId: 'err',
      toolName: 'search',
      state: 'output-error',
      errorText: 'tool blew up'
    } as unknown as AstraMessagePart
    const denied = {
      type: 'tool-fs',
      toolCallId: 'denied',
      toolName: 'fs',
      state: 'output-denied'
    } as unknown as AstraMessagePart

    const parts: AstraMessagePart[] = [completed, errored, denied]
    const result = finalizeInterruptedParts(parts, 'paused')

    // identical objects returned by reference — no rewrite of terminal states.
    expect(result[0]).toBe(completed)
    expect(result[1]).toBe(errored)
    expect(result[2]).toBe(denied)
  })

  it('preserves an existing errorText instead of overwriting with the generic reason', () => {
    const parts: AstraMessagePart[] = [
      {
        type: 'tool-search',
        toolCallId: 'x',
        toolName: 'search',
        state: 'input-available',
        errorText: 'earlier diagnostic'
      } as unknown as AstraMessagePart
    ]

    const result = finalizeInterruptedParts(parts, 'paused')

    expect(result[0]).toMatchObject({ state: 'output-error', errorText: 'earlier diagnostic' })
  })

  it('leaves non-tool parts (text/reasoning) untouched while rewriting the tool part', () => {
    const text = textPart('partial answer')
    const reasoning = { type: 'reasoning', text: 'thinking…' } as unknown as AstraMessagePart
    const parts: AstraMessagePart[] = [text, reasoning, inProgressToolPart('input-available')]

    const result = finalizeInterruptedParts(parts, 'error')

    // text + reasoning returned by reference, untouched
    expect(result[0]).toBe(text)
    expect(result[1]).toBe(reasoning)
    // only the tool part is rewritten
    expect(result[2]).toMatchObject({ state: 'output-error', errorText: 'Stream errored before tool completed' })
  })

  it('terminalizes an in-progress Agent task event when the stream errors', () => {
    const taskEvent = {
      type: 'data-agent-task-event',
      data: {
        event: 'progress',
        taskId: 'task-7',
        status: 'in_progress',
        title: 'Implementing TTS adapters'
      }
    } as unknown as AstraMessagePart

    const result = finalizeInterruptedParts([taskEvent], 'error')

    expect(result[0]).toMatchObject({
      type: 'data-agent-task-event',
      data: {
        event: 'progress',
        taskId: 'task-7',
        status: 'error',
        error: 'Stream errored before task completed'
      }
    })
    expect(result[0]).not.toBe(taskEvent)
  })

  it('keeps completed and pending Agent task events unchanged', () => {
    const completed = {
      type: 'data-agent-task-event',
      data: { event: 'notification', taskId: 'task-1', status: 'completed' }
    } as unknown as AstraMessagePart
    const pending = {
      type: 'data-agent-task-event',
      data: { event: 'started', taskId: 'task-2', status: 'pending' }
    } as unknown as AstraMessagePart

    const result = finalizeInterruptedParts([completed, pending], 'error')

    expect(result[0]).toBe(completed)
    expect(result[1]).toBe(pending)
  })

  it('rewrites a streaming reasoning part to done and calculates thinkingMs if startedAt is provided', () => {
    const baseTime = 1780913860106
    vi.spyOn(Date, 'now').mockReturnValue(baseTime)
    const startedAt = baseTime - 5000 // 5 seconds ago
    const streamingReasoning = {
      type: 'reasoning',
      text: 'thinking...',
      state: 'streaming',
      providerMetadata: {
        astra: {
          startedAt
        }
      }
    } as unknown as AstraMessagePart

    const result = finalizeInterruptedParts([streamingReasoning], 'paused')

    expect(result[0]).toMatchObject({
      type: 'reasoning',
      state: 'done'
    })
    const astraMeta = (result[0] as any).providerMetadata?.astra
    expect(astraMeta?.thinkingMs).toBe(5000)
  })

  it('rewrites a streaming reasoning part to done but leaves thinkingMs undefined if startedAt is missing', () => {
    const streamingReasoning = {
      type: 'reasoning',
      text: 'thinking...',
      state: 'streaming'
    } as unknown as AstraMessagePart

    const result = finalizeInterruptedParts([streamingReasoning], 'paused')

    expect(result[0]).toMatchObject({
      type: 'reasoning',
      state: 'done'
    })
    const astraMeta = (result[0] as any).providerMetadata?.astra
    expect(astraMeta?.thinkingMs).toBeUndefined()
  })
})

describe('stripTransientStatusParts', () => {
  const retryPart = (): AstraMessagePart =>
    ({
      type: 'data-retry',
      id: 'retry',
      data: { state: 'retrying', modelId: 'gpt-4', attempt: 2, reason: 'http 429' }
    }) as unknown as AstraMessagePart

  it('removes data-retry parts, preserving order of the rest', () => {
    const text = textPart('answer')
    const result = stripTransientStatusParts([retryPart(), text])

    expect(result).toEqual([text])
  })

  it('returns the same array reference when there is nothing to strip', () => {
    const parts: AstraMessagePart[] = [textPart('hi')]

    expect(stripTransientStatusParts(parts)).toBe(parts)
  })
})

const reasoningPart = (text: string): AstraMessagePart =>
  ({ type: 'reasoning', text, state: 'done' }) as unknown as AstraMessagePart

describe('dropEmptyContentParts', () => {
  it('drops empty and whitespace-only text parts', () => {
    const keep = textPart('answer')
    const result = dropEmptyContentParts([textPart(''), keep, textPart('   \n  ')])

    expect(result).toEqual([keep])
  })

  it('drops empty and whitespace-only reasoning parts', () => {
    const keep = reasoningPart('real thought')
    const result = dropEmptyContentParts([reasoningPart(''), keep, reasoningPart('  ')])

    expect(result).toEqual([keep])
  })

  it('keeps non-text/reasoning parts even when they look empty', () => {
    const parts: AstraMessagePart[] = [
      { type: 'data-translation', data: { content: '' } } as unknown as AstraMessagePart,
      {
        type: 'tool-search',
        toolCallId: 't',
        toolName: 'search',
        state: 'output-available',
        output: {}
      } as unknown as AstraMessagePart
    ]

    const result = dropEmptyContentParts(parts)

    expect(result).toBe(parts)
  })

  it('returns the original array by reference when nothing is dropped', () => {
    const parts: AstraMessagePart[] = [textPart('hi'), reasoningPart('thinking')]

    expect(dropEmptyContentParts(parts)).toBe(parts)
  })

  it('drops a trailing empty text part next to a reasoning part', () => {
    const reasoning = reasoningPart('deep thought')
    const result = dropEmptyContentParts([reasoning, textPart('')])

    expect(result).toEqual([reasoning])
  })
})
