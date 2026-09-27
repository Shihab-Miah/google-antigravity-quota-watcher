# API Clients

## 1. Identity

- **What it is:** API 客户端的设计和实现，封装与不同 API 的交互。
- **Purpose:** 提供统一的 API 调用接口，处理请求/响应和错误。

## 2. Core Components

- `src/api/googleCloudCodeClient.ts` (GoogleCloudCodeClient): Google Cloud Code API 客户端
- `src/api/antigravityClient.ts` (AntigravityClient): Antigravity API 客户端
- `src/api/weeklyLimitChecker.ts` (WeeklyLimitChecker): 周限检测器
- `src/quotaService.ts` (makeRequest): 本地 API 请求函数

## 3. Execution Flow (LLM Retrieval Map)

### 3.1 GoogleCloudCodeClient

**单例模式**: `src/api/googleCloudCodeClient.ts:84-89`

#### 3.1.1 加载项目信息 (loadProjectInfo)

**入口**: `src/api/googleCloudCodeClient.ts:96-122`

**API 端点**: `POST /v1internal:loadCodeAssist`

**请求体**:
```json
{
  "metadata": {
    "ideType": "ANTIGRAVITY"
  }
}
```

**响应解析**: `src/api/googleCloudCodeClient.ts:111-119`
- 提取 `cloudaicompanionProject` (项目 ID)
- 提取 `paidTier.id` 或 `currentTier.id` (订阅等级)
- 返回 `ProjectInfo { projectId, tier }`

#### 3.1.2 获取模型配额 (fetchModelsQuota)

**入口**: `src/api/googleCloudCodeClient.ts:130-199`

**API 端点**: `POST /v1internal:fetchAvailableModels`

**请求体**:
```json
{
  "project": "项目ID"  // 如果 projectId 为空则省略
}
```

**响应格式**:
```json
{
  "models": {
    "gemini-3.5-flash": {
      "quotaInfo": {
        "remainingFraction": 0.85,
        "resetTime": "2024-01-01T00:00:00Z"
      },
      "maxTokens": 1000000
    },
    ...
  }
}
```

**解析步骤**: `src/api/googleCloudCodeClient.ts:154-198`

1. **提取模型映射** (`src/api/googleCloudCodeClient.ts:154`)
   - `models` 是对象映射，不是数组
   - Key 为模型名称，Value 为模型信息

2. **过滤模型** (`src/api/googleCloudCodeClient.ts:162-176`)
   - **按名称过滤**: 只保留包含 "gemini"/"claude"/"gpt" 的模型
   - **按版本过滤**: 过滤掉 Gemini < 3.0 的旧版本

3. **解析配额信息** (`src/api/googleCloudCodeClient.ts:179-184`)
   - 调用 `parseModelQuota(modelName, modelInfo)`
   - 提取 `remainingFraction`（0-1 之间的小数）
   - 提取 `resetTime`（ISO 8601 格式）
   - 生成友好的显示名称

4. **返回结果** (`src/api/googleCloudCodeClient.ts:198`)
   - 返回 `ModelsQuotaResponse { models: ModelQuotaFromApi[] }`

#### 3.1.3 请求重试机制 (makeApiRequest)

**入口**: `src/api/googleCloudCodeClient.ts:248-293`

**重试策略**:
- **最大重试次数**: 3 次
- **重试延迟**: 2 秒 * (attempt + 1)
- **可重试错误**:
  - HTTP 5xx 错误
  - HTTP 429 (Rate Limit)
- **不可重试错误**:
  - HTTP 401 (需要重新登录)
  - HTTP 4xx (除 429 外)

**执行步骤**: `src/api/googleCloudCodeClient.ts:256-289`

1. **循环重试** (`src/api/googleCloudCodeClient.ts:256`)
   - 最多尝试 MAX_RETRIES 次

2. **执行请求** (`src/api/googleCloudCodeClient.ts:259`)
   - 调用 `doRequest(path, accessToken, body)`

3. **错误判断** (`src/api/googleCloudCodeClient.ts:264-280`)
   - 如果是 `GoogleApiError`:
     - 检查 `isRetryable()`: 不可重试则直接抛出
     - 检查 `needsReauth()`: 需要重新登录则直接抛出
   - 其他错误: 继续重试

4. **延迟重试** (`src/api/googleCloudCodeClient.ts:283-286`)
   - 等待 `RETRY_DELAY_MS * (attempt + 1)` 毫秒

#### 3.1.4 HTTP 请求 (doRequest)

**入口**: `src/api/googleCloudCodeClient.ts:298-389`

**请求配置**:
- **协议**: HTTPS
- **主机**: `cloudcode-pa.clients6.google.com`
- **端口**: 443
- **超时**: 30 秒
- **代理**: 支持（通过 ProxyService）

**Headers**:
```
Content-Type: application/json
Content-Length: <body length>
Authorization: Bearer <access_token>
User-Agent: AntigravityQuotaWatcher/1.0
```

**响应处理**: `src/api/googleCloudCodeClient.ts:343-372`
- **2xx**: 解析 JSON 并返回
- **非 2xx**: 抛出 `GoogleApiError`

### 3.2 AntigravityClient

**单例模式**: `src/api/antigravityClient.ts:21-27`

**用途**: 用于周限检测，获取 Antigravity 专用的 projectId

#### 3.2.1 加载项目信息 (loadProjectInfo)

**入口**: `src/api/antigravityClient.ts:29-63`

**API 端点**: `POST /v1internal:loadCodeAssist`

**请求体**:
```json
{
  "metadata": {
    "ideType": "ANTIGRAVITY",
    "platform": "PLATFORM_UNSPECIFIED",
    "pluginType": "GEMINI"
  }
}
```

**执行步骤**: `src/api/antigravityClient.ts:31-62`

1. **发送 loadCodeAssist 请求** (`src/api/antigravityClient.ts:31-35`)
   - 调用 `doRequest(LOAD_CODE_ASSIST_PATH, accessToken, body)`

2. **尝试提取 projectId** (`src/api/antigravityClient.ts:37-43`)
   - 调用 `extractProjectIdFromLoad(response)`
   - 如果存在，直接返回

3. **提取默认 tier** (`src/api/antigravityClient.ts:45-58`)
   - 调用 `extractDefaultTierId(response)`
   - 如果不存在，重新加载一次

4. **Onboard 用户** (`src/api/antigravityClient.ts:61-62`)
   - 调用 `onboardUser(accessToken, tierId)`
   - 返回新创建的 projectId

#### 3.2.2 Onboard 用户 (onboardUser)

**入口**: `src/api/antigravityClient.ts:113-141`

**API 端点**: `POST /v1internal:onboardUser`

**请求体**:
```json
{
  "tierId": "LEGACY",
  "metadata": {
    "ideType": "ANTIGRAVITY",
    "platform": "PLATFORM_UNSPECIFIED",
    "pluginType": "GEMINI"
  }
}
```

**轮询机制**: `src/api/antigravityClient.ts:123-138`
- **最大尝试次数**: 5 次
- **重试延迟**: 2 秒
- **成功条件**: `response.done === true`

### 3.3 本地 API 请求 (makeRequest)

**入口**: `src/quotaService.ts:24-101`

**用途**: 调用本地 Antigravity 语言服务器的 API

**请求配置**:
- **协议**: HTTPS (主) / HTTP (备用)
- **主机**: 127.0.0.1
- **端口**: connectPort (HTTPS) / httpPort (HTTP)
- **超时**: 5 秒

**Headers**:
```
Content-Type: application/json
Content-Length: <body length>
Connect-Protocol-Version: 1
X-Codeium-Csrf-Token: <csrf_token>
```

**HTTPS/HTTP 回退**: `src/quotaService.ts:89-100`

1. **先尝试 HTTPS** (`src/quotaService.ts:91`)
   - 使用 connectPort
   - 发送请求

2. **HTTPS 失败时回退** (`src/quotaService.ts:92-99`)
   - 判断错误类型：
     - `EPROTO` 错误
     - 错误消息包含 "wrong_version_number"
   - 如果有 httpPort，使用 HTTP 重试

### 3.4 WeeklyLimitChecker

**单例模式**: `src/api/weeklyLimitChecker.ts`

**用途**: 检测是否触发周配额限制

#### 3.4.1 检测模型 (checkModel)

**工作原理**:

1. **确定配额池** (`getQuotaPool`)
   - Gemini 3.x 池
   - Claude / GPT 池
   - Gemini 2.5 池

2. **发送测试请求**
   - 提示词: "Hi"
   - 调用 Antigravity API

3. **解析响应**:
   - **HTTP 200**: 配额正常
   - **HTTP 429**: 解析 error.details.reason
     - `QUOTA_EXHAUSTED`: 检查重置时间
       - > 5 小时: 周限
       - ≤ 5 小时: 5 小时限速
     - `RATE_LIMIT_EXCEEDED`: 请求太频繁
     - `MODEL_CAPACITY_EXHAUSTED`: 服务器过载
   - **其他**: 未知错误

## 4. Design Rationale

### 单例模式
- **原因**: API 客户端无状态，全局共享一个实例即可
- **实现**: `getInstance()` 静态方法

### 请求重试
- **原因**: 网络不稳定时提高成功率
- **实现**: 循环重试 + 指数退避

### HTTPS/HTTP 回退
- **原因**: 某些环境下 HTTPS 证书问题导致失败
- **实现**: 捕获特定错误，自动尝试 HTTP

### 代理支持
- **原因**: 国内网络环境需要代理访问 Google API
- **实现**: 通过 ProxyService 获取 Agent

### 模型过滤
- **原因**: 旧版本 Gemini 模型已不可用，避免显示无用信息
- **实现**: 正则匹配版本号，过滤 < 3.0 的模型

### 错误分类
- **原因**: 不同错误需要不同的处理策略
- **实现**: `GoogleApiError` 类提供 `isRetryable()` 和 `needsReauth()` 方法
