import { loggerService } from '@logger'
import { useAllProviders } from '@renderer/hooks/useProvider'
import { useAppDispatch } from '@renderer/store'
import { setDefaultPaintingProvider } from '@renderer/store/settings'
import { updateTab } from '@renderer/store/tabs'
import type { PaintingProvider, SystemProviderId } from '@renderer/types'
import { isPaintingOpenAIImageProvider } from '@renderer/utils/provider'
import type { FC } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'

import AihubmixPage from './AihubmixPage'
import DmxapiPage from './DmxapiPage'
import NewApiPage from './NewApiPage'
import OvmsPage from './OvmsPage'
import PpioPage from './PpioPage'
import SiliconPage from './SiliconPage'
import TokenFluxPage from './TokenFluxPage'
import { decodePaintingProviderId, getPaintingProviderPath } from './utils'
import ZhipuPage from './ZhipuPage'

const logger = loggerService.withContext('PaintingsRoutePage')

// 绘图模块专属内置 provider：有独立的页面 + 独立的 API Key 配置，
// 与 LLM 设置中的 enabled 状态独立，因此始终在列表中显示（ovms 仍按运行状态判定）。
const BASE_OPTIONS: SystemProviderId[] = ['zhipu', 'aihubmix', 'silicon', 'dmxapi', 'tokenflux', 'ovms', 'ppio']

const PaintingsRoutePage: FC = () => {
  const params = useParams()
  const provider = decodePaintingProviderId(params['*'] || '')
  const dispatch = useAppDispatch()
  const providers = useAllProviders()
  const [ovmsStatus, setOvmsStatus] = useState<'not-installed' | 'not-running' | 'running'>('not-running')

  // 非 BASE_OPTIONS 的 OpenAI/NewApi 类型 provider 才参与"启用 + 图像支持"过滤：
  //  - 排除 BASE_OPTIONS 中的内置专属 provider（它们已在列表中，避免重复）
  //  - OpenAI 类型：必须启用（NewApiPage 内置 SUPPORTED_MODELS 兜底，无需依赖模型列表）
  //  - NewApi 类型：必须启用 + 至少有一个图像生成模型
  const newApiProviders = useMemo(
    () =>
      providers.filter((p) => {
        if (BASE_OPTIONS.includes(p.id as SystemProviderId)) return false
        return isPaintingOpenAIImageProvider(p)
      }),
    [providers]
  )

  const Options = useMemo(() => [...BASE_OPTIONS, ...newApiProviders.map((p) => p.id)], [newApiProviders])

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await window.api.ovms.getStatus()
        setOvmsStatus(status)
      } catch (error) {
        // ovms 在非 Windows / 非 Intel 平台不支持，吞掉错误避免 unhandled rejection
        logger.debug('ovms.getStatus failed', error as Error)
      }
    }
    void checkStatus()
  }, [])

  const validOptions = useMemo(
    () => Options.filter((option) => option !== 'ovms' || ovmsStatus === 'running'),
    [Options, ovmsStatus]
  )

  useEffect(() => {
    logger.debug(`defaultPaintingProvider: ${provider}`)
    if (provider && validOptions.includes(provider)) {
      dispatch(setDefaultPaintingProvider(provider as PaintingProvider))
      dispatch(updateTab({ id: 'paintings', updates: { path: getPaintingProviderPath(provider) } }))
    }
  }, [provider, dispatch, validOptions])

  return (
    <Routes>
      <Route path="/zhipu" element={<ZhipuPage Options={validOptions} />} />
      <Route path="/aihubmix" element={<AihubmixPage Options={validOptions} />} />
      <Route path="/silicon" element={<SiliconPage Options={validOptions} />} />
      <Route path="/dmxapi" element={<DmxapiPage Options={validOptions} />} />
      <Route path="/tokenflux" element={<TokenFluxPage Options={validOptions} />} />
      <Route path="/ovms" element={<OvmsPage Options={validOptions} />} />
      <Route path="/ppio" element={<PpioPage Options={validOptions} />} />
      <Route path="/new-api" element={<NewApiPage Options={validOptions} />} />
      <Route path="/:providerId" element={<NewApiPage Options={validOptions} />} />
      <Route path="*" element={<NewApiPage Options={validOptions} />} />
    </Routes>
  )
}

export default PaintingsRoutePage
