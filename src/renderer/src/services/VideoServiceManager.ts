import { loggerService } from '@logger'
import type { RootState } from '@renderer/store'

const logger = loggerService.withContext('VideoServiceManager')

class VideoServiceManagerClass {
  private getState: () => RootState

  constructor(getState: () => RootState) {
    this.getState = getState
  }

  async checkInstalled(): Promise<boolean> {
    try {
      const status = await window.api.videoService.getStatus()
      return status.installed
    } catch (error) {
      logger.error('Failed to check video service status', error as Error)
      return false
    }
  }

  async checkRunning(): Promise<boolean> {
    try {
      const status = await window.api.videoService.getStatus()
      return status.running
    } catch (error) {
      logger.error('Failed to check video service running status', error as Error)
      return false
    }
  }

  async download(url: string): Promise<boolean> {
    try {
      const result = await window.api.videoService.download(url)
      return result.success
    } catch (error) {
      logger.error('Failed to download video service', error as Error)
      return false
    }
  }

  async start(port: number): Promise<boolean> {
    try {
      const result = await window.api.videoService.start(port)
      return result.success
    } catch (error) {
      logger.error('Failed to start video service', error as Error)
      return false
    }
  }

  async stop(): Promise<boolean> {
    try {
      const result = await window.api.videoService.stop()
      return result.success
    } catch (error) {
      logger.error('Failed to stop video service', error as Error)
      return false
    }
  }

  getServiceUrl(): string {
    const config = this.getState().settings.videoService
    return `http://localhost:${config.port}`
  }
}

let instance: VideoServiceManagerClass | null = null

export const initVideoServiceManager = (getState: () => RootState) => {
  if (!instance) {
    instance = new VideoServiceManagerClass(getState)
  }
  return instance
}

export const getVideoServiceManager = () => instance
