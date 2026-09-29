import type { ReasoningUIPart, TextUIPart } from 'ai'
import { describe, expect, it } from 'vitest'

import type { AstraMessagePart } from '../message'
import {
  AstraErrorMetaSchema,
  AstraFileMetaSchema,
  AstraReasoningMetaSchema,
  AstraTextMetaSchema,
  AstraToolMetaSchema,
  createClearContextPart,
  type DiagnosisResult,
  getKnowledgeBaseIdsFromParts,
  hasClearContextPart,
  isBlankUserTurn,
  KnowledgeScopePartDataSchema,
  readAstraMeta,
  withAstraMeta,
  withKnowledgeScopePart
} from '../uiParts'

const diagnosis: DiagnosisResult = {
  summary: 'OpenAI API key is invalid',
  category: 'auth',
  explanation: 'The server rejected the request because the key is invalid.',
  steps: [{ text: 'Open provider settings and check the key' }]
}

function dataErrorPart(astra?: Record<string, unknown>): Extract<AstraMessagePart, { type: 'data-error' }> {
  return {
    type: 'data-error',
    data: { name: 'AuthError', message: 'Unauthorized' },
    ...(astra ? { providerMetadata: { astra } } : {})
  } as unknown as Extract<AstraMessagePart, { type: 'data-error' }>
}

// ============================================================================
// Schema sanity — declared shape matches expectation
// ============================================================================

describe('AstraTextMetaSchema', () => {
  it('accepts references as array of anything', () => {
    expect(AstraTextMetaSchema.safeParse({ references: [{ category: 'citation' }] }).success).toBe(true)
    expect(AstraTextMetaSchema.safeParse({}).success).toBe(true)
  })
  it('rejects references that is not an array', () => {
    expect(AstraTextMetaSchema.safeParse({ references: 'not-an-array' }).success).toBe(false)
  })
})

describe('AstraReasoningMetaSchema', () => {
  it('accepts thinkingMs as number', () => {
    expect(AstraReasoningMetaSchema.safeParse({ thinkingMs: 1234 }).success).toBe(true)
  })
  it('accepts startedAt as number', () => {
    expect(AstraReasoningMetaSchema.safeParse({ startedAt: 1780913860106 }).success).toBe(true)
  })
  it('rejects thinkingMs that is not a number', () => {
    expect(AstraReasoningMetaSchema.safeParse({ thinkingMs: '1234' }).success).toBe(false)
  })
})

describe('AstraToolMetaSchema', () => {
  it('accepts transport/toolName/tool', () => {
    const ok = AstraToolMetaSchema.safeParse({
      transport: 'claude-agent',
      toolName: 'web_search',
      tool: { serverId: 's1', serverName: 'search', type: 'mcp' }
    })
    expect(ok.success).toBe(true)
  })
  it('rejects tool.type outside the enum', () => {
    const bad = AstraToolMetaSchema.safeParse({ tool: { type: 'pluggable' } })
    expect(bad.success).toBe(false)
  })
})

describe('AstraFileMetaSchema', () => {
  it('accepts fileEntryId, fileTokenSourceId, and the safe composer file kind', () => {
    const ok = AstraFileMetaSchema.safeParse({
      fileEntryId: 'entry-1',
      fileTokenSourceId: 'source-1',
      composerFileKind: 'pasted-text'
    })

    expect(ok.success).toBe(true)
  })

  it('rejects non-string fileTokenSourceId', () => {
    const bad = AstraFileMetaSchema.safeParse({ fileTokenSourceId: 1 })

    expect(bad.success).toBe(false)
  })

  it('rejects unsupported composer file kinds', () => {
    const bad = AstraFileMetaSchema.safeParse({ composerFileKind: 'local-path' })

    expect(bad.success).toBe(false)
  })
})

describe('AstraErrorMetaSchema', () => {
  it('accepts a fully-formed diagnosis and an empty object', () => {
    expect(AstraErrorMetaSchema.safeParse({ diagnosis }).success).toBe(true)
    expect(AstraErrorMetaSchema.safeParse({}).success).toBe(true)
  })

  it('rejects a diagnosis with a non-string summary', () => {
    expect(AstraErrorMetaSchema.safeParse({ diagnosis: { ...diagnosis, summary: 42 } }).success).toBe(false)
  })

  it('rejects a diagnosis whose steps are not step objects', () => {
    expect(AstraErrorMetaSchema.safeParse({ diagnosis: { ...diagnosis, steps: ['plain'] } }).success).toBe(false)
  })
})

describe('knowledge scope parts', () => {
  it('validates, deduplicates, and replaces the aggregate scope part', () => {
    const parts = withKnowledgeScopePart(
      [
        { type: 'text', text: 'hello' },
        { type: 'data-knowledge-scope', data: { baseIds: ['old'] } }
      ] as AstraMessagePart[],
      ['kb-1', 'kb-2', 'kb-1']
    )

    expect(parts).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'data-knowledge-scope', data: { baseIds: ['kb-1', 'kb-2'] } }
    ])
    expect(getKnowledgeBaseIdsFromParts(parts)).toEqual(['kb-1', 'kb-2'])
  })

  it('removes the scope part when the selection is empty', () => {
    const parts = withKnowledgeScopePart(
      [
        { type: 'text', text: 'hello' },
        { type: 'data-knowledge-scope', data: { baseIds: ['kb-1'] } }
      ] as AstraMessagePart[],
      []
    )

    expect(parts).toEqual([{ type: 'text', text: 'hello' }])
    expect(getKnowledgeBaseIdsFromParts(parts)).toBeUndefined()
  })

  it('rejects malformed scope data at the read boundary', () => {
    expect(KnowledgeScopePartDataSchema.safeParse({ baseIds: [''] }).success).toBe(false)
    expect(
      getKnowledgeBaseIdsFromParts([
        { type: 'data-knowledge-scope', data: { baseIds: [42] } } as unknown as AstraMessagePart
      ])
    ).toBeUndefined()
  })
})

describe('clear context parts', () => {
  it('creates and detects a hidden data UI part', () => {
    const part = createClearContextPart()

    expect(part).toEqual({ type: 'data-clear', data: {} })
    expect(hasClearContextPart([{ type: 'text', text: 'before' }, part])).toBe(true)
    expect(hasClearContextPart([{ type: 'text', text: 'before' }])).toBe(false)
    expect(hasClearContextPart(undefined)).toBe(false)
  })
})

describe('blank user turns', () => {
  it('requires a successful user role with no parts', () => {
    expect(isBlankUserTurn({ role: 'user', status: 'success', parts: [] })).toBe(true)
    expect(isBlankUserTurn({ role: 'assistant', status: 'success', parts: [] })).toBe(false)
    expect(isBlankUserTurn({ role: 'user', status: 'pending', parts: [] })).toBe(false)
    expect(isBlankUserTurn({ role: 'user', status: 'success', parts: [{ type: 'text' }] })).toBe(false)
  })
})

// ============================================================================
// readAstraMeta — runtime validation + narrowing
// ============================================================================

describe('readAstraMeta', () => {
  it('reads AstraTextMeta from a TextUIPart with references', () => {
    const part: TextUIPart = {
      type: 'text',
      text: 'hi',
      providerMetadata: { astra: { references: [{ category: 'citation' }] } }
    }
    const meta = readAstraMeta(part)
    expect(meta?.references).toEqual([{ category: 'citation' }])
  })

  it('reads AstraReasoningMeta from a ReasoningUIPart with thinking metadata', () => {
    const part: ReasoningUIPart = {
      type: 'reasoning',
      text: 'thinking...',
      providerMetadata: { astra: { thinkingMs: 5000, startedAt: 1780913860106 } }
    }
    const meta = readAstraMeta(part)
    expect(meta?.thinkingMs).toBe(5000)
    expect(meta?.startedAt).toBe(1780913860106)
  })

  it('reads AstraToolMeta from a tool-foo part with transport and tool', () => {
    const part = {
      type: 'tool-fetch_url',
      toolCallId: 'tc1',
      providerMetadata: {
        astra: { transport: 'claude-agent', tool: { serverId: 's1', type: 'mcp' as const } }
      }
    } as unknown as AstraMessagePart
    const meta = readAstraMeta(part)
    expect(meta).toEqual({
      transport: 'claude-agent',
      tool: { serverId: 's1', type: 'mcp' }
    })
  })

  it('reads AstraToolMeta from a dynamic-tool part', () => {
    const part = {
      type: 'dynamic-tool',
      toolName: 'x',
      toolCallId: 'tc2',
      providerMetadata: { astra: { transport: 'claude-agent' } }
    } as unknown as Extract<AstraMessagePart, { type: 'dynamic-tool' }>
    expect(readAstraMeta(part)?.transport).toBe('claude-agent')
  })

  it('reads AstraFileMeta from a file part with token source id', () => {
    const part = {
      type: 'file',
      mediaType: 'application/pdf',
      url: 'file:///tmp/report.pdf',
      filename: 'report.pdf',
      providerMetadata: {
        astra: { fileEntryId: 'entry-1', fileTokenSourceId: 'source-1', composerFileKind: 'pasted-text' }
      }
    } as unknown as Extract<AstraMessagePart, { type: 'file' }>

    expect(readAstraMeta(part)).toEqual({
      fileEntryId: 'entry-1',
      fileTokenSourceId: 'source-1',
      composerFileKind: 'pasted-text'
    })
  })

  it('reads AstraErrorMeta diagnosis from a data-error part', () => {
    expect(readAstraMeta(dataErrorPart({ diagnosis }))?.diagnosis).toEqual(diagnosis)
  })

  it('returns undefined for a data-error part with a malformed diagnosis', () => {
    expect(readAstraMeta(dataErrorPart({ diagnosis: { summary: 42 } }))).toBeUndefined()
  })

  it('returns undefined when providerMetadata is missing', () => {
    const part: TextUIPart = { type: 'text', text: '' }
    expect(readAstraMeta(part)).toBeUndefined()
  })

  it('returns undefined when astra is missing', () => {
    const part: TextUIPart = { type: 'text', text: '', providerMetadata: {} }
    expect(readAstraMeta(part)).toBeUndefined()
  })

  it('returns undefined when astra is not an object', () => {
    const part = {
      type: 'text',
      text: '',
      providerMetadata: { astra: 'oops' }
    } as unknown as TextUIPart
    expect(readAstraMeta(part)).toBeUndefined()
  })

  it('returns undefined for a part type without a registered schema', () => {
    const part = {
      type: 'data-translation',
      data: { content: 'x', targetLanguage: 'en' },
      providerMetadata: { astra: { references: [] } }
    } as unknown as AstraMessagePart
    expect(readAstraMeta(part)).toBeUndefined()
  })

  it('returns undefined when references is the wrong shape', () => {
    const part = {
      type: 'text',
      text: '',
      providerMetadata: { astra: { references: 'oops' } }
    } as unknown as TextUIPart
    expect(readAstraMeta(part)).toBeUndefined()
  })

  it('returns undefined when thinkingMs is the wrong shape', () => {
    const part = {
      type: 'reasoning',
      text: '',
      providerMetadata: { astra: { thinkingMs: 'oops' } }
    } as unknown as ReasoningUIPart
    expect(readAstraMeta(part)).toBeUndefined()
  })
})

// ============================================================================
// withAstraMeta — typed write boundary
// ============================================================================

describe('withAstraMeta', () => {
  it('writes references onto a TextUIPart', () => {
    const part: TextUIPart = { type: 'text', text: '' }
    const next = withAstraMeta(part, { references: [{ url: 'https://ex.com' }] })
    expect(next.providerMetadata?.astra).toEqual({ references: [{ url: 'https://ex.com' }] })
  })

  it('preserves existing astra fields when merging', () => {
    const part: TextUIPart = {
      type: 'text',
      text: '',
      providerMetadata: { astra: { references: [{ a: 1 }] } }
    }
    const next = withAstraMeta(part, { references: [{ b: 2 }] })
    // shallow merge: new patch overwrites the same key
    expect(next.providerMetadata?.astra).toEqual({ references: [{ b: 2 }] })
  })

  it('writes thinking metadata onto a ReasoningUIPart', () => {
    const part: ReasoningUIPart = { type: 'reasoning', text: '' }
    const next = withAstraMeta(part, { thinkingMs: 1234, startedAt: 1780913860106 })
    expect(next.providerMetadata?.astra).toEqual({ thinkingMs: 1234, startedAt: 1780913860106 })
  })

  it('writes fileTokenSourceId onto a FileUIPart', () => {
    const part = {
      type: 'file',
      mediaType: 'application/pdf',
      url: 'file:///tmp/report.pdf',
      filename: 'report.pdf'
    } as unknown as Extract<AstraMessagePart, { type: 'file' }>
    const next = withAstraMeta(part, { fileTokenSourceId: 'source-1' })

    expect(next.providerMetadata?.astra).toEqual({ fileTokenSourceId: 'source-1' })
  })

  it('round-trips a diagnosis onto a data-error part', () => {
    const next = withAstraMeta(dataErrorPart(), { diagnosis })
    expect(readAstraMeta(next)?.diagnosis).toEqual(diagnosis)
  })

  // ── Compile-time negatives — `tsc --noEmit` enforces these. ──────────
  it('rejects writing thinkingMs to TextUIPart at compile time', () => {
    const part: TextUIPart = { type: 'text', text: '' }
    // @ts-expect-error thinkingMs is not on AstraTextMeta
    withAstraMeta(part, { thinkingMs: 1 })
    expect(true).toBe(true)
  })

  it('rejects writing references to ReasoningUIPart at compile time', () => {
    const part: ReasoningUIPart = { type: 'reasoning', text: '' }
    // @ts-expect-error references is not on AstraReasoningMeta
    withAstraMeta(part, { references: [] })
    expect(true).toBe(true)
  })

  it('rejects writing transport to TextUIPart at compile time', () => {
    const part: TextUIPart = { type: 'text', text: '' }
    // @ts-expect-error transport is not on AstraTextMeta
    withAstraMeta(part, { transport: 'x' })
    expect(true).toBe(true)
  })
})
