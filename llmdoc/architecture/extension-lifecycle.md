# Extension Lifecycle

## 1. Identity

- **What it is:** Antigravity Quota Watcher 扩展的完整生命周期流程。
- **Purpose:** 说明扩展从激活到停用的各个阶段和关键决策点。

## 2. Core Components

- `src/extension.ts` (activate, deactivate, initializeGoogleApiMethod, initializeLocalApiMethod): 扩展入口和生命周期管理
- `src/quotaService.ts` (QuotaService): 配额数据获取和轮询
- `src/statusBar.ts` (StatusBarService): 状态栏显示
- `src/portDetectionService.ts` (PortDetectionService): 端口检测
- `src/auth/googleAuthService.ts` (GoogleAuthService): Google 认证管理

## 3. Execution Flow (LLM Retrieval Map)

### 3.1 扩展激活 (activate)

**触发条件**: VS Code 启动完成后 (`onStartupFinished`)

**执行步骤**:

1. **初始化基础服务** (`src/extension.ts:43-63`)
   - 初始化版本信息 (`versionInfo.initialize`)
   - 创建 ConfigService 读取配置
   - 初始化国际化服务 (`LocalizationService`)
   - 初始化代理服务 (`ProxyService`)
   - 创建 StatusBarService

2. **初始化认证服务** (`src/extension.ts:78-80`)
   - 创建 GoogleAuthService 单例
   - 调用 `googleAuthService.initialize(context)`
   - 检查存储的 Token 状态

3. **检测 IDE 环境** (`src/extension.ts:65, 83-104`)
   - 调用 `versionInfo.isAntigravityIde()` 判断是否为 Antigravity IDE
   - 如果是非 Antigravity 环境且配置为本地 API，弹窗提示切换到 GOOGLE_API

4. **选择初始化路径** (`src/extension.ts:106-114`)
   - 根据 `apiMethod` 配置选择初始化方式：
     - `GOOGLE_API` → 调用 `initializeGoogleApiMethod()`
     - `GET_USER_STATUS` → 调用 `initializeLocalApiMethod()`

5. **注册命令和监听器** (`src/extension.ts:116-648`)
   - 注册所有命令（刷新、检测端口、登录/登出等）
   - 注册配置变更监听器
   - 注册窗口焦点监听器
   - 注册认证状态监听器

### 3.2 Google API 初始化路径 (initializeGoogleApiMethod)

**入口**: `src/extension.ts:658-756`

**执行步骤**:

1. **创建 QuotaService** (`src/extension.ts:669-670`)
   - 不需要端口和 CSRF Token
   - 设置 API 方法为 GOOGLE_API

2. **注册回调** (`src/extension.ts:673`)
   - 调用 `registerQuotaServiceCallbacks()`
   - 注册配额更新、错误、认证状态等回调

3. **检查认证状态** (`src/extension.ts:676`)
   - 获取当前认证状态 (`googleAuthService.getAuthState()`)

4. **处理未登录状态** (`src/extension.ts:678-744`)
   - 检查本地 Antigravity 是否有存储的 Token (`hasAntigravityDb()`)
   - 如果有，提取 refresh_token (`extractRefreshTokenFromAntigravity()`)
   - 弹窗提示用户选择：
     - "使用本地凭证" → 调用 `loginWithRefreshToken()`
     - "手动登录" → 显示未登录状态
   - 启动本地 Token 检查定时器 (`startLocalTokenCheckTimer()`)

5. **处理已登录状态** (`src/extension.ts:750-755`)
   - 如果已认证且配置启用，开始轮询 (`quotaService.startPolling()`)

### 3.3 本地 API 初始化路径 (initializeLocalApiMethod)

**入口**: `src/extension.ts:762-852`

**执行步骤**:

1. **创建端口检测服务** (`src/extension.ts:770`)
   - 初始化 PortDetectionService

2. **执行端口检测** (`src/extension.ts:776-794`)
   - 调用 `portDetectionService.detectPort()`
   - 获取 connectPort、httpPort、csrfToken

3. **处理检测失败** (`src/extension.ts:797-812`)
   - 显示错误状态
   - 弹窗提示用户重试或取消

4. **处理检测成功** (`src/extension.ts:814-851`)
   - 创建 QuotaService，传入端口和 CSRF Token
   - 设置 API 方法为 GET_USER_STATUS
   - 注册回调 (`registerQuotaServiceCallbacks()`)
   - 延迟 8 秒后开始轮询（避免启动时频繁请求）

### 3.4 配额轮询循环

**入口**: `src/quotaService.ts:198-243`

**执行步骤**:

1. **启动轮询** (`startPolling`)
   - 检查认证状态（GOOGLE_API 模式）
   - 停止现有轮询
   - 立即执行一次 `fetchQuota()`
   - 设置定时器，按配置间隔重复执行

2. **获取配额** (`fetchQuota` → `doFetchQuota`)
   - 根据 API 方法调用不同的获取逻辑：
     - `GOOGLE_API`: 调用 `handleGoogleApiQuota()`
     - `GET_USER_STATUS`: 调用 `makeGetUserStatusRequest()`
   - 解析响应为 QuotaSnapshot
   - 调用 `updateCallback` 更新状态栏

3. **错误处理** (`src/quotaService.ts:403-469`)
   - 增加错误计数
   - 判断错误类型：
     - 认证错误 → 停止轮询，通知需要登录
     - 网络错误 → 标记数据过时，继续轮询
     - 其他错误 → 重试（最多 3 次）
   - 达到最大重试次数 → 停止轮询，显示错误

### 3.5 状态栏更新

**入口**: `src/statusBar.ts:53-131`

**执行步骤**:

1. **接收配额快照** (`updateDisplay`)
   - 缓存快照数据
   - 清除刷新状态

2. **构建显示文本** (`src/statusBar.ts:75-114`)
   - 选择要显示的模型 (`selectModelsToDisplay`)
   - 根据 displayStyle 生成文本：
     - `percentage`: "🟢 Claude: 85%"
     - `progressBar`: "🟢 Claude ███████░"
     - `dots`: "🟢 Claude ●●●●○"
   - 根据剩余百分比选择状态指示符（🟢🟡🔴⚫）

3. **更新 Tooltip** (`src/statusBar.ts:184-229`)
   - 构建 Markdown 格式的详细信息
   - 显示所有模型的配额和重置时间
   - 以表格形式展示

### 3.6 配置变更处理

**入口**: `src/extension.ts:1023-1218`

**执行步骤**:

1. **防抖处理** (`src/extension.ts:1024-1028`)
   - 300ms 内的多次变更只执行最后一次

2. **更新状态栏配置** (`src/extension.ts:1038-1044`)
   - 更新阈值、显示风格等

3. **处理 API 方法切换** (`src/extension.ts:1084-1205`)
   - 从 GOOGLE_API 切换到本地 API：
     - 停止轮询
     - 执行端口检测
     - 成功后重新开始轮询
   - 从本地 API 切换到 GOOGLE_API：
     - 停止轮询
     - 检查认证状态
     - 提示登录或导入本地 Token

4. **更新轮询状态** (`src/extension.ts:1208-1214`)
   - 根据 `enabled` 配置启动或停止轮询

### 3.7 扩展停用 (deactivate)

**入口**: `src/extension.ts:1223-1228`

**执行步骤**:

1. 停止本地 Token 检查定时器
2. 调用 `quotaService.dispose()` 停止轮询
3. 调用 `statusBarService.dispose()` 清理状态栏

## 4. Design Rationale

### 延迟启动轮询
- **原因**: 避免 VS Code 启动时频繁请求，影响性能
- **实现**: 本地 API 模式延迟 8 秒启动轮询

### 双初始化路径
- **原因**: 两种 API 方法的前置条件和流程完全不同
- **实现**: 分离为 `initializeGoogleApiMethod` 和 `initializeLocalApiMethod`

### 配置变更防抖
- **原因**: 防止用户快速修改配置时触发多次重新初始化
- **实现**: 300ms 防抖，只执行最后一次变更

### 本地 Token 自动导入
- **原因**: 提升用户体验，避免重复登录
- **实现**: 检测本地 Antigravity 数据库，提取 refresh_token

### 窗口焦点刷新
- **原因**: 用户从浏览器切换账号后，希望立即看到新配额
- **实现**: 监听窗口焦点事件，触发快速刷新（仅本地 API 模式）
