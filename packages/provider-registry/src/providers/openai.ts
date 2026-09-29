import { defineProvider } from './types'
import { openaiResponsesSummaryWire } from './wires'

const webSearchModels = ['gpt-4o', 'gpt-4-1', 'gpt-5', 'o3', 'o4']

export default defineProvider({
  id: 'openai',
  name: 'Astra API',
  availableInEditions: ['global'],
  defaultChatEndpoint: 'openai-responses',
  endpointConfigs: {
    'openai-responses': {
      adapterFamily: 'openai',
      baseUrl: 'https://api.gserver.online/v1',
      reasoningFormat: { type: 'openai-responses', wire: openaiResponsesSummaryWire }
    }
  },
  serverTools: [
    {
      id: 'web-search',
      modelScope: 'model-dependent',
      modelIdPrefixes: webSearchModels,
      modelIds: ['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna']
    }
  ],
  metadata: {
    website: {
      apiKey: 'https://funpay.com/users/16756744/',
      docs: 'https://api.gserver.online/v1',
      models: 'https://api.gserver.online/v1/models',
      official: 'https://api.gserver.online/'
    }
  }
})
