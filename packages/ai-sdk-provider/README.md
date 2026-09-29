# @astra-api/ai-sdk-provider

AstraIN provider bundle for the [Vercel AI SDK](https://ai-sdk.dev/).  
It exposes the AstraIN OpenAI-compatible entrypoints and dynamically routes Anthropic and Gemini model ids to their AstraIN upstream equivalents.

## Installation

```bash
npm install ai @astra-api/ai-sdk-provider @ai-sdk/anthropic @ai-sdk/google @ai-sdk/openai
# or
pnpm add ai @astra-api/ai-sdk-provider @ai-sdk/anthropic @ai-sdk/google @ai-sdk/openai
```

> **Note**: This package requires peer dependencies `ai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, and `@ai-sdk/openai` to be installed.

## Usage

```ts
import { createAstraIn, astraIn } from '@astra-api/ai-sdk-provider'

const astraInProvider = createAstraIn({
  apiKey: process.env.ASTRAIN_API_KEY,
  // optional overrides:
  // baseURL: 'https://open.astrain.net/v1',
  // anthropicBaseURL: 'https://open.astrain.net/anthropic',
  // geminiBaseURL: 'https://open.astrain.net/gemini/v1beta',
})

// Chat models will auto-route based on the model id prefix:
const openaiModel = astraInProvider.chat('gpt-4o-mini')
const anthropicModel = astraInProvider.chat('claude-3-5-sonnet-latest')
const geminiModel = astraInProvider.chat('gemini-2.0-pro-exp')

const { text } = await openaiModel.invoke('Hello AstraIN!')
```

The provider also exposes `completion`, `responses`, `embedding`, `image`, `transcription`, and `speech` helpers aligned with the upstream APIs.

See [AI SDK docs](https://ai-sdk.dev/providers/community-providers/custom-providers) for configuring custom providers.
