# 视频生成服务集成设计

## 概述

在启动台页面添加"视频生成"功能入口，点击后启动本地视频生成服务，打开新标签页显示服务Web界面。

## 用户流程

1. 用户点击启动台的"视频生成"图标
2. 系统检查服务是否已安装
3. 如未安装，弹出下载提示，用户确认后下载并解压
4. 系统写入yaml配置文件（包含API服务器地址和key）
5. 启动服务（自动分配端口，避免冲突）
6. 打开新标签页，WebView加载服务地址

## 目录结构

```
src/renderer/src/
├── pages/
│   ├── launchpad/LaunchpadPage.tsx          # 添加视频生成入口
│   └── video/VideoPage.tsx                  # 新建 - 视频服务WebView页面
├── services/
│   └── VideoServiceManager.ts                # 新建 - 服务管理
└── pages/settings/ToolSettings/
    └── VideoServiceSettings/                # 新建 - 视频服务设置
        └── VideoServiceSettings.tsx
```

## 核心组件

### 1. VideoServiceManager

**文件**: `src/renderer/src/services/VideoServiceManager.ts`

| 方法 | 说明 |
|------|------|
| `checkInstalled()` | 检查服务是否已安装（检查可执行文件是否存在） |
| `getDownloadUrl()` | 根据平台获取下载地址 |
| `download()` | 下载zip并解压到用户数据目录 |
| `writeConfig(port, apiServerUrl, apiKey)` | 写入yaml配置文件 |
| `startService(port)` | 启动服务 |
| `stopService()` | 停止服务 |
| `getServiceUrl(port)` | 获取服务访问地址 |

### 2. yaml配置文件

**路径**: `{userData}/video-service/config.yaml`

```yaml
base_url: "http://localhost:{port}"
api_key: "{apiKey}"
```

### 3. 设置页面

**文件**: `src/renderer/src/pages/settings/ToolSettings/VideoServiceSettings/VideoServiceSettings.tsx`

| 字段 | 类型 | 默认值 |
|------|------|--------|
| enabled | boolean | false |
| windowsUrl | string | https://cdn.example.com/video-service/win/video-service.zip |
| macUrl | string | https://cdn.example.com/video-service/mac/video-service.zip |
| port | number | 7890 |

### 4. 视频页面

**文件**: `src/renderer/src/pages/video/VideoPage.tsx`

- 路由: `/video`
- 使用 `<webview>` 标签加载服务URL
- 页面加载时从tabs store添加tab

### 5. 启动台入口

**文件**: `src/renderer/src/pages/launchpad/LaunchpadPage.tsx`

- 添加"视频生成"图标卡片
- 点击时调用 VideoServiceManager 检查并启动服务

## 平台差异

| 平台 | 执行方式 | 启动命令 |
|------|----------|----------|
| Windows | bat脚本 | `start.bat {port}` |
| Mac | 二进制 | `./video-service --port {port}` |

## 实现步骤

1. 创建 VideoServiceManager 服务类
2. 创建 VideoServiceSettings 设置页面
3. 创建 VideoPage 视频页面
4. 在 LaunchpadPage 添加入口
5. 配置路由
6. 配置Redux store（如需要）
7. 测试完整流程

## 待定项

- [ ] 确认下载URL（目前使用占位符）
- [ ] 确认yaml配置字段名（目前使用 base_url, api_key）
- [ ] 确认端口分配策略（避免冲突）