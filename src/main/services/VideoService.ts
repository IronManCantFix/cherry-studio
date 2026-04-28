import { IpcChannel } from '@shared/IpcChannel'
import AdmZip from 'adm-zip'
import type { ChildProcess } from 'child_process'
import { execSync, spawn } from 'child_process'
import type { IpcMainInvokeEvent } from 'electron'
import { BrowserWindow, ipcMain, shell } from 'electron'
import * as fs from 'fs'
import * as https from 'https'
import * as net from 'net'
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

  private getWinExecPath(): { exePath: string; batPath: string } {
    return {
      exePath: path.join(this.serviceDir, 'pixelle-video.exe'),
      batPath: path.join(this.serviceDir, 'start.bat')
    }
  }

  async checkInstalled(): Promise<boolean> {
    if (process.platform === 'win32') {
      const { exePath, batPath } = this.getWinExecPath()
      return fs.existsSync(exePath) || fs.existsSync(batPath)
    }
    return fs.existsSync(path.join(this.serviceDir, 'video-service'))
  }

  private checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket()
      socket.setTimeout(1000)
      socket.on('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.on('timeout', () => {
        socket.destroy()
        resolve(false)
      })
      socket.on('error', () => {
        socket.destroy()
        resolve(false)
      })
      socket.connect(port, '127.0.0.1')
    })
  }

  async getStatus(): Promise<{ running: boolean; installed: boolean }> {
    const installed = await this.checkInstalled()
    const running = await this.checkPort(8501)
    return { running, installed }
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

  private async waitForPort(port: number, maxRetries = 30): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      if (await this.checkPort(port)) return true
      await new Promise((r) => setTimeout(r, 1000))
    }
    return false
  }

  async start(_port: number, baseUrl?: string, apiKey?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const isInstalled = await this.checkInstalled()
      if (!isInstalled) {
        return { success: false, error: 'Service not installed' }
      }

      // Update model config before starting
      if (baseUrl && apiKey) {
        const configResult = await this.updateModelConfig(baseUrl, apiKey)
        if (!configResult.success) {
          logger.warn(`Failed to update model config before start: ${configResult.error}`)
        }
      }

      if (process.platform === 'win32') {
        const { exePath, batPath } = this.getWinExecPath()

        if (fs.existsSync(exePath)) {
          // Use pixelle-video.exe directly — no VBS needed
          logger.info(`Starting with exe: ${exePath}`)
          this.process = spawn(exePath, [], {
            cwd: this.serviceDir,
            detached: true,
            stdio: 'ignore',
            windowsHide: true
          })
          this.process.unref()
        } else {
          // Fallback: run start.bat silently via VBS (no DOS window)
          const vbsContent = `Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "${this.serviceDir.replace(/\\/g, '\\\\')}"
objShell.Run """${batPath.replace(/\\/g, '\\\\')}""", 0, False`
          const vbsPath = path.join(this.serviceDir, '_start_silent.vbs')
          fs.writeFileSync(vbsPath, vbsContent, 'utf-8')
          this.process = spawn('wscript.exe', [vbsPath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
          })
          this.process.unref()
        }
      } else {
        const execPath = path.join(this.serviceDir, 'video-service')
        this.process = spawn(execPath, [], {
          cwd: this.serviceDir,
          detached: true,
          stdio: 'ignore'
        })
        this.process.unref()
      }

      logger.info(`VideoService started, waiting for port 8501...`)

      const ready = await this.waitForPort(8501)
      if (ready) {
        logger.info(`VideoService is ready on port 8501`)
      } else {
        logger.warn(`VideoService failed to start within timeout`)
      }

      return { success: ready }
    } catch (error: any) {
      logger.error('Failed to start VideoService:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Synchronous stop — safe to call from before-quit where async is not guaranteed to complete.
   */
  stopSync(): void {
    try {
      if (process.platform === 'win32') {
        try {
          const netstatOutput = execSync('netstat -ano', { encoding: 'utf-8', timeout: 5000 })
          const lines = netstatOutput.split('\n')
          const pids = new Set<string>()
          for (const line of lines) {
            if (line.includes(':8501') && line.includes('LISTENING')) {
              const parts = line.trim().split(/\s+/)
              const pid = parts[parts.length - 1]
              if (pid && /^\d+$/.test(pid) && pid !== '0') {
                pids.add(pid)
              }
            }
          }

          if (pids.size === 0) {
            try {
              const tasklist = execSync('tasklist /FI "IMAGENAME eq pixelle-video.exe" /FO CSV /NH', {
                encoding: 'utf-8',
                timeout: 5000
              })
              const csvLines = tasklist
                .trim()
                .split('\n')
                .filter((l) => !l.includes('INFO:'))
              for (const line of csvLines) {
                const parts = line.replace(/"/g, '').split(',')
                const pid = parts[1]?.trim()
                if (pid && /^\d+$/.test(pid)) {
                  pids.add(pid)
                }
              }
            } catch {
              // ignore
            }
          }

          for (const pid of pids) {
            try {
              execSync(`taskkill /PID ${pid} /T /F`, { encoding: 'utf-8', timeout: 5000 })
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
      } else {
        try {
          const pid = execSync('lsof -ti :8501 -sTCP:LISTEN', { encoding: 'utf-8', timeout: 5000 }).trim()
          if (pid) {
            execSync(`kill -9 ${pid}`, { timeout: 5000 })
          }
        } catch {
          // ignore
        }
      }
      this.process = null
      logger.info('VideoService stopped (sync)')
    } catch (error: any) {
      logger.error('Failed to stop VideoService (sync):', error)
    }
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    this.stopSync()
    return { success: true }
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

      // Download with progress using Node.js https
      logger.info(`Fetching ${url}...`)

      const downloadWithRedirect = (downloadUrl: string, redirectCount = 0): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (redirectCount > 10) {
            return reject(new Error('Too many redirects'))
          }

          const urlObj = new URL(downloadUrl)
          const request = https.request(
            {
              hostname: urlObj.hostname,
              port: urlObj.port || 443,
              path: urlObj.pathname + urlObj.search,
              method: 'GET',
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            },
            (response) => {
              // Handle redirects
              if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
                const location = response.headers.location
                if (location) {
                  const nextUrl = location.startsWith('http') ? location : new URL(location, downloadUrl).href
                  logger.info(`Redirect ${response.statusCode} -> ${nextUrl}`)
                  resolve(downloadWithRedirect(nextUrl, redirectCount + 1))
                  return
                }
              }

              if (response.statusCode !== 200) {
                let body = ''
                response.on('data', (chunk: Buffer) => (body += chunk.toString()))
                response.on('end', () => {
                  logger.error(
                    `HTTP ${response.statusCode}, headers: ${JSON.stringify(response.headers)}, body: ${body.substring(0, 500)}`
                  )
                  reject(new Error(`HTTP ${response.statusCode}`))
                })
                return
              }

              const totalBytes = Number(response.headers['content-length'] || 0)
              let receivedBytes = 0
              let lastPercent = -1
              const writeStream = fs.createWriteStream(zipPath)

              response.on('data', (chunk: Buffer) => {
                receivedBytes += chunk.length
                if (totalBytes > 0) {
                  const percent = Math.round((receivedBytes / totalBytes) * 80)
                  if (percent !== lastPercent) {
                    lastPercent = percent
                    this.sendProgress(percent, 'downloading')
                  }
                }
              })

              response.on('error', reject)
              writeStream.on('error', reject)
              writeStream.on('finish', () => {
                logger.info(`Downloaded ${receivedBytes} bytes to ${zipPath}`)
                resolve()
              })

              response.pipe(writeStream)
            }
          )

          request.on('error', reject)
          request.end()
        })
      }

      await downloadWithRedirect(url)
      this.sendProgress(80, 'extracting')

      // Extract in next tick to avoid blocking
      await new Promise<void>((resolve) => setImmediate(resolve))
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

  async updateModelConfig(baseUrl: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // config.yaml is either next to pixelle-video.exe (serviceDir root) or in Pixelle-Video/ subdirectory (bat)
      const candidates = [
        path.join(this.serviceDir, 'config.yaml'),
        path.join(this.serviceDir, 'Pixelle-Video', 'config.yaml')
      ]
      const configPath = candidates.find((p) => fs.existsSync(p))
      if (!configPath) {
        return { success: false, error: 'Config file not found in: ' + candidates.join(', ') }
      }

      let content = fs.readFileSync(configPath, 'utf-8')
      logger.info(`Config before update:\n${content}`)

      // Replace llm section values
      content = content.replace(/^(\s*api_key:\s*).*$/m, `$1'${apiKey}'`)
      content = content.replace(/^(\s*base_url:\s*).*$/m, `$1'${baseUrl}'`)

      fs.writeFileSync(configPath, content, 'utf-8')
      logger.info(`Updated model config: base_url=${baseUrl}, api_key=${apiKey}`)
      return { success: true }
    } catch (error: any) {
      logger.error('Failed to update model config:', error)
      return { success: false, error: error.message }
    }
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

  ipcMain.handle(
    IpcChannel.VideoService_Start,
    async (_event: IpcMainInvokeEvent, port: number, baseUrl?: string, apiKey?: string) => {
      return await service.start(port, baseUrl, apiKey)
    }
  )

  ipcMain.handle(IpcChannel.VideoService_Stop, async () => {
    return await service.stop()
  })

  ipcMain.handle(IpcChannel.VideoService_Download, async (_event: IpcMainInvokeEvent, url: string) => {
    return await service.download(url)
  })

  ipcMain.handle(IpcChannel.VideoService_OpenFolder, async () => {
    await service.openFolder()
  })

  ipcMain.handle(
    IpcChannel.VideoService_UpdateModelConfig,
    async (_event: IpcMainInvokeEvent, baseUrl: string, apiKey: string) => {
      return await service.updateModelConfig(baseUrl, apiKey)
    }
  )
}
