import { IpcChannel } from '@shared/IpcChannel'
import AdmZip from 'adm-zip'
import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import type { IpcMainInvokeEvent } from 'electron'
import { BrowserWindow, ipcMain, net, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { getPluginsPath } from '../utils'
import { loggerService } from './LoggerService'

const logger = loggerService.withContext('VideoService')

export class VideoService {
  private process: ChildProcess | null = null
  private serviceDir: string
  private configPath: string

  constructor() {
    this.serviceDir = getPluginsPath('video-service')
    this.configPath = path.join(this.serviceDir, 'config.yaml')
  }

  async checkInstalled(): Promise<boolean> {
    const execName = process.platform === 'win32' ? 'start.bat' : 'video-service'
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

  async writeConfig(comfyuiUrl: string, comfyuiApiKey: string): Promise<void> {
    const configContent = `comfyui:
  comfyui_url: ${comfyuiUrl}
  comfyui_api_key: '${comfyuiApiKey}'
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

  private sendProgress(percent: number, status: string) {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send(IpcChannel.VideoService_DownloadProgress, { percent, status })
    }
  }

  async download(url: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info(`Downloading video service from ${url}`)
      this.sendProgress(0, 'downloading')

      if (!fs.existsSync(this.serviceDir)) {
        fs.mkdirSync(this.serviceDir, { recursive: true })
      }

      const zipPath = path.join(this.serviceDir, 'video-service.zip')

      // Download with progress
      const response = await net.fetch(url)
      if (!response.ok) {
        return { success: false, error: `Download failed: HTTP ${response.status}` }
      }

      const totalBytes = Number(response.headers.get('content-length') || 0)
      const chunks: Buffer[] = []
      let receivedBytes = 0

      if (response.body) {
        const reader = response.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(Buffer.from(value))
          receivedBytes += value.length
          if (totalBytes > 0) {
            const percent = Math.round((receivedBytes / totalBytes) * 80)
            this.sendProgress(percent, 'downloading')
          }
        }
      }

      const buffer = Buffer.concat(chunks)
      fs.writeFileSync(zipPath, buffer)
      logger.info(`Downloaded to ${zipPath}`)
      this.sendProgress(80, 'extracting')

      // Extract
      const zip = new AdmZip(zipPath)
      zip.extractAllTo(this.serviceDir, true)
      logger.info(`Extracted to ${this.serviceDir}`)
      this.sendProgress(95, 'cleaning')

      // Cleanup zip
      fs.unlinkSync(zipPath)
      this.sendProgress(100, 'done')

      return { success: true }
    } catch (error: any) {
      logger.error('Failed to download video service:', error)
      return { success: false, error: error.message }
    }
  }

  async openFolder(): Promise<void> {
    await shell.openPath(this.serviceDir)
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

  ipcMain.handle(IpcChannel.VideoService_OpenFolder, async () => {
    await service.openFolder()
  })
}
