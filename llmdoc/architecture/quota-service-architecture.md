# Quota Service Architecture

## 1. Identity

- **What it is:** 配额服务的核心架构，负责从不同 API 获取配额数据并管理轮询。
- **Purpose:** 提供统一的配额获取接口，支持多种 API 方法和错误恢复机制。

## 2. Core Components

- `src/quotaService.ts` (QuotaService): 配额服务主类
- `src/api/googleCloudCodeClient.ts` (GoogleCloudCodeClient): Google Cloud Code API 客户端
- `src/api/antigravityClient.ts` (AntigravityClient): Antigravity API 客户端
- `src/auth/googleAuthService.ts` (GoogleAuthService): 认证服务
- `src/types.ts` (QuotaSnapshot, ModelQuotaInfo): 配额数据类型定义

## 3. Execution Flow (LLM Retrieval Map)

### 3.1 QuotaService 初始化

**入口**: `src/quotaService.ts:133-141`

**参数**:
- `port`: HTTPS 端口（本地 API 使用）
- `csrfToken`: CSRF Token（本地 API 使用）
- `httpPort`: HTTP 备用端口（本地 API 使用）

**初始化步骤**:
1. 保存端口和 Token 信息
2. 创建 GoogleAuthService 单例引用
3. 创建 GoogleCloudCodeClient 单例引用
4. 设置默认 API 方法为 GET_USER_STATUS

### 3.2 启动轮询 (startPolling)

**入口**: `src/quotaService.ts:198-235`

**执行步骤**:

1. **认证检查**（GOOGLE_API 模式）(`src/quotaService.ts:202-216`)
   - 获取认证状态
   - 如果未登录或 Token 过期：
     - 通知认证状态回调
     - 停止轮询
     - 返回（不启动）

2. **防止竞态条件** (`src/quotaService.ts:218-223`)
   - 检查 `isPollingTransition` 标志
   - 如果正在切换，跳过本次调用

3. **启动轮询循环** (`src/quotaService.ts:224-234`)
   - 设置切换锁
   - 停止现有轮询
   - 立即执行一次 `fetchQuota()`
   - 设置定时器，按间隔重复执行
   - 释放切换锁

### 3.3 获取配额 (fetchQuota → doFetchQuota)

**入口**: `src/quotaService.ts:284-292` → `src/quotaService.ts:298-470`

**执行步骤**:

1. **跳过重试中的调用** (`src/quotaService.ts:286-289`)
   - 如果 `isRetrying` 为 true，跳过本次轮询

2. **通知获取状态** (`src/quotaService.ts:302-304`)
   - 首次尝试时通知 `statusCallback('fetching')`

3. **根据 API 方法获取配额** (`src/quotaService.ts:324-379`)
   - **GOOGLE_API**: 调用 `handleGoogleApiQuota()`
   - **GET_USER_STATUS**: 调用 `makeGetUserStatusRequest()` + `parseGetUserStatusResponse()`

4. **成功处理** (`src/quotaService.ts:381-402`)
   - 重置错误计数和重试计数
   - 清除过时标志（GOOGLE_API 模式）
   - 标记已成功获取过数据
   - 调用 `updateCallback(snapshot)` 更新状态栏

5. **错误处理** (`src/quotaService.ts:403-469`)
   - 增加错误计数
   - 记录错误日志
   - 根据错误类型分类处理（见下文）

### 3.4 Google API 配额获取 (handleGoogleApiQuota)

**入口**: `src/quotaService.ts:548-582`

**执行步骤**:

1. **认证状态检查** (`src/quotaService.ts:549-571`)
   - `NOT_AUTHENTICATED`: 通知需要登录，返回 null
   - `TOKEN_EXPIRED`: 通知 Token 过期，返回 null
   - `AUTHENTICATING/REFRESHING`: 跳过本次，返回 null

2. **调用 API 获取配额** (`src/quotaService.ts:580-581`)
   - 调用 `fetchQuotaViaGoogleApi()`

**fetchQuotaViaGoogleApi 详细流程**: `src/quotaService.ts:588-661`

1. **获取 Access Token** (`src/quotaService.ts:592`)
   - 调用 `googleAuthService.getValidAccessToken()`
   - 自动刷新过期 Token

2. **获取用户信息** (`src/quotaService.ts:595-604`)
   - 调用 `googleAuthService.fetchUserInfo(accessToken)`
   - 获取用户邮箱

3. **获取项目信息** (`src/quotaService.ts:607-612`)
   - 调用 `googleApiClient.loadProjectInfo(accessToken)`
   - 获取 projectId 和 tier

4. **获取模型配额** (`src/quotaService.ts:615-617`)
   - 调用 `googleApiClient.fetchModelsQuota(accessToken, projectId)`
   - 获取所有模型的配额信息

5. **转换为 QuotaSnapshot** (`src/quotaService.ts:625-648`)
   - 遍历模型列表
   - 计算剩余百分比
   - 格式化重置时间
   - 构建 QuotaSnapshot 对象

### 3.5 本地 API 配额获取 (makeGetUserStatusRequest)

**入口**: `src/quotaService.ts:502-520`

**执行步骤**:

1. **构建请求** (`src/quotaService.ts:504-519`)
   - 路径: `/exa.language_server_pb.LanguageServerService/GetUserStatus`
   - 方法: POST
   - Body: `{ metadata: { ideName, extensionName, ideVersion, locale } }`
   - Headers: `X-Codeium-Csrf-Token`

2. **发送请求** (通过 `makeRequest` 函数)
   - 先尝试 HTTPS (connectPort)
   - 失败后回退到 HTTP (httpPort)

3. **解析响应** (`src/quotaService.ts:677-715`)
   - 提取 `userStatus.planStatus` (Prompt Credits)
   - 提取 `userStatus.cascadeModelConfigData.clientModelConfigs` (模型配额)
   - 提取 `userStatus.userTier.name` (账号级别)
   - 构建 QuotaSnapshot 对象

### 3.6 错误处理和重试机制

**入口**: `src/quotaService.ts:403-469`

**错误分类**:

#### 1. 认证错误（GOOGLE_API 模式）
**判断**: `isAuthError(error)` 返回 true
- `GoogleApiError.needsReauth()` 为 true
- 错误消息包含 "not authenticated" / "unauthorized" / "invalid_grant"

**处理**: `src/quotaService.ts:411-423`
- 通知 `authStatusCallback(true, isExpired)`
- 停止轮询
- 重置重试状态
- 不进入重试逻辑

#### 2. 网络错误/超时（GOOGLE_API 模式）
**判断**: `isNetworkOrTimeoutError(error)` 返回 true
- 错误消息包含 "network" / "timeout" / "econnrefused" 等
- 错误代码为 ECONNREFUSED / ENOTFOUND / ETIMEDOUT

**处理**: `src/quotaService.ts:426-442`
- 首次请求失败：调用 `errorCallback(error)` 显示错误
- 调用 `staleCallback(true)` 标记数据过时
- 重置重试计数
- 继续轮询（不停止）

#### 3. 可重试错误
**判断**: 重试次数 < MAX_RETRY_COUNT (3)

**处理**: `src/quotaService.ts:445-459`
- 增加重试计数
- 设置 `isRetrying` 标志
- 通知 `statusCallback('retrying', retryCount)`
- 延迟 5 秒后重试

#### 4. 不可恢复错误
**判断**: 重试次数 >= MAX_RETRY_COUNT

**处理**: `src/quotaService.ts:462-468`
- 停止轮询
- 调用 `errorCallback(error)` 显示错误

### 3.7 手动刷新 (quickRefresh)

**入口**: `src/quotaService.ts:278-282`

**特点**:
- 绕过 `isRetrying` 检查
- 直接调用 `doFetchQuota()`
- 不中断轮询循环
- 用于用户手动触发刷新

### 3.8 重试恢复 (retryFromError)

**入口**: `src/quotaService.ts:249-272`

**执行步骤**:
1. 重置所有错误状态
2. 停止现有轮询
3. 执行一次 `fetchQuota()`
4. 如果成功，启动新的轮询循环

## 4. Design Rationale

### 双 API 支持
- **原因**: 支持不同的使用场景（本地 IDE vs 远程/Fork 版本）
- **实现**: 通过 `apiMethod` 枚举和条件分支

### 认证错误不重试
- **原因**: 认证问题需要用户手动操作（登录），自动重试无意义
- **实现**: 单独判断认证错误，直接停止轮询

### 网络错误标记过时
- **原因**: 临时网络问题不应清空已有配额显示
- **实现**: 保留上次数据，添加过时标志，继续轮询

### HTTPS/HTTP 自动回退
- **原因**: 某些环境下 HTTPS 可能失败（证书问题）
- **实现**: `makeRequest` 函数先尝试 HTTPS，失败后自动尝试 HTTP

### 轮询状态切换锁
- **原因**: 防止快速连续调用 `startPolling` 导致多个定时器
- **实现**: `isPollingTransition` 标志

### 首次失败立即显示错误
- **原因**: 用户首次启动时，如果失败应立即看到错误，而不是卡在"获取中"
- **实现**: `hasSuccessfulFetch` 标志，首次失败时调用 `errorCallback`
