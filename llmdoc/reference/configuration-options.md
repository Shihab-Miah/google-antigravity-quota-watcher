# Configuration Options

## 1. Core Summary

Antigravity Quota Watcher 的所有配置项说明，包括功能、默认值和使用场景。

## 2. Source of Truth

- **Primary Code**: `package.json:53-193` - 配置项定义
- **Configuration Service**: `src/configService.ts` - 配置读取和监听
- **Type Definitions**: `src/types.ts:91-106` - 配置类型定义

## 3. Configuration Reference

### 3.1 基础配置

#### enabled
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 是否启用扩展
- **效果**:
  - `true`: 启动轮询，显示状态栏
  - `false`: 停止轮询，隐藏状态栏

#### pollingInterval
- **类型**: `number`
- **默认值**: `60`（秒）
- **说明**: 配额轮询间隔
- **推荐值**:
  - 快速更新: 30 秒
  - 正常使用: 60 秒
  - 节省资源: 120 秒

### 3.2 API 配置

#### apiMethod
- **类型**: `string`
- **默认值**: `"GOOGLE_API"`
- **可选值**:
  - `"GET_USER_STATUS"`: 本地检测（需要 Antigravity IDE）
  - `"GOOGLE_API"`: 远程检测（支持所有 IDE）
- **说明**: 配额获取方式
- **选择指南**: 参考 `llmdoc/guides/api-method-selection.md`

### 3.3 显示配置

#### displayStyle
- **类型**: `string`
- **默认值**: `"percentage"`
- **可选值**:
  - `"percentage"`: 百分比模式（例如: `🟢 Claude: 85%`）
  - `"progressBar"`: 进度条模式（例如: `🟢 Claude ███████░`）
  - `"dots"`: 圆点模式（例如: `🟢 Claude ●●●●○`）
- **说明**: 状态栏显示风格

#### warningThreshold
- **类型**: `number`
- **默认值**: `50`（%）
- **说明**: 警告阈值，低于此值显示黄色指示符（🟡）
- **范围**: 0-100

#### criticalThreshold
- **类型**: `number`
- **默认值**: `30`（%）
- **说明**: 临界阈值，低于此值显示红色指示符（🔴）
- **范围**: 0-100
- **注意**: 应小于 `warningThreshold`

#### showPromptCredits
- **类型**: `boolean`
- **默认值**: `false`
- **说明**: 是否在状态栏显示 Prompt Credits
- **效果**: 显示格式 `💳 500/1000 (50%)`

#### showPlanName
- **类型**: `boolean`
- **默认值**: `false`
- **说明**: 是否在状态栏显示订阅计划名称
- **效果**: 显示格式 `Plan: Pro`

#### showGeminiPro
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 是否在状态栏显示 Gemini Pro 配额

#### showGeminiFlash
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 是否在状态栏显示 Gemini Flash 配额

### 3.4 国际化配置

#### language
- **类型**: `string`
- **默认值**: `"zh-cn"`
- **可选值**:
  - `"auto"`: 自动（跟随 VS Code 语言）
  - `"en"`: 英文
  - `"zh-cn"`: 简体中文
- **说明**: 界面语言

### 3.5 日志配置

#### logLevel
- **类型**: `string`
- **默认值**: `"DEBUG"`
- **可选值**:
  - `"ERROR"`: 仅显示错误
  - `"WARNING"`: 显示警告和错误
  - `"INFO"`: 显示重要信息
  - `"DEBUG"`: 显示所有日志（默认）
- **说明**: 日志级别
- **推荐**:
  - 正常使用: `"INFO"`
  - 排查问题: `"DEBUG"`
  - 生产环境: `"WARNING"`

### 3.6 代理配置

#### proxyEnabled
- **类型**: `boolean`
- **默认值**: `false`
- **说明**: 是否启用扩展独立代理配置
- **注意**: 默认情况下扩展会继承 VS Code 的代理设置

#### proxyAutoDetect
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 是否自动检测环境变量代理（`HTTPS_PROXY` / `HTTP_PROXY`）
- **前提**: `proxyEnabled` 为 `true`

#### proxyUrl
- **类型**: `string`
- **默认值**: `""`
- **说明**: 手动指定的代理 URL
- **格式**:
  - HTTP: `http://127.0.0.1:7890`
  - HTTPS: `https://127.0.0.1:7890`
  - 带认证: `http://user:pass@127.0.0.1:7890`
  - SOCKS5: `socks5://127.0.0.1:1080`
- **前提**: `proxyEnabled` 为 `true` 且 `proxyAutoDetect` 为 `false`

### 3.7 高级配置

#### forcePowerShell
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: Windows 系统是否强制使用 PowerShell 进行端口检测
- **平台**: 仅 Windows
- **用途**: 解决某些 Windows 系统上 netstat 权限问题

## 4. Configuration Examples

### 4.1 最小配置（使用默认值）

```json
{
  "antigravityQuotaWatcher.enabled": true
}
```

### 4.2 Antigravity IDE 本地开发

```json
{
  "antigravityQuotaWatcher.enabled": true,
  "antigravityQuotaWatcher.apiMethod": "GET_USER_STATUS",
  "antigravityQuotaWatcher.pollingInterval": 60,
  "antigravityQuotaWatcher.displayStyle": "percentage"
}
```

### 4.3 非 Antigravity IDE（WindSurf/Kiro/VS Code）

```json
{
  "antigravityQuotaWatcher.enabled": true,
  "antigravityQuotaWatcher.apiMethod": "GOOGLE_API",
  "antigravityQuotaWatcher.pollingInterval": 60,
  "antigravityQuotaWatcher.displayStyle": "progressBar"
}
```

### 4.4 使用代理（国内网络）

```json
{
  "antigravityQuotaWatcher.enabled": true,
  "antigravityQuotaWatcher.apiMethod": "GOOGLE_API",
  "antigravityQuotaWatcher.proxyEnabled": true,
  "antigravityQuotaWatcher.proxyUrl": "http://127.0.0.1:7890"
}
```

### 4.5 最小化显示（节省空间）

```json
{
  "antigravityQuotaWatcher.enabled": true,
  "antigravityQuotaWatcher.displayStyle": "dots",
  "antigravityQuotaWatcher.showPromptCredits": false,
  "antigravityQuotaWatcher.showPlanName": false,
  "antigravityQuotaWatcher.showGeminiPro": false,
  "antigravityQuotaWatcher.showGeminiFlash": false
}
```

### 4.6 详细显示（完整信息）

```json
{
  "antigravityQuotaWatcher.enabled": true,
  "antigravityQuotaWatcher.displayStyle": "percentage",
  "antigravityQuotaWatcher.showPromptCredits": true,
  "antigravityQuotaWatcher.showPlanName": true,
  "antigravityQuotaWatcher.showGeminiPro": true,
  "antigravityQuotaWatcher.showGeminiFlash": true
}
```

### 4.7 性能优化（降低资源占用）

```json
{
  "antigravityQuotaWatcher.enabled": true,
  "antigravityQuotaWatcher.pollingInterval": 120,
  "antigravityQuotaWatcher.logLevel": "WARNING",
  "antigravityQuotaWatcher.showGeminiPro": false,
  "antigravityQuotaWatcher.showGeminiFlash": false
}
```

## 5. Configuration Priority

配置优先级（从高到低）：

1. **Workspace Settings** (`.vscode/settings.json`)
2. **User Settings** (`settings.json`)
3. **Default Values** (`package.json`)

## 6. Related Documents

- **API Method Selection**: `llmdoc/guides/api-method-selection.md`
- **Proxy Configuration**: `llmdoc/guides/proxy-configuration.md`
- **Troubleshooting**: `llmdoc/guides/troubleshooting.md`
