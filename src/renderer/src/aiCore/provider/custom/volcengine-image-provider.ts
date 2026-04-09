/**
 * Volcengine Image Provider
 *
 * 火山引擎图像生成 API 集成
 * API 文档: https://www.volcengine.com/docs/82379/1666945
 *
 * 端点: POST {baseURL}/api/v3/images/generations
 * 认证: API Key 鉴权
 *
 * 注意: 火山引擎的图像 API 与 OpenAI 不兼容，需要完全自定义实现
 */
import type {
  ImageModelV3,
  ImageModelV3CallOptions,
  ImageModelV3ProviderMetadata,
  ImageModelV3Usage,
  SharedV3Warning
} from '@ai-sdk/provider'
import type { FetchFunction } from '@ai-sdk/provider-utils'

export const VOLCENGINE_IMAGE_PROVIDER_NAME = 'volcengine-image' as const

export interface VolcengineImageProviderSettings {
  apiKey?: string
  baseURL?: string
  headers?: Record<string, string>
  fetch?: FetchFunction
}

export interface VolcengineImageProvider {
  (modelId: string): ImageModelV3
  languageModel(modelId: string): never
  embeddingModel(modelId: string): never
  imageModel(modelId: string): ImageModelV3
  specificationVersion: 'v3'
}

export function createVolcengineImage(options: VolcengineImageProviderSettings = {}): VolcengineImageProvider {
  const { baseURL = '', fetch: customFetch, headers = {} } = options

  // 火山引擎图像生成使用 /api/v3 路径
  const buildUrl = () => {
    const base = baseURL.replace(/\/$/, '')
    return `${base}/api/v3/images/generations`
  }

  const getAuthHeaders = (): Record<string, string> => ({
    Authorization: `Bearer ${options.apiKey}`,
    'Content-Type': 'application/json',
    ...headers
  })

  // 火山引擎图像生成模型 - 完全自定义实现
  const createImageModel = (modelId: string): ImageModelV3 =>
    new (class implements ImageModelV3 {
      readonly modelId = modelId
      readonly specificationVersion = 'v3'
      readonly maxImagesPerCall = 15 // 火山引擎支持最多15张图片

      get provider(): string {
        return VOLCENGINE_IMAGE_PROVIDER_NAME
      }

      async doGenerate(options: ImageModelV3CallOptions): Promise<{
        images: string[]
        warnings: SharedV3Warning[]
        providerMetadata?: ImageModelV3ProviderMetadata
        response: { timestamp: Date; modelId: string; headers: Record<string, string> }
        usage?: ImageModelV3Usage
      }> {
        const { prompt, n, size, abortSignal } = options

        const warnings: SharedV3Warning[] = []

        // 火山引擎请求参数
        const body: Record<string, unknown> = {
          model: modelId,
          prompt: typeof prompt === 'string' ? prompt : ''
        }

        // 图片数量
        if (n !== undefined && n > 1) {
          body.sequential_image_generation = 'auto'
          body.sequential_image_generation_options = {
            max_images: n
          }
        }

        // 尺寸
        if (size) {
          body.size = size
        }

        // 设置返回格式为 base64
        body.response_format = 'b64_json'

        // 发送请求
        const response = await (customFetch || fetch)(buildUrl(), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
          signal: abortSignal
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }

        const data = await response.json()

        // 提取图片
        const images: string[] = []
        for (const item of data.data || []) {
          if (item.b64_json) {
            images.push(`data:image/jpeg;base64,${item.b64_json}`)
          }
        }

        return {
          images,
          warnings,
          response: {
            timestamp: new Date(),
            modelId,
            headers: Object.fromEntries(response.headers.entries())
          },
          usage: data.usage
        }
      }
    })()

  const provider = (modelId: string) => createImageModel(modelId)
  provider.specificationVersion = 'v3' as const

  provider.languageModel = (_modelId: string) => {
    throw new Error('Volcengine Image provider does not support language models')
  }

  provider.embeddingModel = (_modelId: string) => {
    throw new Error('Volcengine Image provider does not support embedding models')
  }

  provider.imageModel = createImageModel

  return provider as VolcengineImageProvider
}
