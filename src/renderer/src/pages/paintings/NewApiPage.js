import { PlusOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { AiProvider } from '@renderer/aiCore'
import IcImageUp from '@renderer/assets/images/paintings/ic_ImageUp.svg'
import { Navbar, NavbarCenter, NavbarRight } from '@renderer/components/app/Navbar'
import Scrollbar from '@renderer/components/Scrollbar'
import TranslateButton from '@renderer/components/TranslateButton'
import { isMac } from '@renderer/config/constant'
import { getProviderLogo, PROVIDER_URLS } from '@renderer/config/providers'
import { LanguagesEnum } from '@renderer/config/translate'
import { useTheme } from '@renderer/context/ThemeProvider'
import { usePaintings } from '@renderer/hooks/usePaintings'
import { useAllProviders } from '@renderer/hooks/useProvider'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useSettings } from '@renderer/hooks/useSettings'
import {
  getPaintingsBackgroundOptionsLabel,
  getPaintingsImageSizeOptionsLabel,
  getPaintingsModerationOptionsLabel,
  getPaintingsQualityOptionsLabel
} from '@renderer/i18n/label'
import PaintingsList from '@renderer/pages/paintings/components/PaintingsList'
import { DEFAULT_PAINTING, MODELS, SUPPORTED_MODELS } from '@renderer/pages/paintings/config/NewApiConfig'
import FileManager from '@renderer/services/FileManager'
import { translateText } from '@renderer/services/TranslateService'
import { useAppDispatch } from '@renderer/store'
import { setGenerating } from '@renderer/store/runtime'
import { getErrorMessage, uuid } from '@renderer/utils'
import { isNewApiProvider } from '@renderer/utils/provider'
import { Avatar, Button, Empty, InputNumber, Segmented, Select, Upload } from 'antd'
import TextArea from 'antd/es/input/TextArea'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import SendMessageButton from '../home/Inputbar/SendMessageButton'
import { SettingHelpLink, SettingTitle } from '../settings'
import Artboard from './components/Artboard'
import ProviderSelect from './components/ProviderSelect'
import { checkProviderEnabled } from './utils'
const logger = loggerService.withContext('NewApiPage')
const NewApiPage = ({ Options }) => {
  const [mode, setMode] = useState('openai_image_generate')
  const { addPainting, removePainting, updatePainting, openai_image_generate, openai_image_edit } = usePaintings()
  const newApiPaintings = useMemo(() => {
    return {
      openai_image_generate,
      openai_image_edit
    }
  }, [openai_image_generate, openai_image_edit])
  // moved below after newApiProvider is defined
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [abortController, setAbortController] = useState(null)
  const [spaceClickCount, setSpaceClickCount] = useState(0)
  const [isTranslating, setIsTranslating] = useState(false)
  const [editImageFiles, setEditImageFiles] = useState([])
  const { t } = useTranslation()
  const { theme } = useTheme()
  const providers = useAllProviders()
  const location = useLocation()
  const routeName = location.pathname.split('/').pop() || 'new-api'
  const newApiProviders = providers.filter((p) => isNewApiProvider(p))
  const dispatch = useAppDispatch()
  const { generating } = useRuntime()
  const navigate = useNavigate()
  const { autoTranslateWithSpace } = useSettings()
  const spaceClickTimer = useRef(null)
  const newApiProvider = newApiProviders.find((p) => p.id === routeName) || newApiProviders[0]
  const filteredPaintings = useMemo(
    () => (newApiPaintings[mode] || []).filter((p) => p.providerId === newApiProvider.id),
    [newApiPaintings, mode, newApiProvider.id]
  )
  const [painting, setPainting] = useState({ ...DEFAULT_PAINTING, providerId: newApiProvider.id })
  const modeOptions = [
    { label: t('paintings.mode.generate'), value: 'openai_image_generate' },
    { label: t('paintings.mode.edit'), value: 'openai_image_edit' }
  ]
  const textareaRef = useRef(null)
  // 获取编辑模式的图片文件
  const editImages = useMemo(() => {
    return editImageFiles
  }, [editImageFiles])
  const updatePaintingState = useCallback(
    (updates) => {
      const updatedPainting = { ...painting, providerId: newApiProvider.id, ...updates }
      setPainting(updatedPainting)
      updatePainting(mode, updatedPainting)
    },
    [painting, newApiProvider.id, mode, updatePainting]
  )
  // ---------------- Model Related Configurations ----------------
  // const modelOptions = MODELS.map((m) => ({ label: m.name, value: m.name }))
  const modelOptions = useMemo(() => {
    const customModels = newApiProvider.models
      .filter((m) => m.endpoint_type && m.endpoint_type === 'image-generation')
      .map((m) => ({
        label: m.name,
        value: m.id,
        custom: !SUPPORTED_MODELS.includes(m.id),
        group: m.group
      }))
    return [...customModels]
  }, [newApiProvider.models])
  // 根据 group 将模型进行分组，便于在下拉列表中分组渲染
  const groupedModelOptions = useMemo(() => {
    return modelOptions.reduce((acc, option) => {
      const groupName = option.group
      if (!acc[groupName]) {
        acc[groupName] = []
      }
      acc[groupName].push(option)
      return acc
    }, {})
  }, [modelOptions])
  const getNewPainting = useCallback(() => {
    return {
      ...DEFAULT_PAINTING,
      model: painting.model || modelOptions[0]?.value || '',
      id: uuid(),
      providerId: newApiProvider.id
    }
  }, [modelOptions, painting.model, newApiProvider.id])
  const selectedModelConfig = useMemo(
    () => MODELS.find((m) => m.name === painting.model) || MODELS[0],
    [painting.model]
  )
  const handleModelChange = (value) => {
    const modelConfig = MODELS.find((m) => m.name === value)
    const updates = { model: value }
    // 设置默认值
    if (modelConfig?.imageSizes?.length) {
      updates.size = modelConfig.imageSizes[0].value
    }
    if (modelConfig?.quality?.length) {
      updates.quality = modelConfig.quality[0].value
    }
    if (modelConfig?.moderation?.length) {
      updates.moderation = modelConfig.moderation[0].value
    }
    updates.n = 1
    updatePaintingState(updates)
  }
  const handleSizeChange = (value) => {
    updatePaintingState({ size: value })
  }
  const handleQualityChange = (value) => {
    updatePaintingState({ quality: value })
  }
  const handleModerationChange = (value) => {
    updatePaintingState({ moderation: value })
  }
  const handleNChange = (value) => {
    if (value !== null && value !== undefined && value !== '') {
      updatePaintingState({ n: Number(value) })
    }
  }
  const handleError = (error) => {
    if (error instanceof Error && error.name !== 'AbortError') {
      window.modal.error({
        content: getErrorMessage(error),
        centered: true
      })
    }
  }
  const downloadImages = async (urls) => {
    const downloadedFiles = await Promise.all(
      urls.map(async (url) => {
        try {
          if (!url?.trim()) {
            logger.error('图像URL为空')
            window.toast.warning(t('message.empty_url'))
            return null
          }
          return await window.api.file.download(url)
        } catch (error) {
          logger.error('下载图像失败:', error)
          if (
            error instanceof Error &&
            (error.message.includes('Failed to parse URL') || error.message.includes('Invalid URL'))
          ) {
            window.toast.warning(t('message.empty_url'))
          }
          return null
        }
      })
    )
    return downloadedFiles.filter((file) => file !== null)
  }
  const onGenerate = async () => {
    await checkProviderEnabled(newApiProvider, t)
    if (painting.files.length > 0) {
      const confirmed = await window.modal.confirm({
        content: t('paintings.regenerate.confirm'),
        centered: true
      })
      if (!confirmed) return
      await FileManager.deleteFiles(painting.files)
    }
    const prompt = textareaRef.current?.resizableTextArea?.textArea?.value || ''
    updatePaintingState({ prompt })
    const AI = new AiProvider(newApiProvider)
    if (!AI.getApiKey()) {
      window.modal.error({
        content: t('error.no_api_key'),
        centered: true
      })
      return
    }
    if (!painting.model || !painting.prompt) {
      return
    }
    const controller = new AbortController()
    setAbortController(controller)
    setIsLoading(true)
    dispatch(setGenerating(true))
    let body = ''
    const headers = {
      Authorization: `Bearer ${AI.getApiKey()}`
    }
    // NOTE: Cherry Studio当下 newapi只接受v1/images/xxx的请求
    // TODO: support gemini https://www.newapi.ai/zh/docs/api/ai-model/images/gemini/geminirelayv1beta-383837589
    let url = newApiProvider.apiHost.replace(/\/v1$/, '') + `/v1/images/generations`
    let editUrl = newApiProvider.apiHost.replace(/\/v1$/, '') + `/v1/images/edits`
    if (newApiProvider.id === 'aionly') {
      url = newApiProvider.apiHost.replace(/\/v1$/, '') + `/openai/v1/images/generations`
      editUrl = newApiProvider.apiHost.replace(/\/v1$/, '') + `/openai/v1/images/edits`
    }
    try {
      if (mode === 'openai_image_generate') {
        const requestData = {
          prompt,
          model: painting.model,
          size: painting.size === 'auto' ? undefined : painting.size,
          background: painting.background === 'auto' ? undefined : painting.background,
          n: painting.n,
          quality: painting.quality === 'auto' ? undefined : painting.quality,
          moderation: painting.moderation === 'auto' ? undefined : painting.moderation
        }
        body = JSON.stringify(requestData)
        headers['Content-Type'] = 'application/json'
      } else if (mode === 'openai_image_edit') {
        // -------- Edit Mode --------
        if (editImages.length === 0) {
          window.toast.warning(t('paintings.image_file_required'))
          return
        }
        const formData = new FormData()
        formData.append('prompt', prompt)
        formData.append('model', painting.model)
        if (painting.background && painting.background !== 'auto') {
          formData.append('background', painting.background)
        }
        if (painting.size && painting.size !== 'auto') {
          formData.append('size', painting.size)
        }
        if (painting.quality && painting.quality !== 'auto') {
          formData.append('quality', painting.quality)
        }
        if (painting.moderation && painting.moderation !== 'auto') {
          formData.append('moderation', painting.moderation)
        }
        // append images
        editImages.forEach((file) => {
          formData.append('image', file)
        })
        // TODO: mask support later
        body = formData
        // For edit mode we do not set content-type; browser will set multipart boundary
      }
      const requestUrl = mode === 'openai_image_edit' ? editUrl : url
      const response = await fetch(requestUrl, { method: 'POST', headers, body })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || t('paintings.generate_failed'))
      }
      const data = await response.json()
      // 解析图片 - metadata.output.choices 和 data 包含相同图片，只取其中一个
      let urls = []
      let base64s = []

      if (data.metadata?.output?.choices?.length) {
        // 万相/阿里云格式：每个 choice 包含一张图，遍历所有 choices
        for (const choice of data.metadata.output.choices) {
          const content = choice?.message?.content
          if (content) {
            for (const item of content) {
              if (item.image) {
                urls.push(item.image)
              }
            }
          }
        }
      } else if (data.data && Array.isArray(data.data)) {
        // 标准 OpenAI 格式
        urls = data.data.filter((item) => item.url).map((item) => item.url)
        base64s = data.data.filter((item) => item.b64_json).map((item) => item.b64_json)
      }
      if (urls.length > 0) {
        const validFiles = await downloadImages(urls)
        await FileManager.addFiles(validFiles)
        updatePaintingState({ files: validFiles, urls })
      }
      if (base64s?.length > 0) {
        const validFiles = await Promise.all(
          base64s.map(async (base64) => {
            return await window.api.file.saveBase64Image(base64)
          })
        )
        await FileManager.addFiles(validFiles)
        updatePaintingState({ files: validFiles, urls: [] })
      }
    } catch (error) {
      handleError(error)
    } finally {
      setIsLoading(false)
      dispatch(setGenerating(false))
      setAbortController(null)
    }
  }
  const handleRetry = async (painting) => {
    setIsLoading(true)
    try {
      const validFiles = await downloadImages(painting.urls)
      await FileManager.addFiles(validFiles)
      updatePaintingState({ files: validFiles, urls: painting.urls })
    } catch (error) {
      handleError(error)
    } finally {
      setIsLoading(false)
    }
  }
  const onCancel = () => {
    abortController?.abort()
  }
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % painting.files.length)
  }
  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + painting.files.length) % painting.files.length)
  }
  const handleAddPainting = () => {
    const newPainting = addPainting(mode, getNewPainting())
    updatePainting(mode, newPainting)
    setPainting(newPainting)
    return newPainting
  }
  const onDeletePainting = (paintingToDelete) => {
    if (paintingToDelete.id === painting.id) {
      const currentIndex = filteredPaintings.findIndex((p) => p.id === paintingToDelete.id)
      if (currentIndex > 0) {
        setPainting(filteredPaintings[currentIndex - 1])
      } else if (filteredPaintings.length > 1) {
        setPainting(filteredPaintings[1])
      }
    }
    void removePainting(mode, paintingToDelete)
  }
  const translate = async () => {
    if (isTranslating) {
      return
    }
    if (!painting.prompt) {
      return
    }
    try {
      setIsTranslating(true)
      const translatedText = await translateText(painting.prompt, LanguagesEnum.enUS)
      updatePaintingState({ prompt: translatedText })
    } catch (error) {
      logger.error('Translation failed:', error)
    } finally {
      setIsTranslating(false)
    }
  }
  const handleKeyDown = (event) => {
    if (autoTranslateWithSpace && event.key === ' ') {
      setSpaceClickCount((prev) => prev + 1)
      if (spaceClickTimer.current) {
        clearTimeout(spaceClickTimer.current)
      }
      spaceClickTimer.current = setTimeout(() => {
        setSpaceClickCount(0)
      }, 200)
      if (spaceClickCount === 2) {
        setSpaceClickCount(0)
        setIsTranslating(true)
        void translate()
      }
    }
  }
  const handleProviderChange = (providerId) => {
    const routeName = location.pathname.split('/').pop()
    if (providerId !== routeName) {
      navigate('../' + providerId, { replace: true })
    }
  }
  // 处理模式切换
  const handleModeChange = (value) => {
    setMode(value)
    const list = (newApiPaintings[value] || []).filter((p) => p.providerId === newApiProvider.id)
    setPainting(list[0] || { ...DEFAULT_PAINTING, providerId: newApiProvider.id })
  }
  // 渲染配置项的函数
  const onSelectPainting = (newPainting) => {
    if (generating) return
    setPainting(newPainting)
    setCurrentImageIndex(0)
  }
  const handleImageUpload = (file) => {
    setEditImageFiles((prev) => [...prev, file])
    return false // 阻止默认上传行为
  }
  // 当 modelOptions 为空时，引导用户跳转到 Provider 设置页面，新增 image-generation 端点模型
  const handleShowAddModelPopup = () => {
    navigate(`/settings/provider?id=${newApiProvider.id}`)
  }
  useEffect(() => {
    if (filteredPaintings.length === 0) {
      const newPainting = getNewPainting()
      addPainting(mode, newPainting)
      setPainting(newPainting)
    } else {
      // 如果当前 painting 存在于 filteredPaintings 中，则优先显示当前 painting
      const found = filteredPaintings.find((p) => p.id === painting.id)
      if (found) {
        setPainting(found)
      } else {
        setPainting(filteredPaintings[0])
      }
    }
  }, [filteredPaintings, mode, addPainting, getNewPainting, painting.id])
  useEffect(() => {
    const timer = spaceClickTimer.current
    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [])
  // if painting.model is not set, set it to the first model in modelOptions
  useEffect(() => {
    if (!painting.model && modelOptions.length > 0) {
      updatePaintingState({ model: modelOptions[0].value })
    }
  }, [modelOptions, painting.model, updatePaintingState])
  return _jsxs(Container, {
    children: [
      _jsxs(Navbar, {
        children: [
          _jsx(NavbarCenter, { style: { borderRight: 'none' }, children: t('paintings.title') }),
          isMac &&
            _jsx(NavbarRight, {
              style: { justifyContent: 'flex-end' },
              children: _jsx(Button, {
                size: 'small',
                className: 'nodrag',
                icon: _jsx(PlusOutlined, {}),
                onClick: handleAddPainting,
                children: t('paintings.button.new.image')
              })
            })
        ]
      }),
      _jsxs(ContentContainer, {
        id: 'content-container',
        children: [
          _jsxs(LeftContainer, {
            children: [
              _jsxs(ProviderTitleContainer, {
                children: [
                  _jsx(SettingTitle, { style: { marginBottom: 5 }, children: t('common.provider') }),
                  _jsxs(SettingHelpLink, {
                    target: '_blank',
                    href:
                      PROVIDER_URLS[newApiProvider.id]?.websites?.docs || 'https://docs.newapi.pro/apps/cherry-studio/',
                    children: [
                      t('paintings.learn_more'),
                      _jsx(ProviderLogo, {
                        shape: 'square',
                        src: getProviderLogo(newApiProvider.id),
                        size: 16,
                        style: { marginLeft: 5 }
                      })
                    ]
                  })
                ]
              }),
              _jsx(ProviderSelect, { provider: newApiProvider, options: Options, onChange: handleProviderChange }),
              modelOptions.length === 0 &&
                _jsx(Empty, {
                  style: { marginTop: 24 },
                  description: t('paintings.no_image_generation_model', {
                    endpoint_type: t('endpoint_type.image-generation')
                  }),
                  children: _jsx(Button, {
                    type: 'primary',
                    onClick: handleShowAddModelPopup,
                    children: t('paintings.go_to_settings')
                  })
                }),
              modelOptions.length > 0 &&
                _jsxs(_Fragment, {
                  children: [
                    mode === 'openai_image_edit' &&
                      _jsxs(_Fragment, {
                        children: [
                          _jsx(SettingTitle, { style: { marginTop: 20 }, children: t('paintings.input_image') }),
                          _jsx(ImageUploadButton, {
                            accept: 'image/png, image/jpeg, image/gif',
                            maxCount: 16,
                            showUploadList: true,
                            listType: 'picture',
                            beforeUpload: handleImageUpload,
                            fileList: editImageFiles.map((file, idx) => {
                              const rcFile = {
                                ...file,
                                uid: String(idx),
                                lastModifiedDate: file.lastModified ? new Date(file.lastModified) : new Date()
                              }
                              return {
                                uid: rcFile.uid,
                                name: rcFile.name || `image_${idx + 1}.png`,
                                status: 'done',
                                url: URL.createObjectURL(file),
                                originFileObj: rcFile,
                                lastModifiedDate: rcFile.lastModifiedDate
                              }
                            }),
                            onRemove: (file) => {
                              setEditImageFiles((prev) =>
                                prev.filter((f) => {
                                  const idx = prev.indexOf(f)
                                  return String(idx) !== file.uid
                                })
                              )
                              return true
                            },
                            children: _jsx(ImagePlaceholder, {
                              children: _jsx(ImageSizeImage, { src: IcImageUp, theme: theme })
                            })
                          })
                        ]
                      }),
                    _jsx(SettingTitle, { style: { marginTop: 20 }, children: t('paintings.model') }),
                    _jsx(Select, {
                      value: painting.model,
                      onChange: handleModelChange,
                      style: { width: '100%', marginBottom: 15 },
                      children: Object.entries(groupedModelOptions).map(([groupName, options]) =>
                        _jsx(
                          Select.OptGroup,
                          {
                            label: groupName,
                            children: options.map((m) =>
                              _jsx(Select.Option, { value: m.value, children: m.label }, m.value)
                            )
                          },
                          groupName
                        )
                      )
                    }),
                    selectedModelConfig?.imageSizes &&
                      selectedModelConfig.imageSizes.length > 0 &&
                      _jsxs(_Fragment, {
                        children: [
                          _jsx(SettingTitle, { children: t('paintings.image.size') }),
                          _jsx(Select, {
                            value: painting.size,
                            onChange: handleSizeChange,
                            style: { width: '100%', marginBottom: 15 },
                            children: selectedModelConfig.imageSizes.map((s) =>
                              _jsx(
                                Select.Option,
                                { value: s.value, children: getPaintingsImageSizeOptionsLabel(s.value) ?? s.value },
                                s.value
                              )
                            )
                          })
                        ]
                      }),
                    selectedModelConfig?.quality &&
                      selectedModelConfig.quality.length > 0 &&
                      _jsxs(_Fragment, {
                        children: [
                          _jsx(SettingTitle, { children: t('paintings.quality') }),
                          _jsx(Select, {
                            value: painting.quality,
                            onChange: handleQualityChange,
                            style: { width: '100%', marginBottom: 15 },
                            children: selectedModelConfig.quality.map((q) =>
                              _jsx(
                                Select.Option,
                                { value: q.value, children: getPaintingsQualityOptionsLabel(q.value) ?? q.value },
                                q.value
                              )
                            )
                          })
                        ]
                      }),
                    mode !== 'openai_image_edit' &&
                      selectedModelConfig?.moderation &&
                      selectedModelConfig.moderation.length > 0 &&
                      _jsxs(_Fragment, {
                        children: [
                          _jsx(SettingTitle, { children: t('paintings.moderation') }),
                          _jsx(Select, {
                            value: painting.moderation,
                            onChange: handleModerationChange,
                            style: { width: '100%', marginBottom: 15 },
                            children: selectedModelConfig.moderation.map((m) =>
                              _jsx(
                                Select.Option,
                                { value: m.value, children: getPaintingsModerationOptionsLabel(m.value) ?? m.value },
                                m.value
                              )
                            )
                          })
                        ]
                      }),
                    mode === 'openai_image_edit' &&
                      selectedModelConfig?.background &&
                      selectedModelConfig.background.length > 0 &&
                      _jsxs(_Fragment, {
                        children: [
                          _jsx(SettingTitle, { children: t('paintings.background') }),
                          _jsx(Select, {
                            value: painting.background,
                            onChange: (value) => updatePaintingState({ background: value }),
                            style: { width: '100%', marginBottom: 15 },
                            children: selectedModelConfig.background.map((b) =>
                              _jsx(
                                Select.Option,
                                { value: b.value, children: getPaintingsBackgroundOptionsLabel(b.value) ?? b.value },
                                b.value
                              )
                            )
                          })
                        ]
                      }),
                    selectedModelConfig?.max_images &&
                      _jsxs(_Fragment, {
                        children: [
                          _jsx(SettingTitle, { children: t('paintings.number_images') }),
                          _jsx(InputNumber, {
                            min: 1,
                            max: selectedModelConfig.max_images,
                            value: painting.n || 1,
                            onChange: handleNChange,
                            style: { width: '100%', marginBottom: 15 }
                          })
                        ]
                      })
                  ]
                })
            ]
          }),
          _jsxs(MainContainer, {
            children: [
              _jsx(ModeSegmentedContainer, {
                children: _jsx(Segmented, {
                  shape: 'round',
                  value: mode,
                  onChange: handleModeChange,
                  options: modeOptions
                })
              }),
              _jsx(Artboard, {
                painting: painting,
                isLoading: isLoading,
                currentImageIndex: currentImageIndex,
                onPrevImage: prevImage,
                onNextImage: nextImage,
                onCancel: onCancel,
                retry: handleRetry
              }),
              _jsxs(InputContainer, {
                children: [
                  _jsx(Textarea, {
                    ref: textareaRef,
                    variant: 'borderless',
                    disabled: isLoading,
                    value: painting.prompt,
                    spellCheck: false,
                    onChange: (e) => updatePaintingState({ prompt: e.target.value }),
                    placeholder: isTranslating
                      ? t('paintings.translating')
                      : painting.model?.startsWith('imagen-')
                        ? t('paintings.prompt_placeholder_en')
                        : t('paintings.prompt_placeholder_edit'),
                    onKeyDown: handleKeyDown
                  }),
                  _jsx(Toolbar, {
                    children: _jsxs(ToolbarMenu, {
                      children: [
                        _jsx(TranslateButton, {
                          text: textareaRef.current?.resizableTextArea?.textArea?.value,
                          onTranslated: (translatedText) => updatePaintingState({ prompt: translatedText }),
                          disabled: isLoading || isTranslating,
                          isLoading: isTranslating,
                          style: { marginRight: 6, borderRadius: '50%' }
                        }),
                        _jsx(SendMessageButton, { sendMessage: onGenerate, disabled: isLoading })
                      ]
                    })
                  })
                ]
              })
            ]
          }),
          _jsx(PaintingsList, {
            namespace: mode,
            paintings: filteredPaintings,
            selectedPainting: painting,
            onSelectPainting: onSelectPainting,
            onDeletePainting: onDeletePainting,
            onNewPainting: handleAddPainting
          })
        ]
      })
    ]
  })
}
const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
`
const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  height: 100%;
  background-color: var(--color-background);
  overflow: hidden;
`
const LeftContainer = styled(Scrollbar)`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  background-color: var(--color-background);
  max-width: var(--assistants-width);
  border-right: 0.5px solid var(--color-border);
`
const MainContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-background);
`
const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 95px;
  max-height: 95px;
  position: relative;
  border: 1px solid var(--color-border-soft);
  transition: all 0.3s ease;
  margin: 0 20px 15px 20px;
  border-radius: 10px;
`
const Textarea = styled(TextArea)`
  padding: 10px;
  border-radius: 0;
  display: flex;
  flex: 1;
  resize: none !important;
  overflow: auto;
  width: auto;
`
const Toolbar = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  justify-content: flex-end;
  padding: 0 8px;
  padding-bottom: 0;
  height: 40px;
`
const ToolbarMenu = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
`
const ProviderLogo = styled(Avatar)`
  border: 0.5px solid var(--color-border);
`
const ModeSegmentedContainer = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 24px;
`
const ProviderTitleContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
`
const ImageUploadButton = styled(Upload)`
  & .ant-upload.ant-upload-select {
    width: 100% !important;
    height: 60px !important;
    border: 1px dashed var(--color-border);
  }
`
const ImagePlaceholder = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  height: 100%;
  cursor: pointer;
  gap: 8px;
`
const ImageSizeImage = styled.img`
  filter: ${({ theme }) => (theme === 'dark' ? 'invert(100%)' : 'none')};
  width: 20px;
  height: 20px;
`
export default NewApiPage
