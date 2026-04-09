# CherryStudio 技术栈与项目架构

> 最后更新：2026-04-08（新增 Monorepo 架构说明）

## 📋 目录

- [技术栈总览](#技术栈总览)
- [构建工具详解](#构建工具详解)
- [Monorepo 架构](#monorepo-架构)
- [Skills 管理](#skills-管理)
- [项目目录结构](#项目目录结构)
- [配置文件说明](#配置文件说明)
- [开发命令参考](#开发命令参考)

---

## 🎯 技术栈总览

### 核心运行时

| 技术 | 版本 | 用途 |
|------|------|------|
| **Electron** | 40.8.0 | 跨平台桌面应用框架 |
| **Node.js** | ≥24.11.1 | 后端运行时环境 |
| **pnpm** | 10.27.0 | 包管理器（支持 workspace） |

### 前端技术栈

#### 核心框架
- **React** `19.2.0` - UI 框架
- **TypeScript** `5.8.3` - 类型系统
- **React Router** `6` - 前端路由

#### UI 组件库
- **Ant Design** `5.27.0` - 企业级 UI 组件库
- **TailwindCSS** `4.1.13` - 原子化 CSS 框架
- **styled-components** `6.1.11` - CSS-in-JS 解决方案
- **Framer Motion** `12.23.12` - 动画库
- **Lucide React** `0.525.0` - 图标库

#### 状态管理
- **Redux Toolkit** `2.2.5` - 现代化 Redux 工具集
- **Redux** `5.0.1` - 状态容器
- **redux-persist** `6.0.0` - 状态持久化
- **TanStack React Query** `5.85.5` - 服务端状态管理
- **SWR** `2.3.6` - 数据获取库

### 富文本与编辑器

| 技术 | 版本 | 用途 |
|------|------|------|
| **TipTap** | 3.2.0 | 富文本编辑器（基于 ProseMirror） |
| **CodeMirror** | 6.x | 代码编辑器 |
| **react-markdown** | 10.1.0 | Markdown 渲染 |
| **markdown-it** | 14.1.1 | Markdown 解析 |
| **Mermaid** | 11.13.0 | 图表渲染 |
| **KaTeX** | 0.16.22 | 数学公式渲染 |
| **Yjs** | 13.6.27 | CRDT 实时协作 |

### AI 集成

#### 核心 AI SDK
- **Vercel AI SDK** `6.0.143` - AI 流式响应与工具调用
- **@cherrystudio/ai-core** - 内置 AI 抽象层
- **@cherrystudio/openai** `6.15.0` - 自定义 OpenAI 客户端

#### AI Provider 支持
| Provider | 包名 | 版本 |
|----------|------|------|
| **Anthropic (Claude)** | @ai-sdk/anthropic | 3.0.58 |
| **OpenAI** | @ai-sdk/openai | 3.0.49 |
| **Google AI** | @ai-sdk/google | 3.0.55 |
| **Google Vertex** | @ai-sdk/google-vertex | 4.0.98 |
| **Azure OpenAI** | @ai-sdk/azure | 3.0.50 |
| **AWS Bedrock** | @ai-sdk/amazon-bedrock | 4.0.87 |
| **Mistral AI** | @ai-sdk/mistral | 3.0.24 |
| **Perplexity** | @ai-sdk/perplexity | 3.0.23 |
| **Cohere** | @ai-sdk/cohere | 3.0.25 |
| **Groq** | @ai-sdk/groq | 3.0.32 |
| **xAI (Grok)** | @ai-sdk/xai | 3.0.75 |
| **Hugging Face** | @ai-sdk/huggingface | 1.0.37 |
| **OpenRouter** | @openrouter/ai-sdk-provider | 2.3.3 |
| **Ollama** | ollama-ai-provider-v2 | 3.3.1 |

#### 知识库 RAG
- **@cherrystudio/embedjs** `0.1.31` - 嵌入向量与检索
  - 支持加载器：PDF, Markdown, CSV, Office, 图片, 网页, XML, Sitemap 等
  - 支持嵌入：OpenAI, Ollama
  - 支持数据库：LibSQL

#### Agent 系统
- **@anthropic-ai/claude-agent-sdk** `0.2.81` - Claude Agent SDK
- **@modelcontextprotocol/sdk** `1.27.1` - MCP (Model Context Protocol) 协议

### 数据存储

#### 浏览器端
- **Dexie** `4.0.8` - IndexedDB 封装库
- **dexie-react-hooks** `1.1.7` - React 集成

#### 后端（主进程）
- **Drizzle ORM** `0.44.5` - SQL ORM
- **@libsql/client** `0.14.0` - SQLite/LibSQL 客户端

### 后端服务

#### HTTP API
- **Express** `5.1.0` - Web 框架
- **swagger-ui-express** `5.0.1` - API 文档
- **express-validator** `7.2.1` - 请求验证

#### 文件处理
- **sharp** `0.34.3` - 图像处理
- **tesseract.js** `6.0.1` - OCR 文字识别
- **@napi-rs/canvas** `0.1.80` - Canvas 绘图（Native）
- **pdf-parse** `2.4.5` - PDF 解析
- **officeparser** `4.2.0` - Office 文档解析

#### 日志与监控
- **Winston** `3.17.0` - 日志库
- **winston-daily-rotate-file** `5.0.0` - 日志轮转
- **OpenTelemetry** - 分布式追踪
  - @opentelemetry/api `1.9.0`
  - @opentelemetry/sdk-trace-node `2.0.0`
  - @opentelemetry/exporter-trace-otlp-http `0.200.0`

### 测试与质量

| 工具 | 版本 | 用途 |
|------|------|------|
| **Vitest** | 3.2.4 | 单元测试框架 |
| **@testing-library/react** | 16.3.0 | React 测试工具 |
| **Playwright** | 1.55.1 | E2E 测试 |
| **ESLint** | 9.22.0 | 代码检查 |
| **oxlint** | 1.56.0 | 快速 Linter |
| **Biome** | 2.2.4 | 格式化与 Lint |

### 其他关键库

| 类别 | 技术 | 用途 |
|------|------|------|
| **国际化** | i18next `23.11.5` + react-i18next | i18n |
| **更新** | electron-updater `6.7.0` | 自动更新 |
| **存储** | electron-store `8.2.0` | 本地配置 |
| **WebDAV** | webdav `5.9.0` | WebDAV 客户端 |
| **Telegram** | grammy `1.36.3` | Telegram Bot |
| **备份** | archiver `7.0.1` | 压缩打包 |
| **数学** | katex `0.16.22` | 数学公式 |
| **加密** | md5 `2.3.0` | 哈希计算 |

---

## 🔧 构建工具详解

### 构建流水线

```
源代码 (src/, packages/)
   ↓
electron-vite (构建编排)
   ↓
rolldown-vite (代码打包)
   ↓
构建产物 (out/ 目录)
   ↓
electron-builder (打包)
   ↓
安装包 (.dmg, .exe, .AppImage...)
```

### 1. electron-vite `5.0.0` - 构建编排器

**作用：** Electron 应用的统一构建框架

- 协调三个进程的构建：
  - **Main 进程**（Node.js 后端）
  - **Preload 脚本**（安全桥接层）
  - **Renderer 进程**（React 前端）
- 提供开发环境（`pnpm dev`）
- 处理路径别名和模块解析
- 管理热重载和生产构建

**配置文件：** `electron.vite.config.ts`

### 2. rolldown-vite `7.3.0` - 底层打包引擎

**作用：** 高性能的模块打包器

- 替代原生 Vite，提供更快构建速度
- 基于 Rollup 的新一代打包器
- 处理代码转换、Tree-shaking、代码分割
- 支持 ESNext 特性

**配置：**
```json
// package.json
"vite": "npm:rolldown-vite@7.3.0"
```

### 3. electron-builder `26.8.1` - 安装包生成器

**作用：** 将构建产物打包成可分发的安装文件

- 生成平台特定安装包：
  - **macOS**: `.dmg`, `.app`, `.zip`
  - **Windows**: `.exe` (NSIS), `.exe` (Portable)
  - **Linux**: `.AppImage`, `.deb`, `.rpm`
- 处理代码签名和公证
- 配置应用图标、版本、权限

**配置文件：** `electron-builder.yml`

---

## 📦 Monorepo 架构

### 概述

CherryStudio 采用 **pnpm workspace** 实现的 Monorepo 架构，将代码组织为多个独立的 npm 包：

```
packages/
├── aiCore/                      # @cherrystudio/ai-core (2.0.0)
├── ai-sdk-provider/            # @cherrystudio/ai-sdk-provider (0.1.6)
├── extension-table-plus/         # @cherrystudio/extension-table-plus (3.0.12)
├── mcp-trace/                  # MCP 追踪（未发布）
│   ├── trace-core/
│   ├── trace-node/
│   └── trace-web/
└── shared/                     # 共享代码（未发布）
```

### Workspace 配置

**`pnpm-workspace.yaml`**
```yaml
packages:
  - 'packages/*'
```

### 包的依赖关系

#### 1. 主项目 → Workspace 包

```json
// 根目录 package.json
{
  "dependencies": {
    "@cherrystudio/ai-core": "workspace:*",
    "@cherrystudio/extension-table-plus": "workspace:^"
  }
}
```

#### 2. Workspace 包之间相互依赖

```json
// packages/aiCore/package.json
{
  "dependencies": {
    "@cherrystudio/ai-sdk-provider": "workspace:*"
  }
}
```

### 包详情

| 包名 | 版本 | 用途 | 是否发布 |
|------|------|------|----------|
| **@cherrystudio/ai-core** | 2.0.0 | AI 抽象层，统一多个 AI Provider | ✅ 是 |
| **@cherrystudio/ai-sdk-provider** | 0.1.6 | 自定义 AI SDK Provider（CherryIN 路由） | ✅ 是 |
| **@cherrystudio/extension-table-plus** | 3.0.12 | TipTap 表格扩展（fork 自 tiptap/extension-table） | ✅ 是 |
| **shared** | - | 共享类型、工具函数 | ❌ 否（仅内部） |
| **mcp-trace** | - | MCP 追踪功能 | ❌ 否（仅内部） |

### 包的独立性

每个 workspace 包都有：

- ✅ 独立的 `package.json`
- ✅ 独立的版本号
- ✅ 独立的依赖声明（`dependencies`, `devDependencies`, `peerDependencies`）
- ✅ 独立的构建脚本（`build`, `test`, `lint`）
- ✅ 独立的导出配置（`exports`）
- ✅ 独立的 `tsconfig.json`

### 构建与发布

#### 构建所有包
```bash
pnpm packages:build
```

等价于：
```bash
pnpm --filter @cherrystudio/ai-sdk-provider build && \
pnpm --filter @cherrystudio/ai-core build && \
pnpm --filter @cherrystudio/extension-table-plus build
```

#### 发布到 npm
```bash
pnpm packages:release
```

使用 **Changesets** 管理跨包的版本变更和发布。

### 开发工作流

```bash
# 1. 安装所有依赖（包括 workspace 包）
pnpm install

# 2. 构建 workspace 包
pnpm packages:build

# 3. 开发模式（workspace 包支持热重载）
pnpm dev

# 4. 测试特定包
pnpm --filter @cherrystudio/ai-core test
pnpm --filter @cherrystudio/ai-sdk-provider lint

# 5. 发布新版本
pnpm packages:release
```

### 实际使用示例

#### 在主项目中使用
```typescript
// src/renderer/src/pages/xxx.tsx
import { HubProvider } from '@cherrystudio/ai-core'
import TableExtension from '@cherrystudio/extension-table-plus'
```

#### 包之间的依赖
```typescript
// packages/aiCore/src/index.ts
import { CherryINProvider } from '@cherrystudio/ai-sdk-provider'
```

### Monorepo 优势

| 优势 | 说明 |
|------|------|
| **代码复用** | `shared` 包被主进程和渲染进程共享，避免重复 |
| **独立开发** | 每个包可独立构建、测试、发布 |
| **依赖管理** | `workspace:*` 协议自动链接本地包，实时更新 |
| **版本控制** | 使用 Changesets 管理跨包的版本变更 |
| **单独使用** | 某些包可独立使用（如 `@cherrystudio/ai-core`） |
| **清晰边界** | 每个包有明确的职责和接口 |

### 构建工具

每个包使用 **tsdown**（基于 esbuild）进行构建：

```json
// packages/*/package.json
{
  "scripts": {
    "build": "tsdown",
    "prepublishOnly": "pnpm build"
  }
}
```

---

## 🤖 Skills 管理

### 设计原理

项目使用**单一事实来源**模式管理 Claude AI 技能（Skills）：

```
.agents/skills/           ← 真实来源（所有技能在这里创建和维护）
    ├── gh-create-pr/      ← 真实文件夹
    ├── gh-create-issue/    ← 真实文件夹
    └── ...

.claude/skills/           ← 符号链接镜像（指向 .agents/skills/）
    ├── gh-create-pr → ../../.agents/skills/gh-create-pr      ← 符号链接
    ├── gh-create-issue → ../../.agents/skills/gh-create-issue  ← 符号链接
    └── ...
```

### 文件夹职责

| 文件夹 | 类型 | 职责 |
|---------|------|------|
| **`.agents/skills/`** | 真实文件夹 | 技能的开发和维护 |
| **`.claude/skills/`** | 符号链接镜像 | Claude AI 助手的技能发现 |

### 同步机制

#### `public-skills.txt` 白名单
```
# .agents/skills/public-skills.txt
gh-create-pr
gh-create-issue
cherry-pr-test
create-skill
gh-pr-review
prepare-release
vercel-react-best-practices
```

#### 同步命令
```bash
pnpm skills:sync
```

这个脚本会：
1. 读取 `public-skills.txt` 中的白名单
2. 为每个公共技能创建/更新符号链接
3. 生成/更新 `.gitignore` 文件

#### 验证命令
```bash
pnpm skills:check
```

### 开发工作流

```bash
# 1. 在 .agents/skills/ 中创建新技能
mkdir -p .agents/skills/my-new-skill

# 2. 添加 SKILL.md 和其他必要文件
echo "# My New Skill" > .agents/skills/my-new-skill/SKILL.md

# 3. 添加到白名单
echo "my-new-skill" >> .agents/skills/public-skills.txt

# 4. 运行同步（自动创建符号链接）
pnpm skills:sync

# 5. 验证
pnpm skills:check
```

### 为什么这样设计？

| 优势 | 说明 |
|------|------|
| **避免重复** | 符号链接指向同一份文件，保持同步 |
| **清晰分工** | `.agents/skills/` 用于开发，`.claude/skills/` 用于发现 |
| **灵活控制** | `public-skills.txt` 控制哪些技能是公开的 |
| **跨工具兼容** | 桥接不同系统的期望路径 |

### Windows 兼容性

Windows 用户需要启用符号链接支持：

```bash
# 方法 1：启用开发者模式
# 设置 → 更新和安全 → 针对开发者

# 方法 2：通过本地安全策略授予权限
secpol.msc  # 授予 SeCreateSymbolicLinkPrivilege

# 方法 3：配置 Git
git config --global core.symlinks true
```

## 📁 项目目录结构

```
cherry-studio/
├── .agents/                   # AI Agent 技能配置
│   └── skills/                # 技能定义（PR 创建、审查等）
├── .changeset/                # 版本变更记录
├── .github/                   # GitHub 配置
│   ├── workflows/             # CI/CD 工作流
│   └── PULL_REQUEST_TEMPLATE.md
├── .vscode/                   # VS Code 配置
│   ├── extensions.json        # 推荐扩展
│   └── settings.json          # 编辑器设置
├── build/                     # 构建资源
│   ├── icons/                 # 应用图标
│   ├── entitlements.*.plist   # macOS 权限配置
│   └── nsis-installer.nsh     # Windows 安装脚本
├── config/                    # 应用配置
├── docs/                      # 项目文档
│   ├── en/                    # 英文文档
│   ├── zh/                    # 中文文档
│   └── assets/                # 文档资源
├── packages/                  # Monorepo 子包（独立 npm 模块）
│   ├── aiCore/                # @cherrystudio/ai-core (2.0.0)
│   │   ├── src/
│   │   │   ├── core/          # 核心功能
│   │   │   │   ├── providers/ # AI Provider 注册
│   │   │   │   ├── middleware/ # 中间件管道
│   │   │   │   └── plugins/   # 内置插件
│   │   │   └── test_utils/    # 测试工具
│   │   ├── dist/              # 构建产物
│   │   ├── package.json       # 独立的包配置
│   │   ├── tsconfig.json      # 独立的 TS 配置
│   │   ├── vitest.config.ts   # 独立的测试配置
│   │   └── tsdown.config.ts   # 构建配置
│   │
│   ├── ai-sdk-provider/       # @cherrystudio/ai-sdk-provider (0.1.6)
│   │   ├── src/
│   │   ├── dist/
│   │   └── package.json
│   │
│   ├── extension-table-plus/  # @cherrystudio/extension-table-plus (3.0.12)
│   │   ├── src/
│   │   │   ├── table/
│   │   │   ├── cell/
│   │   │   ├── header/
│   │   │   ├── row/
│   │   │   └── kit/
│   │   ├── dist/
│   │   └── package.json
│   │
│   ├── mcp-trace/             # MCP 追踪（未发布）
│   │   ├── trace-core/        # 追踪核心
│   │   ├── trace-node/        # Node 追踪适配器
│   │   └── trace-web/         # Web 追踪适配器
│   │
│   └── shared/                # 共享代码（未发布）
│       ├── agents/            # Agent 类型定义
│       ├── aiCore/            # AI Core 类型
│       ├── anthropic/         # Anthropic 相关
│       ├── config/            # 共享配置
│       ├── externalApp/       # 外部应用集成
│       └── utils/             # 工具函数
├── patches/                   # npm 包补丁
├── resources/                 # 运行时资源
│   ├── builtin-agents/        # 内置 Agent
│   ├── database/              # 数据库迁移文件
│   │   └── drizzle/           # Drizzle 迁移
│   ├── scripts/               # 资源脚本
│   └── skills/                # 技能定义
├── scripts/                   # 构建与工具脚本
│   ├── __tests__/             # 脚本测试
│   ├── buildProxyBootstrapPlugin.ts
│   ├── generate-openapi-spec.ts
│   └── ...                    # 其他工具脚本
├── src/                       # 源代码
│   ├── main/                  # 主进程（Node.js）
│   │   ├── apiServer/         # Express HTTP API
│   │   │   └── generated/     # 自动生成的 OpenAPI 规范
│   │   ├── configs/           # 主进程配置
│   │   ├── integration/       # 集成测试
│   │   ├── knowledge/         # 知识库服务
│   │   ├── mcpServers/        # MCP 服务器管理
│   │   ├── services/          # 核心服务（60+ 个文件）
│   │   │   ├── agents/        # Agent 子系统
│   │   │   │   └── database/  # Drizzle 数据库配置
│   │   │   ├── LoggerService.ts
│   │   │   ├── MCPService.ts
│   │   │   ├── KnowledgeService.ts
│   │   │   ├── WindowService.ts
│   │   │   └── ...            # 其他服务
│   │   ├── utils/             # 工具函数
│   │   ├── bootstrap.ts       # 启动入口
│   │   ├── config.ts          # 配置加载
│   │   ├── ipc.ts             # IPC 通道定义
│   │   └── index.ts           # 主入口
│   ├── preload/               # 预加载脚本
│   │   └── index.ts           # 暴露给渲染进程的 API
│   └── renderer/              # 渲染进程（React）
│       ├── src/
│       │   ├── aiCore/        # AI Core 集成（遗留）
│       │   ├── api/           # IPC 调用封装
│       │   ├── assets/        # 静态资源
│       │   ├── components/    # UI 组件（80+ 个组件）
│       │   ├── config/        # 渲染进程配置
│       │   ├── context/       # React Context
│       │   ├── databases/     # IndexedDB (Dexie)
│       │   ├── handler/       # 事件处理器
│       │   ├── hooks/         # React Hooks（70+ 个）
│       │   ├── i18n/          # 国际化文件
│       │   ├── pages/         # 页面组件
│       │   ├── providers/     # Context Provider
│       │   ├── queue/         # 队列管理
│       │   ├── services/      # 前端服务（50+ 个文件）
│       │   ├── store/         # Redux Store（30+ 个 slice）
│       │   │   ├── assistants.ts
│       │   │   ├── settings.ts
│       │   │   ├── llm.ts
│       │   │   ├── mcp.ts
│       │   │   └── ...
│       │   ├── tools/         # 工具集成
│       │   ├── trace/         # 追踪 UI
│       │   ├── types/         # 类型定义
│       │   ├── utils/         # 工具函数（60+ 个文件）
│       │   ├── windows/       # 多窗口入口
│       │   │   ├── mini/      # 小浮窗
│       │   │   ├── selection/ # 选择工具栏
│       │   │   └── trace/     # 追踪窗口
│       │   ├── workers/       # Web Workers
│       │   ├── App.tsx        # 应用根组件
│       │   ├── Router.tsx     # 路由配置
│       │   └── entryPoint.tsx # 入口文件
│       ├── index.html         # 主窗口 HTML
│       ├── miniWindow.html    # 小浮窗 HTML
│       ├── selectionToolbar.html
│       ├── selectionAction.html
│       └── traceWindow.html   # 追踪窗口 HTML
├── tests/                     # 测试文件
│   ├── __mocks__/             # Mock 数据
│   ├── apis/                  # API 测试
│   ├── e2e/                   # E2E 测试（Playwright）
│   │   ├── fixtures/          # 测试夹具
│   │   ├── pages/             # 页面对象模型
│   │   └── specs/             # 测试规范
│   ├── main.setup.ts          # 主进程测试设置
│   └── renderer.setup.ts      # 渲染进程测试设置
├── .editorconfig              # 编辑器配置
├── .env.example               # 环境变量模板
├── .eslintrc.cjs              # ESLint 配置
├── .gitignore                 # Git 忽略规则
├── .node-version              # Node 版本要求
├── .nvmrc                     # NVM 配置
├── .oxlintrc.json             # oxlint 配置
├── .pre-commit-config.yaml    # Pre-commit 钩子
├── .prettierrc.yaml           # Prettier 配置
├── AGENTS.md                  # Agent 开发指南
├── app-upgrade-config.json    # 应用升级配置
├── biome.jsonc                # Biome 配置
├── CLAUDE.md                  # AI 助手指南
├── CODE_OF_CONDUCT.md         # 贡献者准则
├── CONTRIBUTING.md            # 贡献指南
├── electron-builder.yml       # Electron Builder 配置
├── electron.vite.config.ts    # Electron Vite 配置
├── eslint.config.mjs          # ESLint 配置
├── package.json               # 项目配置
├── pnpm-workspace.yaml        # pnpm workspace 配置
├── playwright.config.ts       # Playwright 配置
├── README.md                  # 项目说明
├── SECURITY.md                # 安全政策
├── tsconfig.json              # TypeScript 根配置
├── tsconfig.node.json         # Node 进程 TS 配置
├── tsconfig.web.json          # Web 进程 TS 配置
└── vitest.config.ts           # Vitest 配置
```

---

## ⚙️ 配置文件说明

### 构建与打包

#### `electron.vite.config.ts`
- **作用：** Electron 应用构建配置
- **内容：**
  - Main/Preload/Renderer 进程配置
  - 路径别名（`@main`, `@renderer`, `@shared` 等）
  - 构建选项（Rollup 配置、Source maps 等）

#### `electron-builder.yml`
- **作用：** 应用打包配置
- **内容：**
  - 应用信息（appId, productName）
  - 多平台打包配置（macOS/Windows/Linux）
  - 文件过滤规则
  - 代码签名配置
  - ASar 打包配置

#### `tsconfig.json` 系列
| 文件 | 作用 |
|------|------|
| `tsconfig.json` | 根配置，项目引用 |
| `tsconfig.node.json` | 主进程（Node.js）配置 |
| `tsconfig.web.json` | 渲染进程（Web）配置 |

### 代码质量

#### `eslint.config.mjs`
- **作用：** ESLint 配置
- **规则集：**
  - @electron-toolkit/eslint-config-ts
  - eslint-plugin-react-hooks
  - eslint-plugin-simple-import-sort
  - eslint-plugin-unused-imports
  - eslint-plugin-oxlint

#### `biome.jsonc`
- **作用：** Biome 格式化与 Lint 配置
- **内容：**
  - 格式化规则（2 空格缩进、单引号）
  - Tailwind 类名排序
  - JSON 键排序

#### `.oxlintrc.json`
- **作用：** oxlint 配置（快速 Linter）

#### `vitest.config.ts`
- **作用：** Vitest 测试配置
- **测试项目：**
  - main（主进程，Node 环境）
  - renderer（渲染进程，jsdom 环境）
  - scripts（脚本测试）
  - aiCore（aiCore 包测试）
  - shared（shared 包测试）

### 包管理

#### `pnpm-workspace.yaml`
- **作用：** pnpm workspace 配置
- **内容：**
  ```yaml
  packages:
    - 'packages/*'
  ```

#### `package.json`
- **作用：** 项目配置与依赖
- **重要字段：**
  - `engines.node`: `>=24.11.1`
  - `main`: `./out/main/index.js`
  - `scripts`: 开发、构建、测试命令
  - `dependencies`: 运行时依赖
  - `devDependencies`: 开发依赖

### 测试配置

#### `playwright.config.ts`
- **作用：** Playwright E2E 测试配置
- **内容：**
  - 测试浏览器配置
  - 超时设置
  - 输出目录

### 其他配置

#### `.editorconfig`
- **作用：** 跨编辑器代码风格统一
- **内容：** 缩进、换行符等

#### `.pre-commit-config.yaml`
- **作用：** Git pre-commit 钩子
- **检查：**
  - pnpm lint
  - pnpm format
  - pnpm i18n:check
  - pnpm test

#### `app-upgrade-config.json`
- **作用：** 应用升级配置
- **内容：** 版本升级策略

---

## 🚀 开发命令参考

### 核心命令

```bash
# 安装依赖
pnpm install

# 开发模式（带热重载）
pnpm dev

# 调试模式（chrome://inspect）
pnpm debug

# 构建检查（Lint + Test）
pnpm build:check

# 完整构建
pnpm build

# 打包应用（生成安装包）
pnpm build:mac       # macOS
pnpm build:win       # Windows
pnpm build:linux     # Linux
```

### 测试命令

```bash
# 运行所有测试
pnpm test

# 分类测试
pnpm test:main       # 主进程测试
pnpm test:renderer   # 渲染进程测试
pnpm test:aicore     # aiCore 包测试
pnpm test:shared     # shared 包测试

# E2E 测试
pnpm test:e2e

# 测试覆盖率
pnpm test:coverage

# 监听模式
pnpm test:watch
```

### 代码质量

```bash
# Lint（自动修复）
pnpm lint

# 格式化
pnpm format

# 类型检查
pnpm typecheck

# i18n 检查
pnpm i18n:check      # 验证完整性
pnpm i18n:sync       # 同步模板键
pnpm i18n:translate  # 自动翻译
```

### 数据库（Agents 子系统）

```bash
# 生成迁移
pnpm agents:generate

# 推送到数据库
pnpm agents:push

# 打开 Drizzle Studio
pnpm agents:studio
```

### Skills 管理

```bash
# 同步 Skills（创建符号链接）
pnpm skills:sync

# 验证 Skills 配置
pnpm skills:check
```

### Workspace 包管理

```bash
# 构建所有 workspace 包
pnpm packages:build

# 发布 workspace 包
pnpm packages:release

# 测试特定包
pnpm --filter @cherrystudio/ai-core test
pnpm --filter @cherrystudio/ai-sdk-provider lint

# 在特定包中运行命令
pnpm --filter <package-name> <command>
```

### Bundle 分析

```bash
# 构建所有 workspace 包
pnpm packages:build

# 发布 workspace 包
pnpm packages:release

# 测试特定包
pnpm --filter @cherrystudio/ai-core test
pnpm --filter @cherrystudio/ai-sdk-provider lint

# 在特定包中运行命令
pnpm --filter <package-name> <command>
```

---

## 📚 路径别名速查

| 别名 | 解析路径 | 用途 |
|------|----------|------|
| `@main` | `src/main/` | 主进程代码 |
| `@renderer` | `src/renderer/src/` | 渲染进程代码 |
| `@shared` | `packages/shared/` | 共享代码 |
| `@types` | `src/renderer/src/types/` | 类型定义 |
| `@logger` | `src/main/services/LoggerService` (main) / `src/renderer/src/services/LoggerService` (renderer) | 日志服务 |
| `@mcp-trace/trace-core` | `packages/mcp-trace/trace-core/` | MCP 追踪核心 |
| `@mcp-trace/trace-node` | `packages/mcp-trace/trace-node/` | MCP 追踪 Node |
| `@mcp-trace/trace-web` | `packages/mcp-trace/trace-web/` | MCP 追踪 Web |
| `@cherrystudio/ai-core` | `packages/aiCore/src/` | AI 核心包 |
| `@cherrystudio/ai-core/provider` | `packages/aiCore/src/core/providers/` | AI Provider |
| `@cherrystudio/ai-core/built-in/plugins` | `packages/aiCore/src/core/plugins/built-in/` | 内置插件 |
| `@cherrystudio/extension-table-plus` | `packages/extension-table-plus/src/` | TipTap 表格扩展 |
| `@cherrystudio/ai-sdk-provider` | `packages/ai-sdk-provider/src/` | AI SDK Provider |

---

## 🔗 相关文档

- [CLAUDE.md](./CLAUDE.md) - AI 助手开发指南
- [CONTRIBUTING.md](./CONTRIBUTING.md) - 贡献指南
- [AGENTS.md](./AGENTS.md) - Agent 开发指南
- [README.md](./README.md) - 项目说明
