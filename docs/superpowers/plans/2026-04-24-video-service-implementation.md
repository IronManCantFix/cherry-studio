# 视频生成服务集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在启动台添加视频生成入口，点击后下载启动本地视频生成服务，打开新标签页显示服务Web界面

**Architecture:**
- VideoServiceManager: 管理视频服务的下载、配置、启动/停止
- VideoServiceSettings: 设置页面配置下载地址和端口
- VideoPage: WebView页面加载服务URL
- LaunchpadPage: 添加视频生成入口按钮

**Tech Stack:** React + Redux Toolkit + Electron IPC + styled-components

---

## 文件结构

```
src/
├── main/
│   └── services/
│       └── VideoService.ts                    # 新建 - main进程服务管理
├── preload/
│   └── index.ts                               # 修改 - 添加videoService IPC通道
├── renderer/src/
│   ├── pages/
│   │   ├── launchpad/LaunchpadPage.tsx        # 修改 - 添加视频生成入口
│   │   └── video/VideoPage.tsx                # 新建 - 视频服务WebView页面
│   ├── services/
│   │   └── VideoServiceManager.ts             # 新建 - renderer进程服务管理
│   ├── hooks/
│   │   └── useVideoService.ts                 # 新建 - 视频服务hook
│   ├── store/
│   │   ├── settings.ts                       # 修改 - 添加videoService配置
│   │   └── runtime.ts                         # 修改 - 添加videoServiceRunning状态
│   └── pages/settings/ToolSettings/
│       └── VideoServiceSettings/              # 新建 - 视频服务设置
│           ├── VideoServiceSettings.tsx
│           └── index.ts
└── packages/shared/
    └── IpcChannel.ts                          # 修改 - 添加videoService IPC通道
```

---

## 任务分解

### Task 1: 添加IPC通道定义

**Files:**
- Modify: `packages/shared/IpcChannel.ts:374-378`

- [ ] **Step 1: 添加VideoService IPC通道枚举**

在 `ApiServer_Ready` 之后添加：

```typescript
// VideoService IPC Channels
VideoService_Start = 'video-service:start',
VideoService_Stop = 'video-service:stop',
VideoService_GetStatus = 'video-service:get-status',
VideoService_Download = 'video-service:download',
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/IpcChannel.ts
git commit -m "feat(video-service): add IPC channel definitions"
```

---

### Task 2: 添加Redux状态

**Files:**
- Modify: `src/renderer/src/store/settings.ts` - 添加videoService配置
- Modify: `src/renderer/src/store/runtime.ts` - 添加videoServiceRunning状态

- [ ] **Step 1: 在settings.ts中添加VideoServiceConfig类型和初始状态**

在 `ApiServerConfig` 类型定义附近添加：

```typescript
export interface VideoServiceConfig {
  enabled: boolean
  windowsUrl: string
  macUrl: string
  port: number
}
```

在 `SettingsState` 接口中添加 `videoService: VideoServiceConfig`

在 `initialState` 中添加：

```typescript
videoService: {
  enabled: false,
  windowsUrl: 'https://cdn.example.com/video-service/win/video-service.zip',
  macUrl: 'https://cdn.example.com/video-service/mac/video-service.zip',
  port: 7890
}
```

- [ ] **Step 2: 在runtime.ts中添加videoServiceRunning状态**

在 `RuntimeState` 中添加 `videoServiceRunning: boolean`

在 `initialRuntimeState` 中添加 `videoServiceRunning: false`

- [ ] **Step 3: 提交**

```bash
git add src/renderer/src/store/settings.ts src/renderer/src/store/runtime.ts
git commit -m "feat(video-service): add Redux state for video service"
```

---

### Task 3: 创建main进程VideoService

**Files:**
- Create: `src/main/services/VideoService.ts`

- [ ] **Step 1: 创建VideoService类**

```typescript
import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
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

  async getStatus(): Promise<{ running: boolean; port?: number }> {
    return {
      running: this.process !== null
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

      const args = process.platform === 'win32'
        ? ['start.bat', String(port)]
        : ['--port', String(port)]

      this.process = spawn(
        process.platform === 'win32' ? path.join(this.serviceDir, 'start.bat') : path.join(this.serviceDir, 'video-service'),
        args,
        { cwd: this.serviceDir, detached: false }
      )

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
    // 实现下载逻辑（使用electron下载或axios）
    // 解压zip包到serviceDir
    return { success: true }
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/main/services/VideoService.ts
git commit -m "feat(video-service): add main process VideoService"
```

---

### Task 4: 扩展preload IPC通道

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: 在preload中添加videoService IPC通道**

首先在文件顶部找到类型定义导入位置，添加：

```typescript
interface StartVideoServiceResult {
  success: boolean
  error?: string
}

interface StopVideoServiceResult {
  success: boolean
  error?: string
}

interface GetVideoServiceStatusResult {
  running: boolean
  installed: boolean
}

interface DownloadVideoServiceResult {
  success: boolean
  error?: string
}
```

然后在 `apiServer` 定义之后添加 `videoService`:

```typescript
videoService: {
  getStatus: (): Promise<GetVideoServiceStatusResult> =>
    ipcRenderer.invoke(IpcChannel.VideoService_GetStatus),
  start: (port: number): Promise<StartVideoServiceResult> =>
    ipcRenderer.invoke(IpcChannel.VideoService_Start, port),
  stop: (): Promise<StopVideoServiceResult> =>
    ipcRenderer.invoke(IpcChannel.VideoService_Stop),
  download: (url: string): Promise<DownloadVideoServiceResult> =>
    ipcRenderer.invoke(IpcChannel.VideoService_Download, url),
}
```

- [ ] **Step 2: 提交**

```bash
git add src/preload/index.ts
git commit -m "feat(video-service): add preload IPC channels"
```

---

### Task 5: 创建VideoServiceManager服务

**Files:**
- Create: `src/renderer/src/services/VideoServiceManager.ts`

- [ ] **Step 1: 创建VideoServiceManager类**

```typescript
import { loggerService } from '@logger'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setVideoServiceRunning } from '@renderer/store/runtime'
import { setVideoServiceEnabled } from '@renderer/store/settings'
import type { RootState } from '@renderer/store'

const logger = loggerService.withContext('VideoServiceManager')

class VideoServiceManagerClass {
  private dispatch: (action: any) => void
  private getState: () => RootState

  constructor(dispatch: (action: any) => void, getState: () => RootState) {
    this.dispatch = dispatch
    this.getState = getState
  }

  async checkInstalled(): Promise<boolean> {
    try {
      const status = await window.api.videoService.getStatus()
      return status.installed
    } catch (error) {
      logger.error('Failed to check video service status:', error)
      return false
    }
  }

  async checkRunning(): Promise<boolean> {
    try {
      const status = await window.api.videoService.getStatus()
      this.dispatch(setVideoServiceRunning(status.running))
      return status.running
    } catch (error) {
      logger.error('Failed to check video service running status:', error)
      return false
    }
  }

  async download(): Promise<boolean> {
    try {
      const config = this.getState().settings.videoService
      const url = process.platform === 'win32' ? config.windowsUrl : config.macUrl
      const result = await window.api.videoService.download(url)
      return result.success
    } catch (error) {
      logger.error('Failed to download video service:', error)
      return false
    }
  }

  async start(): Promise<boolean> {
    try {
      const config = this.getState().settings.videoService
      const result = await window.api.videoService.start(config.port)
      if (result.success) {
        this.dispatch(setVideoServiceRunning(true))
      }
      return result.success
    } catch (error) {
      logger.error('Failed to start video service:', error)
      return false
    }
  }

  async stop(): Promise<boolean> {
    try {
      const result = await window.api.videoService.stop()
      if (result.success) {
        this.dispatch(setVideoServiceRunning(false))
      }
      return result.success
    } catch (error) {
      logger.error('Failed to stop video service:', error)
      return false
    }
  }

  getServiceUrl(): string {
    const config = this.getState().settings.videoService
    return `http://localhost:${config.port}`
  }
}

let instance: VideoServiceManagerClass | null = null

export const initVideoServiceManager = (dispatch: (action: any) => void, getState: () => RootState) => {
  if (!instance) {
    instance = new VideoServiceManagerClass(dispatch, getState)
  }
  return instance
}

export const getVideoServiceManager = () => instance
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/src/services/VideoServiceManager.ts
git commit -m "feat(video-service): add VideoServiceManager"
```

---

### Task 6: 创建useVideoService Hook

**Files:**
- Create: `src/renderer/src/hooks/useVideoService.ts`

- [ ] **Step 1: 创建useVideoService Hook**

```typescript
import { useCallback, useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setVideoServiceRunning } from '@renderer/store/runtime'
import { initVideoServiceManager } from '@renderer/services/VideoServiceManager'
import type { RootState } from '@renderer/store'

export const useVideoService = () => {
  const dispatch = useAppDispatch()
  const videoServiceConfig = useAppSelector((state: RootState) => state.settings.videoService)
  const videoServiceRunning = useAppSelector((state: RootState) => state.runtime.videoServiceRunning)
  const [loading, setLoading] = useState(false)
  const [installed, setInstalled] = useState(false)

  const manager = initVideoServiceManager(dispatch, (() => {}) as () => RootState)

  const checkStatus = useCallback(async () => {
    setLoading(true)
    try {
      const isInstalled = await manager.checkInstalled()
      setInstalled(isInstalled)
      const isRunning = await manager.checkRunning()
      dispatch(setVideoServiceRunning(isRunning))
    } catch (error) {
      console.error('Failed to check video service status:', error)
    } finally {
      setLoading(false)
    }
  }, [dispatch, manager])

  const startService = useCallback(async () => {
    setLoading(true)
    try {
      const result = await manager.start()
      return result
    } finally {
      setLoading(false)
    }
  }, [manager])

  const stopService = useCallback(async () => {
    setLoading(true)
    try {
      const result = await manager.stop()
      return result
    } finally {
      setLoading(false)
    }
  }, [manager])

  const downloadService = useCallback(async () => {
    setLoading(true)
    try {
      const result = await manager.download()
      if (result) {
        setInstalled(true)
      }
      return result
    } finally {
      setLoading(false)
    }
  }, [manager])

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
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/src/hooks/useVideoService.ts
git commit -m "feat(video-service): add useVideoService hook"
```

---

### Task 7: 创建VideoServiceSettings设置页面

**Files:**
- Create: `src/renderer/src/pages/settings/ToolSettings/VideoServiceSettings/VideoServiceSettings.tsx`
- Create: `src/renderer/src/pages/settings/ToolSettings/VideoServiceSettings/index.ts`

- [ ] **Step 1: 创建VideoServiceSettings.tsx**

参考ApiServerSettings.tsx的样式，创建设置页面组件，包含：
- Windows下载URL输入框
- Mac下载URL输入框
- 端口输入框
- 启用开关

- [ ] **Step 2: 创建index.ts导出**

```typescript
export { default as VideoServiceSettings } from './VideoServiceSettings'
```

- [ ] **Step 3: 提交**

```bash
git add src/renderer/src/pages/settings/ToolSettings/VideoServiceSettings/
git commit -m "feat(video-service): add VideoServiceSettings page"
```

---

### Task 8: 创建VideoPage视频页面

**Files:**
- Create: `src/renderer/src/pages/video/VideoPage.tsx`

- [ ] **Step 1: 创建VideoPage组件**

```typescript
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import styled from 'styled-components'

const VideoPage: FC = () => {
  const { t } = useTranslation()
  const { videoServiceUrl } = useParams()
  const serviceUrl = videoServiceUrl || 'http://localhost:7890'

  return (
    <Container>
      <WebViewContainer>
        <webview
          src={serviceUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
        />
      </WebViewContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: calc(100vh - var(--navbar-height));
  background: var(--color-background);
`

const WebViewContainer = styled.div`
  flex: 1;
  width: 100%;
`

export default VideoPage
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/src/pages/video/VideoPage.tsx
git commit -m "feat(video-service): add VideoPage component"
```

---

### Task 9: 在LaunchpadPage添加视频生成入口

**Files:**
- Modify: `src/renderer/src/pages/launchpad/LaunchpadPage.tsx`

- [ ] **Step 1: 添加视频生成图标**

在 `appMenuItems` 数组中添加：

```typescript
{
  icon: <Video size={32} className="icon" />,
  text: t('title.video'),
  path: '/video',
  bgColor: 'linear-gradient(135deg, #EF4444, #F97316)' // 视频：红橙色渐变
}
```

导入 Video 图标：

```typescript
import { Video } from 'lucide-react'
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/src/pages/launchpad/LaunchpadPage.tsx
git commit -m "feat(video-service): add video service entry to launchpad"
```

---

### Task 10: 配置路由

**Files:**
- Modify: `src/renderer/src/Router.tsx`
- Modify: `src/renderer/src/pages/settings/SettingsPage.tsx`

- [ ] **Step 1: 在Router.tsx中添加路由**

导入 VideoPage：

```typescript
import VideoPage from './pages/video/VideoPage'
```

在 routes 中添加：

```typescript
<Route path="/video" element={<VideoPage />} />
```

- [ ] **Step 2: 在SettingsPage.tsx中添加菜单项和路由**

导入 VideoServiceSettings：

```typescript
import { VideoServiceSettings } from './ToolSettings/VideoServiceSettings'
```

添加菜单项（在api-server之后）：

```typescript
<MenuItemLink to="/settings/video-service">
  <MenuItem className={isRoute('/settings/video-service')}>
    <Video size={18} />
    {t('videoService.title')}
  </MenuItem>
</MenuItemLink>
```

添加路由：

```typescript
<Route path="video-service" element={<VideoServiceSettings />} />
```

- [ ] **Step 3: 提交**

```bash
git add src/renderer/src/Router.tsx src/renderer/src/pages/settings/SettingsPage.tsx
git commit -m "feat(video-service): add routes for video service"
```

---

### Task 11: 添加i18n国际化文本

**Files:**
- Modify: `src/renderer/src/i18n/`

- [ ] **Step 1: 添加中文和英文翻译**

在相关locale文件中添加：

```json
{
  "title": {
    "video": "视频生成"
  },
  "videoService": {
    "title": "视频生成服务",
    "description": "配置视频生成服务的下载和启动",
    "windowsUrl": "Windows下载地址",
    "macUrl": "Mac下载地址",
    "port": "服务端口",
    "download": "下载服务",
    "start": "启动服务",
    "stop": "停止服务"
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/src/i18n/
git commit -m "feat(video-service): add i18n translations"
```

---

### Task 12: 完整流程测试

- [ ] **Step 1: 启动应用，测试完整流程**

1. 打开启动台页面，确认视频生成图标显示
2. 点击视频生成图标
3. 如果未下载，确认下载提示弹出
4. 下载完成后，确认服务启动
5. 确认新标签页打开并加载服务Web界面
6. 打开设置页面，确认视频服务设置项存在且可配置

---

## 自检清单

- [ ] 所有IPC通道已定义并实现
- [ ] Redux状态正确添加
- [ ] 视频服务设置页面可访问且可配置
- [ ] 启动台入口显示正常
- [ ] 视频页面正确加载服务URL
- [ ] Windows和Mac平台兼容代码已实现
- [ ] i18n文本已添加
- [ ] 所有修改已提交

---

## 待完成项

- [ ] 确认真实的下载URL地址
- [ ] 实现下载功能的具体逻辑（zip下载解压）
- [ ] 完善错误处理和边界情况