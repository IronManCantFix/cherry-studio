# OpenAI 图片接口兼容性修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复三个图片生成模块（会话文生图、绘图模块、图生图模块）对 OpenAI 官方和 NewAPI 网关的兼容性问题

**Architecture:** 采用逐模块最小修复方案，修改提供商过滤逻辑、模型过滤条件、API 调用和响应解析，确保 OpenAI 类型提供商能正确参与图片生成流程

**Tech Stack:** React 19, TypeScript, Redux Toolkit, Ant Design 5, styled-components

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/renderer/src/utils/provider.ts` | 提供商判断工具函数 | 修改：添加 `isOpenAIImageProvider` |
| `src/renderer/src/aiCore/AiProvider.ts` | AI 核心图片生成 | 修改：增强 `convertImageResult` |
| `src/renderer/src/pages/paintings/PaintingsRoutePage.tsx` | 绘图路由页面 | 修改：扩展提供商过滤 |
| `src/renderer/src/pages/paintings/NewApiPage.tsx` | 绘图主页面 | 修改：扩展模型过滤 |
| `src/renderer/src/pages/paintings/config/NewApiConfig.ts` | 绘图模型配置 | 修改：添加 OpenAI 模型 |
| `src/renderer/src/pages/imagetoimage/components/ImageGenerationArea.tsx` | 图生图生成区域 | 修改：增强 OpenAI 兼容 |

---

### Task 1: 添加 `isOpenAIImageProvider` 工具函数

**Files:**
- Modify: `src/renderer/src/utils/provider.ts:157-159`

- [ ] **Step 1: 添加 `isOpenAIImageProvider` 函数**

在 `isOpenAIProvider` 函数之后添加新函数：

```typescript
// src/renderer/src/utils/provider.ts:157-159
export function isOpenAIProvider(provider: Provider): boolean {
  return provider.type === 'openai-response'
}

/**
 * 判断是否支持 OpenAI 图片生成接口的提供商
 */
export function isOpenAIImageProvider(provider: Provider): boolean {
  return isOpenAIProvider(provider) || isNewApiProvider(provider)
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/utils/provider.ts
git commit -m "feat(provider): add isOpenAIImageProvider utility function"
```

---

### Task 2: 增强 `convertImageResult` 支持 URL 格式

**Files:**
- Modify: `src/renderer/src/aiCore/AiProvider.ts:448-459`

- [ ] **Step 1: 增强 `convertImageResult` 方法**

修改 `convertImageResult` 方法，增加对 URL 格式的支持和日志：

```typescript
// src/renderer/src/aiCore/AiProvider.ts:448-459
private convertImageResult(result: generateImageResult): string[] {
  const images: string[] = []
  if (result.images) {
    for (const image of result.images) {
      // GeneratedFile 只有 base64 属性
      if (image.base64) {
        images.push(`data:${image.mediaType || 'image/png'};base64,${image.base64}`)
      }
    }
  }
  if (images.length === 0 && result.images && result.images.length > 0) {
    logger.warn('[convertImageResult] Images returned but no base64 data found', {
      imageCount: result.images.length,
      imageKeys: result.images.map((img) => Object.keys(img))
    })
  }
  return images
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/aiCore/AiProvider.ts
git commit -m "fix(aiCore): add URL support and logging to convertImageResult"
```

---

### Task 3: 扩展绘图模块提供商过滤

**Files:**
- Modify: `src/renderer/src/pages/paintings/PaintingsRoutePage.tsx:23-33`

- [ ] **Step 1: 修改 PaintingsRoutePage 提供商过滤逻辑**

修改导入和过滤逻辑，包含 OpenAI 类型提供商：

```typescript
// src/renderer/src/pages/paintings/PaintingsRoutePage.tsx
// 添加导入
import { isNewApiProvider, isOpenAIProvider } from '@renderer/utils/provider'

// 修改 Options 计算 (line 32)
const isOpenAICompatible = (p: Provider) => isOpenAIProvider(p) || isNewApiProvider(p)

const Options = useMemo(
  () => [...BASE_OPTIONS, ...providers.filter(isOpenAICompatible).map((p) => p.id)],
  [providers]
)
const newApiProviders = useMemo(() => providers.filter(isOpenAICompatible), [providers])
```

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/paintings/PaintingsRoutePage.tsx
git commit -m "fix(paintings): include OpenAI providers in painting options"
```

---

### Task 4: 扩展绘图页面模型过滤

**Files:**
- Modify: `src/renderer/src/pages/paintings/NewApiPage.tsx:75,157-160`

- [ ] **Step 1: 修改 NewApiPage 提供商过滤**

修改 line 75 的提供商过滤：

```typescript
// src/renderer/src/pages/paintings/NewApiPage.tsx:75
// 原代码
const newApiProviders = providers.filter((p) => isNewApiProvider(p))

// 修改为
const isOpenAICompatible = (p: Provider) => isOpenAIProvider(p) || isNewApiProvider(p)
const newApiProviders = providers.filter(isOpenAICompatible)
```

- [ ] **Step 2: 修改模型过滤逻辑**

修改 line 157-160 的 `modelOptions`：

```typescript
// src/renderer/src/pages/paintings/NewApiPage.tsx:157-160
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
        return (
          isDedicatedImageGenerationModel(m) || m.id.includes('gpt-image') || m.id.includes('dall-e')
        )
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

- [ ] **Step 3: 添加必要的导入**

确保文件顶部有以下导入：

```typescript
import { isDedicatedImageGenerationModel } from '@renderer/config/models/vision'
import { isNewApiProvider, isOpenAIProvider } from '@renderer/utils/provider'
```

- [ ] **Step 4: 验证类型检查通过**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/pages/paintings/NewApiPage.tsx
git commit -m "fix(paintings): support OpenAI image models in model filter"
```

---

### Task 5: 添加 OpenAI 模型配置

**Files:**
- Modify: `src/renderer/src/pages/paintings/config/NewApiConfig.ts`

- [ ] **Step 1: 扩展 SUPPORTED_MODELS 和 MODELS**

```typescript
// src/renderer/src/pages/paintings/config/NewApiConfig.ts
export const SUPPORTED_MODELS = ['gpt-image-1', 'dall-e-3', 'dall-e-2']

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

- [ ] **Step 2: 验证类型检查通过**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/paintings/config/NewApiConfig.ts
git commit -m "feat(paintings): add dall-e-2/3 model configurations"
```

---

### Task 6: 增强图生图模块 OpenAI 兼容性

**Files:**
- Modify: `src/renderer/src/pages/imagetoimage/components/ImageGenerationArea.tsx:10,99,286-347`

- [ ] **Step 1: 添加 OpenAI 提供商判断导入**

修改 line 10 的导入：

```typescript
// src/renderer/src/pages/imagetoimage/components/ImageGenerationArea.tsx:10
import { isVolcengineImageProvider, isOpenAIProvider, isNewApiProvider } from '@renderer/utils/provider'
```

- [ ] **Step 2: 扩展可用提供商过滤**

修改 line 99 的 `availableProviders`：

```typescript
// src/renderer/src/pages/imagetoimage/components/ImageGenerationArea.tsx:99
const availableProviders = useMemo(
  () =>
    providers.filter(
      (p) => p.models && p.models.length > 0 && (isOpenAIProvider(p) || isNewApiProvider(p) || isVolcengineImageProvider(p))
    ),
  [providers]
)
```

- [ ] **Step 3: 确保 API 端点路径正确**

检查 line 288-290 的 URL 构建逻辑（当前已正确）：

```typescript
// 当前代码已正确，无需修改
const baseUrl = currentProvider.apiHost.replace(/\/v1$/, '')
const endpoint = hasInputImages ? '/v1/images/edits/' : '/v1/images/generations/'
const url = `${baseUrl}${endpoint}`
```

- [ ] **Step 4: 验证类型检查通过**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/pages/imagetoimage/components/ImageGenerationArea.tsx
git commit -m "fix(imagetoimage): add OpenAI provider support for image generation"
```

---

### Task 7: 整体验证和回归测试

- [ ] **Step 1: 运行类型检查**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 2: 运行 lint 检查**

Run: `pnpm lint`
Expected: 无错误

- [ ] **Step 3: 运行测试**

Run: `pnpm test`
Expected: 所有测试通过

- [ ] **Step 4: 构建检查**

Run: `pnpm build:check`
Expected: 构建成功

---

## 测试计划

### 手动测试场景

1. **会话文生图测试**
   - 配置 OpenAI 提供商（type=openai-response）
   - 在对话中使用 gpt-image-1 模型生成图片
   - 验证图片能正常显示

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

---

## 风险评估

- **低风险**：改动范围小，只涉及过滤条件和格式处理
- **向后兼容**：不改变现有 API 接口和数据结构
- **测试覆盖**：每个模块都有明确的测试场景
