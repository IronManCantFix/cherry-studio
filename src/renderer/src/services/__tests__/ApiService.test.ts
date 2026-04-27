import type { Assistant } from '@renderer/types'
import type { Message } from '@renderer/types/newMessage'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const quickModel = { id: 'quick-model', name: 'Quick Model', provider: 'quick-provider' }
const assistantModel = { id: 'assistant-model', name: 'Assistant Model', provider: 'assistant-provider' }

const quickProvider = {
  id: 'quick-provider',
  name: 'Quick Provider',
  type: 'openai',
  apiKey: 'quick-key',
  apiHost: 'https://quick.example'
}
const assistantProvider = {
  id: 'assistant-provider',
  name: 'Assistant Provider',
  type: 'openai',
  apiKey: 'assistant-key',
  apiHost: 'https://assistant.example'
}

const completions = vi.fn()
const getActualProvider = vi.fn()
const aiProviderConstructor = vi.fn()

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn()
    })
  }
}))

vi.mock('@renderer/hooks/useSettings', () => ({
  getStoreSetting: (key: string) => (key === 'topicNamingPrompt' ? '' : undefined)
}))

vi.mock('@renderer/i18n', () => ({
  default: {
    t: (key: string) => key
  }
}))

vi.mock('@renderer/utils/prompt', () => ({
  containsSupportedVariables: () => false,
  replacePromptVariables: vi.fn()
}))

vi.mock('@renderer/utils/markdown', () => ({
  purifyMarkdownImages: (text: string) => text
}))

vi.mock('@renderer/utils/messageUtils/find', () => ({
  findFileBlocks: () => [],
  findImageBlocks: () => [],
  getMainTextContent: (message: Message) => (message as any).content ?? ''
}))

vi.mock('@renderer/utils/analytics', () => ({
  trackTokenUsage: vi.fn()
}))

vi.mock('@renderer/utils/provider', () => ({
  NOT_SUPPORT_API_KEY_PROVIDER_TYPES: [],
  NOT_SUPPORT_API_KEY_PROVIDERS: []
}))

vi.mock('@renderer/types', async () => {
  const actual = await vi.importActual<typeof import('@renderer/types')>('@renderer/types')
  return {
    ...actual,
    isSystemProvider: () => false
  }
})

vi.mock('@renderer/aiCore/utils/options', () => ({
  buildProviderOptions: () => ({ providerOptions: {}, standardParams: {} })
}))

vi.mock('@renderer/services/AssistantService', () => ({
  getDefaultAssistant: () => ({
    id: 'default-assistant',
    name: 'Default Assistant',
    settings: {},
    prompt: '',
    model: quickModel
  }),
  getDefaultModel: () => quickModel,
  getProviderByModel: (model: typeof quickModel) =>
    model.provider === 'assistant-provider' ? assistantProvider : quickProvider,
  getQuickModel: () => quickModel
}))

vi.mock('../../aiCore', () => ({
  AiProvider: class MockAiProvider {
    constructor(model: any, provider: any) {
      aiProviderConstructor(model, provider)
      getActualProvider.mockReturnValue(provider)
    }

    getActualProvider() {
      return getActualProvider()
    }

    completions(...args: any[]) {
      return completions(...args)
    }
  }
}))

describe('fetchMessagesSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    completions.mockResolvedValue({
      getText: () => 'Generated title',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
    })
  })

  it('uses assistant model instead of quick model when assistant is provided', async () => {
    const { fetchMessagesSummary } = await import('../ApiService')
    const assistant = { id: 'assistant-1', model: assistantModel, settings: {}, prompt: '' } as Assistant
    const messages = [
      { id: 'user-1', role: 'user', topicId: 'topic-1', content: 'Hello' },
      { id: 'assistant-1', role: 'assistant', topicId: 'topic-1', content: 'Hi' }
    ] as unknown as Message[]

    await fetchMessagesSummary({ messages, assistant })

    expect(aiProviderConstructor).toHaveBeenCalledWith(
      assistantModel,
      expect.objectContaining({ id: 'assistant-provider' })
    )
    expect(completions).toHaveBeenCalledWith(
      'assistant-model',
      expect.any(Object),
      expect.objectContaining({ assistant: expect.objectContaining({ model: assistantModel }) })
    )
  })
})
