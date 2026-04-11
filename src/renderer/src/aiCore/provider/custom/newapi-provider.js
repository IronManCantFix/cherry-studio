/**
 * NewAPI Provider
 *
 * Multi-backend API gateway (One API / New API) that routes models by endpoint_type:
 * - anthropic -> Anthropic SDK
 * - gemini -> Google SDK
 * - openai-response -> OpenAI Responses SDK
 * - openai / image-generation -> OpenAI Chat SDK
 * - fallback -> OpenAI Compatible SDK
 *
 * The endpointType is set per-request via provider settings, based on the model's endpoint_type field.
 */
import { AnthropicMessagesLanguageModel } from '@ai-sdk/anthropic/internal'
import { GoogleGenerativeAILanguageModel } from '@ai-sdk/google/internal'
import { OpenAIResponsesLanguageModel } from '@ai-sdk/openai/internal'
import { OpenAICompatibleChatLanguageModel, OpenAICompatibleEmbeddingModel } from '@ai-sdk/openai-compatible'
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  loadApiKey,
  postJsonToApi,
  withoutTrailingSlash
} from '@ai-sdk/provider-utils'
import * as z from 'zod'
// NewAPI 图像生成响应 schema - 支持标准格式和 metadata 格式
const newApiImageResponseSchema = z
  .object({
    data: z.array(z.object({ b64_json: z.string().optional(), url: z.string().optional() })).optional(),
    metadata: z
      .object({
        output: z
          .object({
            choices: z.array(
              z.object({
                finish_reason: z.string().optional(),
                message: z.object({
                  content: z.array(z.object({ image: z.string() }))
                })
              })
            )
          })
          .optional()
      })
      .optional()
  })
  .passthrough()
export const NEWAPI_PROVIDER_NAME = 'newapi'
export function createNewApi(options = {}) {
  const { baseURL = '', fetch: customFetch, endpointType } = options
  const resolveApiKey = () =>
    loadApiKey({ apiKey: options.apiKey, environmentVariableName: 'NEWAPI_API_KEY', description: 'NewAPI' })
  const authHeaders = () => ({
    Authorization: `Bearer ${resolveApiKey()}`,
    'Content-Type': 'application/json',
    ...options.headers
  })
  const url = ({ path }) => `${withoutTrailingSlash(baseURL)}${path}`
  const createAnthropicModel = (modelId) => {
    const headers = authHeaders()
    return new AnthropicMessagesLanguageModel(modelId, {
      provider: `${NEWAPI_PROVIDER_NAME}.anthropic`,
      baseURL,
      headers: () => ({ ...headers, 'x-api-key': resolveApiKey() }),
      fetch: customFetch,
      supportedUrls: () => ({ 'image/*': [/^https?:\/\/.*$/] })
    })
  }
  const createGeminiModel = (modelId) => {
    const headers = authHeaders()
    return new GoogleGenerativeAILanguageModel(modelId, {
      provider: `${NEWAPI_PROVIDER_NAME}.google`,
      baseURL,
      headers: () => ({ ...headers, 'x-goog-api-key': resolveApiKey() }),
      fetch: customFetch,
      generateId: () => `${NEWAPI_PROVIDER_NAME}-${Date.now()}`,
      supportedUrls: () => ({})
    })
  }
  const createResponsesModel = (modelId) =>
    new OpenAIResponsesLanguageModel(modelId, {
      provider: `${NEWAPI_PROVIDER_NAME}.openai-response`,
      url,
      headers: authHeaders,
      fetch: customFetch
    })
  const createCompatibleModel = (modelId) =>
    new OpenAICompatibleChatLanguageModel(modelId, {
      provider: `${NEWAPI_PROVIDER_NAME}.chat`,
      url,
      headers: authHeaders,
      fetch: customFetch
    })
  const createChatModel = (modelId) => {
    switch (endpointType) {
      case 'anthropic':
        return createAnthropicModel(modelId)
      case 'gemini':
        return createGeminiModel(modelId)
      case 'openai-response':
        return createResponsesModel(modelId)
      case 'openai':
      case 'image-generation':
        return createCompatibleModel(modelId)
      default:
        return createCompatibleModel(modelId)
    }
  }
  const provider = (modelId) => createChatModel(modelId)
  provider.specificationVersion = 'v3'
  provider.languageModel = createChatModel
  provider.embeddingModel = (modelId) =>
    new OpenAICompatibleEmbeddingModel(modelId, {
      provider: `${NEWAPI_PROVIDER_NAME}.embedding`,
      url,
      headers: authHeaders,
      fetch: customFetch
    })
  // 自定义 ImageModel - 处理 newapi 的特殊响应格式
  // newapi 可能返回两种格式:
  // 1. 标准格式: { data: [{ b64_json: "..." }] }
  // 2. metadata 格式: { metadata: { output: { choices: [{ message: { content: [{ image: "url" }] } }] } } }
  provider.imageModel = (modelId) => {
    const imageUrl = ({ path }) => `${withoutTrailingSlash(baseURL)}${path}`
    // 下载图片并转换为 base64
    const downloadImageAsBase64 = async (imageUrl) => {
      const response = await (customFetch || fetch)(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      return base64
    }
    return {
      specificationVersion: 'v3',
      provider: `${NEWAPI_PROVIDER_NAME}.image`,
      modelId,
      maxImagesPerCall: 10,
      async doGenerate(options) {
        const { prompt, n = 1, size, abortSignal } = options
        const result = await postJsonToApi({
          url: imageUrl({ path: '/images/generations', modelId }),
          headers: combineHeaders(authHeaders(), options.headers),
          body: {
            model: modelId,
            prompt,
            n,
            size,
            response_format: 'url'
          },
          failedResponseHandler: createJsonErrorResponseHandler({
            errorSchema: z.object({ message: z.string() }),
            errorToMessage: (error) => error.message || 'Image generation failed'
          }),
          successfulResponseHandler: createJsonResponseHandler(newApiImageResponseSchema),
          abortSignal,
          fetch: customFetch
        })
        const response = result.value
        // 解析图片 URL - metadata.output.choices 和 data 包含相同图片，只取其中一个
        const images = []
        // 优先使用 metadata.output 格式（newapi/阿里云/万相格式）
        // 万相每个 choice 包含一张图，需要遍历所有 choices
        const metadata = response.metadata
        if (metadata?.output?.choices?.length) {
          for (const choice of metadata.output.choices) {
            const content = choice?.message?.content
            if (!content) continue
            for (const item of content) {
              if (item.image) {
                try {
                  const base64 = await downloadImageAsBase64(item.image)
                  images.push(base64)
                } catch (error) {
                  console.error('Failed to download image:', item.image, error)
                }
              }
            }
          }
        } else {
          // 标准 OpenAI 格式
          const data = response.data
          if (data) {
            for (const item of data) {
              if (item.b64_json) {
                images.push(item.b64_json)
              } else if (item.url) {
                try {
                  const base64 = await downloadImageAsBase64(item.url)
                  images.push(base64)
                } catch (error) {
                  console.error('Failed to download image:', item.url, error)
                }
              }
            }
          }
        }
        return {
          images,
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId,
            headers: {}
          }
        }
      }
    }
  }
  return provider
}
