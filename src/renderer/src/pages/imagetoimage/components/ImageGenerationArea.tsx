import { loggerService } from '@logger'
import { AiProvider } from '@renderer/aiCore'
import { CopyIcon, DeleteIcon, RefreshIcon } from '@renderer/components/Icons'
import { ProviderAvatar } from '@renderer/components/ProviderAvatar'
import { getModelLogoById } from '@renderer/config/models'
import { useProviders } from '@renderer/hooks/useProvider'
import type { Provider } from '@renderer/types'
import { getErrorMessage } from '@renderer/utils'
import { download } from '@renderer/utils/download'
import { detectImageMimeFromBase64, fetchImageAsDataUrl } from '@renderer/utils/image'
import { isNewApiProvider, isOpenAIProvider, isVolcengineImageProvider } from '@renderer/utils/provider'
import type { MenuProps } from 'antd'
import { AutoComplete, Avatar, Dropdown, Image as AntImage, Popconfirm, Select, Spin, Tooltip, Upload } from 'antd'
import dayjs from 'dayjs'
import { Check, DownloadIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import SendMessageButton from '../../home/Inputbar/SendMessageButton'
import { useImageToImage } from '../store/context'
import { createRecord } from '../store/reducer'
import ImageGalleryPreview from './ImageGalleryPreview'

const logger = loggerService.withContext('ImageGenerationArea')

const SIZE_OPTIONS = [
  { label: '1024x1024', value: '1024x1024' },
  { label: '1536x1024', value: '1536x1024' },
  { label: '1024x1536', value: '1024x1536' },
  { label: '1920x1920', value: '1920x1920' },
  { label: '2048x2048', value: '2048x2048' },
  { label: '1024x4096', value: '1024x4096' },
  { label: '4096x1024', value: '4096x1024' }
]

const QUALITY_OPTIONS = [
  { label: 'auto', value: 'auto' },
  { label: 'low', value: 'low' },
  { label: 'medium', value: 'medium' },
  { label: 'high', value: 'high' }
]

const ImageGenerationArea: React.FC = () => {
  const { state, dispatch } = useImageToImage()
  const { providers } = useProviders()
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [streamingImages, setStreamingImages] = useState<string[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)
  const [pendingRecord, setPendingRecord] = useState<{
    prompt: string
    inputImageUrls: string[]
    sentAt: string
  } | null>(null)
  // Track which session owns the current generation (for cross-session isolation)
  const generatingSessionIdRef = useRef<string | null>(null)

  // Per-session draft persistence
  const draftsCache = useRef<Record<string, { prompt: string; files: File[] }>>({})
  const currentSessionId = state.activeSessionId

  const [prompt, setPrompt] = useState('')
  const [inputImages, setInputImages] = useState<File[]>([])

  // Whether the current view's session is the one generating
  const isCurrentSessionGenerating = isLoading && generatingSessionIdRef.current === currentSessionId

  // Save/restore draft when switching sessions
  const prevSessionIdRef = useRef(currentSessionId)
  if (prevSessionIdRef.current !== currentSessionId) {
    draftsCache.current[prevSessionIdRef.current] = {
      prompt,
      files: inputImages
    }
    const saved = draftsCache.current[currentSessionId]
    setPrompt(saved?.prompt ?? '')
    setInputImages(saved?.files ?? [])
    prevSessionIdRef.current = currentSessionId
  }
  draftsCache.current[currentSessionId] = { prompt, files: inputImages }

  const activeAssistant = state.assistants.find((a) => a.id === state.activeAssistantId)
  const activeSession = activeAssistant?.sessions.find((s) => s.id === state.activeSessionId)
  const records = state.records.filter((r) => r.sessionId === state.activeSessionId)
  const effectiveProviderId = activeSession?.providerId || activeAssistant?.providerId
  const effectiveModelId = activeSession?.modelId || activeAssistant?.modelId

  // All generated image URLs in DOM order (reversed records) for gallery preview
  const allGeneratedImageUrls = useMemo(
    () =>
      [...records]
        .reverse()
        .flatMap((r) => r.generatedImageUrls)
        .filter(Boolean),
    [records]
  )

  const availableProviders = useMemo(
    () =>
      providers.filter(
        (p) =>
          p.models &&
          p.models.length > 0 &&
          (isOpenAIProvider(p) || isNewApiProvider(p) || isVolcengineImageProvider(p))
      ),
    [providers]
  )
  const currentProvider = useMemo(
    () => availableProviders.find((p) => p.id === effectiveProviderId) || availableProviders[0],
    [availableProviders, effectiveProviderId]
  )

  const modelLogoSrc = useMemo(
    () => (effectiveModelId ? getModelLogoById(effectiveModelId) : undefined),
    [effectiveModelId]
  )

  const updateSessionParam = (updates: Record<string, unknown>) => {
    if (!activeAssistant || !activeSession) return
    dispatch({
      type: 'UPDATE_SESSION',
      payload: { assistantId: activeAssistant.id, id: activeSession.id, updates }
    })
  }

  const handleImageUpload = (file: File) => {
    setInputImages((prev) => [...prev, file])
    return false
  }

  const handleRemoveImage = (idx: number) => {
    setInputImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const doGenerate = async (genPrompt: string, genFiles: File[]) => {
    if (!currentProvider || !effectiveModelId) return
    const AI = new AiProvider(currentProvider as unknown as Provider)
    if (!AI.getApiKey()) {
      window.modal.error({ content: t('error.no_api_key'), centered: true })
      return
    }
    const hasInputImages = genFiles.length > 0
    const hasPrompt = genPrompt.trim().length > 0
    if (!hasPrompt && !hasInputImages) {
      window.toast.warning(t('imagetoimage.prompt_or_image_required'))
      return
    }

    const sentAt = new Date().toISOString()
    generatingSessionIdRef.current = currentSessionId
    setIsLoading(true)
    // Convert input files to persistent base64 data URLs
    const inputImageBase64List = await Promise.all(
      genFiles.map(
        (f) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(f)
          })
      )
    )
    setPendingRecord({ prompt: genPrompt, inputImageUrls: inputImageBase64List, sentAt })
    // Clear input immediately after sending
    setPrompt('')
    setInputImages([])
    logger.info(`Generating image with provider: ${currentProvider.id}, model: ${effectiveModelId}`)

    const assistantPrompt = activeAssistant?.prompt || ''
    const finalPrompt = assistantPrompt ? `${assistantPrompt}\n${genPrompt}` : genPrompt

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const imageN = activeSession?.imageN ?? 1
      const imageSize = activeSession?.imageSize ?? '1024x1024'
      const imageResponseFormat = activeSession?.imageResponseFormat ?? 'b64_json'

      const inputImageUrls = inputImageBase64List
      const generatedImageUrls: string[] = []

      if (isVolcengineImageProvider(currentProvider)) {
        // 火山引擎图像生成 API（流式 SSE）
        // 文档: https://www.volcengine.com/docs/82379/1666945
        const baseUrl = currentProvider.apiHost.replace(/\/v1$/, '').replace(/\/$/, '')
        const url = `${baseUrl}/api/v3/images/generations`

        const headers: Record<string, string> = {
          Authorization: `Bearer ${AI.getApiKey()}`,
          'Content-Type': 'application/json'
        }

        // 将输入图片转换为 base64
        const imageBase64List: string[] = []
        if (hasInputImages) {
          for (const file of genFiles) {
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(file)
            })
            imageBase64List.push(base64)
          }
        }

        const body: Record<string, unknown> = {
          model: effectiveModelId,
          prompt: finalPrompt,
          response_format: imageResponseFormat,
          stream: true,
          watermark: false
        }

        if (imageSize) {
          body.size = imageSize
        }

        // 输入图片：单张传 string，多张传 array
        if (imageBase64List.length === 1) {
          body.image = imageBase64List[0]
        } else if (imageBase64List.length > 1) {
          body.image = imageBase64List
        }

        // 多张图片时使用组图功能
        if (imageN > 1) {
          body.sequential_image_generation = 'auto'
          body.sequential_image_generation_options = { max_images: imageN }
        }

        logger.info(`Sending Volcengine streaming image request, model: ${effectiveModelId}`)
        setStreamingImages([])
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: abortController.signal
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error?.message || t('imagetoimage.generate_failed'))
        }

        // 解析 SSE 流
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const jsonStr = line.slice(5).trim()
            if (!jsonStr) continue

            let event: Record<string, unknown>
            try {
              event = JSON.parse(jsonStr)
            } catch {
              continue
            }

            const eventType = event.type as string

            if (eventType === 'image_generation.partial_succeeded') {
              const imageUrl =
                (event.url as string) || (event.b64_json ? `data:image/jpeg;base64,${event.b64_json}` : '')
              if (imageUrl) {
                generatedImageUrls.push(imageUrl)
                setStreamingImages([...generatedImageUrls])
              }
            } else if (eventType === 'image_generation.partial_failed') {
              const errorMsg = (event.error as Record<string, string>)?.message || 'Image generation failed'
              logger.warn(`Image ${event.image_index} failed: ${errorMsg}`)
            } else if (eventType === 'image_generation.completed') {
              // 所有图片处理完毕
              logger.info(`Volcengine image generation completed, usage: ${JSON.stringify(event.usage)}`)
            } else if (eventType === 'error') {
              const err = event.error as Record<string, string>
              throw new Error(err?.message || t('imagetoimage.generate_failed'))
            }
          }
        }
      } else {
        // 通用 OpenAI 兼容接口
        const baseUrl = currentProvider.apiHost.replace(/\/+$/, '').replace(/\/v1$/, '')
        const endpoint = hasInputImages ? '/v1/images/edits' : '/v1/images/generations'
        const url = `${baseUrl}${endpoint}`
        const imageQuality = activeSession?.imageQuality ?? 'auto'
        // OpenAI 官方域名 + gpt-image-1 不接受 response_format；第三方代理需要显式传递才会返回 b64_json
        const isOfficialOpenAI = /(^|\/\/)api\.openai\.com/i.test(currentProvider.apiHost)
        const supportsResponseFormat = !(isOfficialOpenAI && /gpt-image/i.test(effectiveModelId))

        const headers: Record<string, string> = { Authorization: `Bearer ${AI.getApiKey()}` }
        let body: FormData | string

        if (hasInputImages) {
          const formData = new FormData()
          if (hasPrompt) formData.append('prompt', finalPrompt)
          formData.append('model', effectiveModelId)
          formData.append('n', String(imageN))
          formData.append('size', imageSize)
          if (imageQuality && imageQuality !== 'auto') {
            formData.append('quality', imageQuality)
          }
          if (supportsResponseFormat) {
            formData.append('response_format', imageResponseFormat)
          }
          genFiles.forEach((file) => {
            formData.append('image', file)
          })
          logger.info(`Sending FormData with ${genFiles.length} image(s), prompt: ${finalPrompt}`)
          body = formData
        } else {
          headers['Content-Type'] = 'application/json'
          const payload: Record<string, unknown> = {
            prompt: finalPrompt,
            model: effectiveModelId,
            n: imageN,
            size: imageSize
          }
          if (imageQuality && imageQuality !== 'auto') {
            payload.quality = imageQuality
          }
          if (supportsResponseFormat) {
            payload.response_format = imageResponseFormat
          }
          body = JSON.stringify(payload)
        }

        const response = await fetch(url, { method: 'POST', headers, body, signal: abortController.signal })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error?.message || t('imagetoimage.generate_failed'))
        }

        const data = await response.json()
        // 调试：打印响应顶层结构
        logger.info('[ImageGeneration] Full response structure', {
          topLevelKeys: Object.keys(data),
          hasData: !!data.data,
          isArray: Array.isArray(data),
          dataType: typeof data.data,
          dataIsArray: Array.isArray(data.data),
          dataPreview: JSON.stringify(data).slice(0, 300)
        })

        // 解析图片 - metadata.output.choices 和 data 包含相同图片，只取其中一个
        if (data.metadata?.output?.choices?.length) {
          // 万相/阿里云格式：每个 choice 包含一张图，遍历所有 choices
          for (const choice of data.metadata.output.choices) {
            const content = choice?.message?.content
            if (!content) continue
            for (const item of content) {
              if (item.image) {
                generatedImageUrls.push(item.image)
              }
            }
          }
        } else if (data.data && Array.isArray(data.data)) {
          // 标准 OpenAI 格式：优先非空 b64_json（部分代理会同时返回不可用的 url）
          logger.info('[ImageGeneration] data.data items', {
            length: data.data.length,
            firstItemKeys: data.data[0] ? Object.keys(data.data[0]) : 'empty'
          })
          // 调试：打印第一个 item 的 b64_json 值和类型
          if (data.data[0]) {
            const first = data.data[0]
            logger.info('[ImageGeneration] b64_json debug', {
              exists: 'b64_json' in first,
              type: typeof first.b64_json,
              isNull: first.b64_json === null,
              length: typeof first.b64_json === 'string' ? first.b64_json.length : 'N/A',
              preview: typeof first.b64_json === 'string' ? first.b64_json.slice(0, 30) + '...' : String(first.b64_json)
            })
          }
          for (const item of data.data) {
            // 遍历所有可能的 base64 字段名（兼容不同代理的命名）
            let b64: string | undefined
            for (const key of ['b64_json', 'b64Json', 'b64', 'base64', 'base64_json']) {
              const val = item[key]
              if (val && typeof val === 'string' && val.length > 100) {
                b64 = val
                break
              }
            }
            // 如果没有找到标准字段，搜索 item 中任何看起来像 base64 的长字符串值
            if (!b64) {
              for (const [key, val] of Object.entries(item)) {
                if (key === 'url' || key === 'revised_prompt') continue
                if (typeof val === 'string' && val.length > 100 && /^[A-Za-z0-9+/=]+$/.test(val.slice(0, 50))) {
                  b64 = val
                  logger.info('[ImageGeneration] Found base64-like data in non-standard field', { key })
                  break
                }
              }
            }
            if (b64) {
              // 如果 b64 已经是 data URL 格式，直接使用
              if (b64.startsWith('data:')) {
                generatedImageUrls.push(b64)
              } else {
                const mime = detectImageMimeFromBase64(b64)
                generatedImageUrls.push(`data:${mime};base64,${b64}`)
              }
            } else if (item.url) {
              // 部分代理只返回内部域名 URL（如 http://chatgpt2api/...），渲染器无法直接加载
              // 尝试 fetch 转 base64；失败时回退到原 URL，让用户从控制台看到错误
              logger.warn('[ImageGeneration] b64_json missing, falling back to url', { url: item.url })
              try {
                const dataUrl = await fetchImageAsDataUrl(item.url, abortController.signal)
                generatedImageUrls.push(dataUrl)
              } catch (e) {
                logger.warn(`Fetch image url as base64 failed, fallback to raw url: ${item.url}`, e as Error)
                generatedImageUrls.push(item.url)
              }
            }
          }
        } else {
          logger.warn('[ImageGeneration] Unexpected response structure', {
            preview: JSON.stringify(data).slice(0, 500)
          })
        }
      }
      if (generatedImageUrls.length === 0) {
        window.toast.warning(t('imagetoimage.no_images_generated'))
      }

      const completedAt = new Date().toISOString()
      const record = createRecord(
        state.activeSessionId,
        genPrompt,
        inputImageUrls,
        generatedImageUrls,
        currentProvider.id,
        effectiveModelId,
        sentAt,
        completedAt
      )
      dispatch({ type: 'ADD_RECORD', payload: record })
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        logger.error('Image generation failed:', error)
        window.modal.error({ content: getErrorMessage(error), centered: true })
      }
    } finally {
      setIsLoading(false)
      setPendingRecord(null)
      setStreamingImages([])
      abortControllerRef.current = null
      generatingSessionIdRef.current = null
    }
  }

  const handleGenerate = () => {
    if (!currentProvider || !effectiveModelId) {
      window.toast.warning(t('imagetoimage.select_model_first'))
      return
    }
    return doGenerate(prompt, [...inputImages])
  }

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort()
  }

  const handleResendRecord = async (record: (typeof records)[0]) => {
    if (!currentProvider || !effectiveModelId) {
      window.toast.warning(t('imagetoimage.select_model_first'))
      return
    }
    if (isLoading) return
    const filePromises = record.inputImageUrls.map(async (url) => {
      const response = await fetch(url)
      const blob = await response.blob()
      return new File([blob], 'image.png', { type: blob.type || 'image/png' })
    })
    const files = await Promise.all(filePromises)
    return doGenerate(record.prompt, files)
  }

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const displayRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new records arrive
  useEffect(() => {
    if (displayRef.current) {
      displayRef.current.scrollTop = displayRef.current.scrollHeight
    }
  }, [records.length, pendingRecord])

  return (
    <Container>
      <ImageDisplay ref={displayRef}>
        {records.length === 0 && !isCurrentSessionGenerating ? (
          <EmptyState>
            <EmptyIcon>🖼️</EmptyIcon>
            <EmptyText>{t('imagetoimage.history_section.empty')}</EmptyText>
          </EmptyState>
        ) : (
          <ImageGalleryPreview imageUrls={allGeneratedImageUrls}>
            <RecordsGrid>
              {/* Completed records */}
              {[...records].reverse().map((record) => (
                <RecordPair key={record.id}>
                  {/* User message */}
                  <MessageContainer>
                    <MessageHeader>
                      <Avatar
                        size={30}
                        style={{ borderRadius: '25%', flexShrink: 0, backgroundColor: '#52c41a', color: '#fff' }}>
                        You
                      </Avatar>
                      <HeaderInfo>
                        <HeaderName>{t('common.you')}</HeaderName>
                        <HeaderTime>{dayjs(record.createdAt).format('MM/DD HH:mm')}</HeaderTime>
                      </HeaderInfo>
                    </MessageHeader>
                    <MessageBody>
                      {record.prompt && <PromptText>{record.prompt}</PromptText>}
                      {record.inputImageUrls.length > 0 && (
                        <ImageRow>
                          {record.inputImageUrls.map((url, idx) => (
                            <ImageCard key={idx}>
                              <InputImg src={url} />
                            </ImageCard>
                          ))}
                        </ImageRow>
                      )}
                    </MessageBody>
                    <MessageFooter>
                      <ActionButtons>
                        <Tooltip title={t('imagetoimage.resend')}>
                          <ActionButton onClick={() => void handleResendRecord(record)}>
                            <RefreshIcon size={14} />
                          </ActionButton>
                        </Tooltip>
                        <Tooltip title={t('imagetoimage.copy')}>
                          <ActionButton onClick={() => handleCopyText(record.prompt, record.id)}>
                            {copiedId === record.id ? (
                              <Check size={14} color="var(--color-primary)" />
                            ) : (
                              <CopyIcon size={14} />
                            )}
                          </ActionButton>
                        </Tooltip>
                        <Popconfirm
                          title={t('imagetoimage.delete_record_confirm')}
                          onConfirm={() => dispatch({ type: 'REMOVE_RECORD', payload: { id: record.id } })}
                          okText={t('common.confirm')}
                          cancelText={t('common.cancel')}>
                          <Tooltip title={t('common.delete')}>
                            <ActionButton>
                              <DeleteIcon size={14} />
                            </ActionButton>
                          </Tooltip>
                        </Popconfirm>
                      </ActionButtons>
                    </MessageFooter>
                  </MessageContainer>

                  {/* AI response */}
                  {record.generatedImageUrls.length > 0 && (
                    <MessageContainer>
                      <MessageHeader>
                        {modelLogoSrc ? (
                          <Avatar size={30} src={modelLogoSrc} style={{ borderRadius: '25%', flexShrink: 0 }} />
                        ) : currentProvider ? (
                          <ProviderAvatar provider={currentProvider} size={30} />
                        ) : (
                          <Avatar size={30} style={{ borderRadius: '25%', flexShrink: 0 }}>
                            AI
                          </Avatar>
                        )}
                        <HeaderInfo>
                          <HeaderName>
                            {currentProvider?.name && effectiveModelId
                              ? `${currentProvider.name} / ${effectiveModelId}`
                              : currentProvider?.name || 'AI'}
                          </HeaderName>
                          <HeaderTime>
                            {record.completedAt
                              ? dayjs(record.completedAt).format('MM/DD HH:mm')
                              : dayjs(record.createdAt).format('MM/DD HH:mm')}
                          </HeaderTime>
                        </HeaderInfo>
                      </MessageHeader>
                      <MessageBody>
                        <ImageRow>
                          {record.generatedImageUrls.map((url, idx) => (
                            <ImageCard key={idx}>
                              <GalleryImage src={url} />
                            </ImageCard>
                          ))}
                        </ImageRow>
                      </MessageBody>
                    </MessageContainer>
                  )}
                </RecordPair>
              ))}

              {/* Pending (loading) message */}
              {pendingRecord && isCurrentSessionGenerating && (
                <MessageContainer>
                  <MessageHeader>
                    <Avatar
                      size={30}
                      style={{ borderRadius: '25%', flexShrink: 0, backgroundColor: '#52c41a', color: '#fff' }}>
                      You
                    </Avatar>
                    <HeaderInfo>
                      <HeaderName>{t('common.you')}</HeaderName>
                      <HeaderTime>{dayjs(pendingRecord.sentAt).format('MM/DD HH:mm')}</HeaderTime>
                    </HeaderInfo>
                  </MessageHeader>
                  <MessageBody>
                    {pendingRecord.prompt && <PromptText>{pendingRecord.prompt}</PromptText>}
                    {pendingRecord.inputImageUrls.length > 0 && (
                      <ImageRow>
                        {pendingRecord.inputImageUrls.map((url, idx) => (
                          <ThumbImg key={idx} src={url} />
                        ))}
                      </ImageRow>
                    )}
                    {streamingImages.length > 0 && (
                      <ImageRow style={{ marginBottom: 8 }}>
                        {streamingImages.map((url, idx) => (
                          <ImageCard key={idx}>
                            <StreamingImg src={url} />
                          </ImageCard>
                        ))}
                      </ImageRow>
                    )}
                    <LoadingIndicator>
                      <Spin size="small" />
                      <LoadingText>{t('imagetoimage.generating')}</LoadingText>
                    </LoadingIndicator>
                  </MessageBody>
                </MessageContainer>
              )}
            </RecordsGrid>
          </ImageGalleryPreview>
        )}
      </ImageDisplay>

      <InputContainer>
        {inputImages.length > 0 && (
          <ImagePreviewBar>
            {inputImages.map((file, idx) => (
              <PreviewItem key={idx}>
                <PreviewImg src={URL.createObjectURL(file)} />
                <RemoveBtn onClick={() => handleRemoveImage(idx)}>×</RemoveBtn>
              </PreviewItem>
            ))}
          </ImagePreviewBar>
        )}
        <PromptInput
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('imagetoimage.prompt_section.placeholder')}
          disabled={isCurrentSessionGenerating}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isCurrentSessionGenerating) {
              e.preventDefault()
              void handleGenerate()
            }
          }}
        />
        <Toolbar>
          <ToolbarLeft>
            <Upload accept="image/*" showUploadList={false} beforeUpload={handleImageUpload} multiple>
              <UploadButton>+</UploadButton>
            </Upload>
            {inputImages.length > 0 && (
              <ClearButton onClick={() => setInputImages([])}>{t('imagetoimage.clear_images')}</ClearButton>
            )}
            <ParamDivider />
            <ParamLabel>{t('imagetoimage.param_n')}</ParamLabel>
            <ParamSelect
              value={activeSession?.imageN ?? 1}
              onChange={(v) => updateSessionParam({ imageN: v ?? 1 })}
              size="small"
              style={{ width: 56 }}
              options={Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1), value: i + 1 }))}
            />
            <ParamLabel>{t('imagetoimage.param_size')}</ParamLabel>
            <SizeAutoComplete
              value={activeSession?.imageSize ?? '1024x1024'}
              onChange={(v) => updateSessionParam({ imageSize: v })}
              size="small"
              style={{ width: 110 }}
              options={SIZE_OPTIONS}
              placeholder="e.g. 512x512"
            />
            <ParamLabel>{t('imagetoimage.param_quality')}</ParamLabel>
            <ParamSelect
              value={activeSession?.imageQuality ?? 'auto'}
              onChange={(v) => updateSessionParam({ imageQuality: v })}
              size="small"
              style={{ width: 88 }}
              options={QUALITY_OPTIONS}
            />
            <ParamLabel>{t('imagetoimage.param_response_format')}</ParamLabel>
            <ParamSelect
              value={activeSession?.imageResponseFormat ?? 'b64_json'}
              onChange={(v) => updateSessionParam({ imageResponseFormat: v })}
              size="small"
              style={{ width: 100 }}
              options={[
                { label: 'b64_json', value: 'b64_json' },
                { label: 'url', value: 'url' }
              ]}
            />
          </ToolbarLeft>
          <ToolbarRight>
            {records.length > 0 && (
              <Popconfirm
                title={t('imagetoimage.clear_history_confirm')}
                onConfirm={() =>
                  dispatch({ type: 'CLEAR_SESSION_RECORDS', payload: { sessionId: state.activeSessionId } })
                }
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}>
                <ClearHistoryButton>{t('imagetoimage.clear_history')}</ClearHistoryButton>
              </Popconfirm>
            )}
            {isCurrentSessionGenerating ? (
              <StopButton onClick={handleStopGeneration}>{t('imagetoimage.stop')}</StopButton>
            ) : (
              <SendMessageButton sendMessage={handleGenerate} disabled={!prompt.trim() || isLoading} />
            )}
          </ToolbarRight>
        </Toolbar>
      </InputContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-background);
  min-width: 0;
`

const ImageDisplay = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px 20px;
`

const EmptyIcon = styled.span`
  font-size: 48px;
  margin-bottom: 12px;
`

const EmptyText = styled.p`
  color: var(--color-text-3);
  font-size: 14px;
`

const RecordsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
`

const RecordPair = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
  padding: 10px 0;
`

const MessageHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
`

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`

const HeaderName = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
`

const HeaderTime = styled.span`
  font-size: 10px;
  color: var(--color-text-3);
`

const MessageBody = styled.div`
  display: flex;
  flex-direction: column;
  padding-left: 40px;
`

const MessageFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-left: 40px;
  margin-top: 4px;
`

const PromptText = styled.div`
  font-size: 14px;
  color: var(--color-text);
  word-break: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  margin-bottom: 8px;
  line-height: 1.5;
  user-select: text;
`

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;

  ${MessageContainer}:hover & {
    opacity: 1;
  }
`

const ActionButton = styled.button`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover {
    color: var(--color-text-1);
    background: var(--color-background-2);
  }
`

const ImageRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`

const ImageCard = styled.div`
  overflow: hidden;
  max-width: 100%;
  flex-shrink: 0;
  border-radius: 8px;
`

const ThumbImg = styled.img`
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  opacity: 0.6;
`

/** Input images: plain <img>, NOT registered with PreviewGroup */
const InputImg = styled.img`
  display: block;
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  border-radius: 8px;
  cursor: default;
`

/** Streaming images: plain <img> during generation */
const StreamingImg = styled.img`
  display: block;
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  border-radius: 8px;
  cursor: default;
`

/** Context menu for gallery images (copy URL, download) */
function getImageContextMenu(src: string, t: (key: string) => string): MenuProps['items'] {
  return [
    {
      key: 'copy-url',
      label: t('preview.copy.src'),
      icon: <CopyIcon size={14} />,
      onClick: () => {
        void navigator.clipboard.writeText(src)
        window.toast.success(t('message.copy.success'))
      }
    },
    {
      key: 'download',
      label: t('common.download'),
      icon: <DownloadIcon size={14} />,
      onClick: () => download(src)
    }
  ]
}

/** Gallery image: AntImage inside PreviewGroup, no conflicting toolbarRender */
const GalleryImage: React.FC<{ src: string }> = ({ src }) => {
  const { t } = useTranslation()
  return (
    <Dropdown menu={{ items: getImageContextMenu(src, t) }} trigger={['contextMenu']}>
      <StyledGalleryImage src={src} preview={{ mask: false }} onContextMenu={(e) => e.stopPropagation()} />
    </Dropdown>
  )
}

const StyledGalleryImage = styled(AntImage)`
  display: block;
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  border-radius: 8px;
  cursor: pointer;
`

const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
`

const LoadingText = styled.span`
  font-size: 13px;
  color: var(--color-text-3);
`

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  border: 0.5px solid var(--color-border);
  border-radius: 17px;
  margin: 0 18px 18px 18px;
  padding-top: 8px;
  background-color: var(--color-background-opacity);
  overflow: hidden;
  transition: all 0.2s ease;
`

const ImagePreviewBar = styled.div`
  display: flex;
  gap: 8px;
  padding: 0 10px;
  overflow-x: auto;
`

const PreviewItem = styled.div`
  position: relative;
  flex-shrink: 0;
`

const PreviewImg = styled.img`
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--color-border);
`

const RemoveBtn = styled.button`
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;

  &:hover {
    background: rgba(239, 68, 68, 0.8);
  }
`

const PromptInput = styled.textarea`
  padding: 6px 15px 0;
  border: none;
  outline: none;
  border-radius: 0;
  resize: none;
  overflow: auto;
  width: 100%;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.4;
  box-sizing: border-box;
  min-height: 50px;
  max-height: 200px;

  &::placeholder {
    color: var(--color-text-3);
  }
`

const Toolbar = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  height: 40px;
`

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`

const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const UploadButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-2);
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const ClearButton = styled.button`
  background: none;
  border: none;
  color: var(--color-text-3);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;

  &:hover {
    color: var(--color-text-1);
  }
`

const ClearHistoryButton = styled.button`
  background: none;
  border: none;
  color: var(--color-text-3);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;

  &:hover {
    color: var(--color-text-1);
  }
`

const StopButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background-2);
  color: var(--color-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-error);
    color: var(--color-error);
  }
`

const ParamDivider = styled.div`
  width: 1px;
  height: 16px;
  background: var(--color-border);
  margin: 0 2px;
`

const ParamLabel = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
  white-space: nowrap;
`

const SizeAutoComplete = styled(AutoComplete)`
  .ant-select-selector {
    font-size: 12px !important;
    padding: 0 4px !important;
    min-height: 24px !important;
    height: 24px !important;
  }
  .ant-select-selection-search-input {
    font-size: 12px !important;
    height: 22px !important;
  }
`

const ParamSelect = styled(Select)`
  .ant-select-selector {
    font-size: 12px !important;
    padding: 0 4px !important;
    min-height: 24px !important;
    height: 24px !important;
  }
  .ant-select-selection-item {
    line-height: 22px !important;
    font-size: 12px !important;
  }
`

export default ImageGenerationArea
