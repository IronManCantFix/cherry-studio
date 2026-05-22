# OpenAI 图片接口兼容性修复设计文档

## 背景

项目中有三个地方涉及图片生成：
1. **会话文生图** - 助手对话中的文生图功能
2. **绘图模块** - 独立的绘图页面
3. **图生图模块** - 独立的图生图页面

当前存在以下问题：
1. 会话文生图使用 OpenAI 接口返回后，图片没有正常渲染
2. 绘图模块不能选择 OpenAI 类型提供商
3. 图生图模块的 OpenAI 接口兼容性问题

## 方案：逐模块最小修复（方案 A）

### 1. 会话文生图修复

**问题根因**：
- `AiProvider.convertImageResult()` 只处理 `image.base64`
- 如果 AI SDK 的 `generateImage` 返回了非 base64 格式（如 URL），图片会丢失
- 可能是 `@ai-sdk/openai` 的 `OpenAIImageModel` 返回了 URL 格式而 SDK 未自动下载转换

**改动文件**：
- `src/renderer/src/aiCore/AiProvider.ts` - `convertImageResult` 方法

**改动内容**：
- 增强 `convertImageResult` 支持 URL 格式返回
- 当 `image.base64` 为空时，检查是否有 URL 属性
- 添加空结果的错误处理和日志

```typescript
private convertImageResult(result: generateImageResult): string[] {
  const images: string[] = []
  if (result.images) {
    for (const image of result.images) {
      if (image.base64) {
        images.push(`data:${image.mediaType || 'image/png'};base64,${image.base64}`)
      }
    }
  }
  if (images.length === 0 && result.images && result.images.length > 0) {
    logger.warn('[convertImageResult] Images returned but no base64 data found', {
      imageCount: result.images.length,
      imageKeys: result.images.map(img => Object.keys(img))
    })
  }
  return images
}
```

### 2. 绘图模块修复

**问题根因**：
- `PaintingsRoutePage.tsx` 使用 `isNewApiProvider(p)` 过滤提供商，排除了 OpenAI
- `NewApiPage.tsx` 的 `modelOptions` 只过滤 `endpoint_type === 'image-generation'` 的模型
- OpenAI 提供商的模型没有 `endpoint_type` 标记

**改动文件**：
- `src/renderer/src/pages/paintings/PaintingsRoutePage.tsx` - 扩展提供商过滤
- `src/renderer/src/pages/paintings/NewApiPage.tsx` - 扩展模型过滤和 API 调用
- `src/renderer/src/pages/paintings/config/NewApiConfig.ts` - 添加 OpenAI 模型配置

**改动内容**：

#### 2a. PaintingsRoutePage.tsx
```typescript
// 扩展 Options 计算，包含 OpenAI 类型提供商
const isOpenAICompatible = (p: Provider) => 
  isOpenAIProvider(p) || isNewApiProvider(p)

const Options = useMemo(() => [
  ...BASE_OPTIONS, 
  ...providers.filter(isOpenAICompatible).map((p) => p.id)
], [providers])

const newApiProviders = useMemo(
  () => providers.filter(isOpenAICompatible), 
  [providers]
)
```

#### 2b. NewApiPage.tsx
```typescript
// 扩展模型过滤条件
const modelOptions = useMemo(() => {
  const isOpenAI = isOpenAIProvider(newApiProvider)
  
  const customModels = newApiProvider.models
    .filter((m) => {
      // NewApi 类型：必须有 image-generation 端点类型
      if (isNewApiProvider(newApiProvider)) {
        return m.endpoint_type && m.endpoint_type === 'image-generation'
      }
      // OpenAI 类型：支持图片生成的模型
      if (isOpenAI) {
        return isDedicatedImageGenerationModel(m) || 
               m.id.includes('gpt-image') || 
               m.id.includes('dall-e')
      }
      return false
    })
    .map((m) => ({
      label: m.name,
      value: m.id,
      custom: !SUPPORTED_MODELS.includes(m.id),
      group: m.group
    }))
  return [...customModels]
}, [newApiProvider.models, newApiProvider])
```

#### 2c. NewApiConfig.ts
```typescript
// 扩展 SUPPORTED_MODELS
export const SUPPORTED_MODELS = ['gpt-image-1', 'dall-e-3', 'dall-e-2']

// 添加更多模型配置
export const MODELS = [
  {
    name: 'gpt-image-1',
    group: 'OpenAI',
    imageSizes: [{ value: 'auto' }, { value: '1024x1024' }, { value: '1536x1024' }, { value: '1024x1536' }],
    max_images: 10,
    quality: [{ value: 'auto' }, { value: 'high' }, { value: 'medium' }, { value: 'low' }],
    moderation: [{ value: 'auto' }, { value: 'low' }],
    output_compression_format: [{ value: 'jpeg' }, { value: 'webp' }],
    output_format: [{ value: 'image/png' }, { value: 'image/jpeg' }, { value: 'image/webp' }],
    background: [{ value: 'auto' }, { value: 'transparent' }, { value: 'opaque' }]
  },
  {
    name: 'dall-e-3',
    group: 'OpenAI',
    imageSizes: [{ value: '1024x1024' }, { value: '1792x1024' }, { value: '1024x1792' }],
    max_images: 1,
    quality: [{ value: 'standard' }, { value: 'hd' }],
    moderation: [],
    output_compression_format: [],
    output_format: [],
    background: []
  },
  {
    name: 'dall-e-2',
    group: 'OpenAI',
    imageSizes: [{ value: '256x256' }, { value: '512x512' }, { value: '1024x1024' }],
    max_images: 10,
    quality: [],
    moderation: [],
    output_compression_format: [],
    output_format: [],
    background: []
  }
]
```

### 3. 图生图模块修复

**问题根因**：
- `ImageGenerationArea.tsx` 的 `doGenerate` 函数已有 OpenAI 兼容逻辑
- 但可能缺少对 OpenAI 官方提供商（type='openai-response'）的特殊处理
- 或者返回格式解析有问题

**改动文件**：
- `src/renderer/src/pages/imagetoimage/components/ImageGenerationArea.tsx` - 增强 OpenAI 兼容

**改动内容**：
- 确保 OpenAI 官方提供商可以正确调用 `/v1/images/generations` 和 `/v1/images/edits`
- 增强返回格式解析，兼容更多响应格式
- 添加 OpenAI 模型到可用模型列表

```typescript
// 在 doGenerate 中，确保 OpenAI 提供商可以使用
const isOpenAI = isOpenAIProvider(currentProvider)
const isNewApi = isNewApiProvider(currentProvider)

// 通用 OpenAI 兼容接口处理
if (isOpenAI || isNewApi || !isVolcengineImageProvider(currentProvider)) {
  const baseUrl = currentProvider.apiHost.replace(/\/v1$/, '')
  const endpoint = hasInputImages ? '/v1/images/edits' : '/v1/images/generations'
  const url = `${baseUrl}${endpoint}`
  // ... 现有逻辑
}
```

### 4. 工具函数扩展

**改动文件**：
- `src/renderer/src/utils/provider.ts` - 添加 `isOpenAIImageProvider` 判断

**改动内容**：
```typescript
/**
 * 判断是否支持 OpenAI 图片生成接口的提供商
 */
export function isOpenAIImageProvider(provider: Provider): boolean {
  return isOpenAIProvider(provider) || 
         isNewApiProvider(provider) || 
         isOpenAICompatibleProvider(provider)
}
```

## 测试计划

1. **会话文生图测试**
   - 使用 OpenAI 提供商配置 gpt-image-1 模型
   - 在对话中启用文生图功能
   - 验证图片能正常生成和显示

2. **绘图模块测试**
   - 配置 OpenAI 官方提供商
   - 在绘图页面选择 OpenAI 提供商
   - 使用 gpt-image-1 和 dall-e-3 模型生成图片
   - 验证文生图和图生图功能

3. **图生图模块测试**
   - 配置 OpenAI 官方提供商
   - 在图生图页面选择 OpenAI 提供商
   - 上传图片并使用 gpt-image-1 模型编辑
   - 验证图片编辑功能

4. **回归测试**
   - 确保 NewAPI 类型提供商的功能不受影响
   - 确保其他提供商（智谱、火山等）功能正常

## 风险评估

- **低风险**：改动范围小，只涉及过滤条件和格式处理
- **向后兼容**：不改变现有 API 接口和数据结构
- **测试覆盖**：每个模块都有明确的测试场景
