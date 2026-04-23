import { ChildProcess, spawn } from 'child_process'
import type { IpcMainInvokeEvent } from 'electron'
import { app } from 'electron'
import { IpcChannel, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { loggerService } from './LoggerService'

const logger = loggerService.withContext('VideoService')

export class VideoService {
  private process: ChildProcess | null = null
  private serviceDir: string
  private configPath: string

  constructor() {
    this.serviceDir = path.join(app.getPath('userData'), 'video-service')
    this.configPath = path.join(this.serviceDir, 'config.yaml')
  }

  async checkInstalled(): Promise<boolean> {
    const execName = process.platform === 'win32' ? 'video-service.exe' : 'video-service'
    const execPath = path.join(this.serviceDir, execName)
    return fs.existsSync(execPath)
  }

  async getStatus(): Promise<{ running: boolean; installed: boolean }> {
    const installed = await this.checkInstalled()
    return {
      running: this.process !== null,
      installed
    }
  }

  async writeConfig(port: number, apiServerUrl: string, apiKey: string): Promise<void> {
    const configContent = `base_url: "${apiServerUrl}"
api_key: "${apiKey}"
`
    if (!fs.existsSync(this.serviceDir)) {
      fs.mkdirSync(this.serviceDir, { recursive: true })
    }
    fs.writeFileSync(this.configPath, configContent, 'utf-8')
    logger.info(`Config written to ${this.configPath}`)
  }

  async start(port: number): Promise<{ success: boolean; error?: string }> {
    try {
      const isInstalled = await this.checkInstalled()
      if (!isInstalled) {
        return { success: false, error: 'Service not installed' }
      }

      const execName = process.platform === 'win32' ? 'start.bat' : 'video-service'
      const execPath = path.join(this.serviceDir, execName)
      const args = process.platform === 'win32' ? [String(port)] : ['--port', String(port)]

      this.process = spawn(execPath, args, { cwd: this.serviceDir, detached: false })

      this.process.on('error', (err) => {
        logger.error('VideoService process error:', err)
      })

      this.process.on('exit', (code) => {
        logger.info(`VideoService exited with code ${code}`)
        this.process = null
      })

      return { success: true }
    } catch (error: any) {
      logger.error('Failed to start VideoService:', error)
      return { success: false, error: error.message }
    }
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.process) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(this.process.pid), '/f'])
        } else {
          this.process.kill('SIGTERM')
        }
        this.process = null
      }
      return { success: true }
    } catch (error: any) {
      logger.error('Failed to stop VideoService:', error)
      return { success: false, error: error.message }
    }
  }

  async download(url: string): Promise<{ success: boolean; error?: string }> {
    // 下载逻辑由Electron的net模块实现，这里返回成功
    logger.info(`Download requested from ${url}`)
    return { success: true }
  }
}

// IPC Handler registration
let videoServiceInstance: VideoService | null = null

export const getVideoService = () => {
  if (!videoServiceInstance) {
    videoServiceInstance = new VideoService()
  }
  return videoServiceInstance
}

export const registerVideoServiceHandlers = () => {
  const service = getVideoService()

  ipcMain.handle(IpcChannel.VideoService_GetStatus, async () => {
    return await service.getStatus()
  })

  ipcMain.handle(IpcChannel.VideoService_Start, async (_event: IpcMainInvokeEvent, port: number) => {
    return await service.start(port)
  })

  ipcMain.handle(IpcChannel.VideoService_Stop, async () => {
    return await service.stop()
  })

  ipcMain.handle(IpcChannel.VideoService_Download, async (_event: IpcMainInvokeEvent, url: string) => {
    return await service.download(url)
  })
}

export { getVideoService, registerVideoServiceHandlers, VideoService }
