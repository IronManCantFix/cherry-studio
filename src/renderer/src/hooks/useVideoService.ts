import { loggerService } from '@logger'
import { initVideoServiceManager } from '@renderer/services/VideoServiceManager'
import type { RootState } from '@renderer/store'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setVideoServiceRunning } from '@renderer/store/runtime'
import { useCallback, useEffect, useState } from 'react'

const logger = loggerService.withContext('useVideoService')

export const useVideoService = () => {
  const dispatch = useAppDispatch()
  const videoServiceConfig = useAppSelector((state: RootState) => state.settings.videoService)
  const videoServiceRunning = useAppSelector((state: RootState) => state.runtime.videoServiceRunning)
  const [loading, setLoading] = useState(false)
  const [installed, setInstalled] = useState(false)

  const manager = initVideoServiceManager((() => {
    return { settings: { videoService: videoServiceConfig } } as RootState
  }) as () => RootState)

  const checkStatus = useCallback(async () => {
    setLoading(true)
    try {
      const isInstalled = await manager.checkInstalled()
      setInstalled(isInstalled)
      const isRunning = await manager.checkRunning()
      dispatch(setVideoServiceRunning(isRunning))
    } catch (error) {
      logger.error('Failed to check video service status:', error)
    } finally {
      setLoading(false)
    }
  }, [dispatch, manager])

  const startService = useCallback(async () => {
    setLoading(true)
    try {
      const result = await manager.start(videoServiceConfig.port)
      if (result) {
        dispatch(setVideoServiceRunning(true))
      }
      return result
    } finally {
      setLoading(false)
    }
  }, [dispatch, manager, videoServiceConfig.port])

  const stopService = useCallback(async () => {
    setLoading(true)
    try {
      const result = await manager.stop()
      if (result) {
        dispatch(setVideoServiceRunning(false))
      }
      return result
    } finally {
      setLoading(false)
    }
  }, [dispatch, manager])

  const downloadService = useCallback(async () => {
    setLoading(true)
    try {
      const url = navigator.platform.includes('Mac') ? videoServiceConfig.macUrl : videoServiceConfig.windowsUrl
      const result = await manager.download(url)
      if (result) {
        setInstalled(true)
      }
      return result
    } finally {
      setLoading(false)
    }
  }, [manager, videoServiceConfig.macUrl, videoServiceConfig.windowsUrl])

  const getServiceUrl = useCallback(() => {
    return manager.getServiceUrl()
  }, [manager])

  useEffect(() => {
    void checkStatus()
  }, [checkStatus])

  return {
    videoServiceConfig,
    videoServiceRunning,
    loading,
    installed,
    checkStatus,
    startService,
    stopService,
    downloadService,
    getServiceUrl
  }
}
