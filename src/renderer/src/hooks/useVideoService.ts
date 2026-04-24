import { loggerService } from '@logger'
import { initVideoServiceManager } from '@renderer/services/VideoServiceManager'
import type { RootState } from '@renderer/store'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setVideoServiceDownloadAction, setVideoServiceRunningAction } from '@renderer/store/runtime'
import { useCallback, useEffect, useState } from 'react'

const logger = loggerService.withContext('useVideoService')

export const useVideoService = () => {
  const dispatch = useAppDispatch()
  const videoServiceConfig = useAppSelector((state: RootState) => state.settings.videoService) || {
    enabled: false,
    windowsUrl: 'https://huangjia.pw:8888/s/6a5f592a85d7406887',
    macUrl: 'https://huangjia.pw:8888/s/6a5f592a85d7406887',
    port: 7890
  }
  const videoServiceRunning = useAppSelector((state: RootState) => state.runtime.videoServiceRunning) || false
  const downloadState = useAppSelector((state: RootState) => state.runtime.videoServiceDownload)
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
      dispatch(setVideoServiceRunningAction(isRunning))
    } catch (error) {
      logger.error('Failed to check video service status', error as Error)
    } finally {
      setLoading(false)
    }
  }, [dispatch, manager])

  const startService = useCallback(async () => {
    setLoading(true)
    try {
      const result = await manager.start(videoServiceConfig.port)
      if (result) {
        dispatch(setVideoServiceRunningAction(true))
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
        dispatch(setVideoServiceRunningAction(false))
      }
      return result
    } finally {
      setLoading(false)
    }
  }, [dispatch, manager])

  const doDownload = useCallback(async () => {
    dispatch(setVideoServiceDownloadAction({ loading: true, progress: 0, status: 'downloading' }))
    const unsubscribe = window.api.videoService.onDownloadProgress((progress) => {
      dispatch(setVideoServiceDownloadAction({ loading: true, progress: progress.percent, status: progress.status }))
    })
    try {
      const url = navigator.platform.includes('Mac') ? videoServiceConfig.macUrl : videoServiceConfig.windowsUrl
      const result = await manager.download(url)
      if (result) {
        setInstalled(true)
      }
      return result
    } finally {
      unsubscribe()
      dispatch(setVideoServiceDownloadAction({ loading: false, progress: 0, status: '' }))
    }
  }, [dispatch, manager, videoServiceConfig.macUrl, videoServiceConfig.windowsUrl])

  const downloadService = doDownload
  const updateService = doDownload

  const getServiceUrl = useCallback(() => {
    return manager.getServiceUrl()
  }, [manager])

  const openFolder = useCallback(async () => {
    await manager.openFolder()
  }, [manager])

  useEffect(() => {
    void checkStatus()
  }, [checkStatus])

  return {
    videoServiceConfig,
    videoServiceRunning,
    loading: loading || downloadState.loading,
    installed,
    downloadProgress: { percent: downloadState.progress, status: downloadState.status },
    checkStatus,
    startService,
    stopService,
    downloadService,
    updateService,
    openFolder,
    getServiceUrl
  }
}
