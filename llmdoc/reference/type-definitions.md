# Type Definitions

## 1. Core Summary

Antigravity Quota Watcher 的核心类型定义，用于配额数据、配置和 API 响应。

## 2. Source of Truth

- **Primary Code**: `src/types.ts` - 核心类型定义
- **API Types**: `src/api/googleCloudCodeClient.ts:19-42` - Google API 类型
- **Auth Types**: `src/auth/googleAuthService.ts:27-54` - 认证类型

## 3. Type Reference

### 3.1 配额数据类型

#### QuotaSnapshot

**定义**: `src/types.ts:63-71`

**说明**: 配额快照，包含某一时刻的所有配额信息

**字段**:

```typescript
interface QuotaSnapshot {
  timestamp: Date;                    // 快照时间戳
  promptCredits?: PromptCreditsInfo;  // Prompt Credits 信息（可选）
  models: ModelQuotaInfo[];           // 模型配额列表
  planName?: string;                  // 订阅计划名称（例如 "Pro"）
  userEmail?: string;                 // Google 账号邮箱（仅 GOOGLE_API）
  projectId?: string;                 // Google Cloud Project ID（仅 GOOGLE_API）
  isStale?: boolean;                  // 数据是否过时（网络问题或超时）
}
```

**使用场景**:
- QuotaService 获取配额后返回
- StatusBarService 接收并显示
- Dashboard 面板展示

---

#### ModelQuotaInfo

**定义**: `src/types.ts:52-61`

**说明**: 单个模型的配额信息

**字段**:

```typescript
interface ModelQuotaInfo {
  label: string;                      // 显示名称（例如 "Claude 3.5 Sonnet"）
  modelId: string;                    // 模型 ID（例如 "claude-3-5-sonnet"）
  remainingFraction?: number;         // 剩余配额分数（0-1 之间）
  remainingPercentage?: number;       // 剩余配额百分比（0-100）
  isExhausted: boolean;               // 是否已耗尽
  resetTime: Date;                    // 配额重置时间
  timeUntilReset: number;             // 距离重置的毫秒数
  timeUntilResetFormatted: string;    // 格式化的重置时间（例如 "2h 30m from now"）
}
```

**计算关系**:
- `remainingPercentage = remainingFraction * 100`
- `timeUntilReset = resetTime.getTime() - Date.now()`

---

#### PromptCreditsInfo

**定义**: `src/types.ts:45-50`

**说明**: Prompt Credits 信息（仅部分订阅计划有）

**字段**:

```typescript
interface PromptCreditsInfo {
  available: number;           // 可用额度
  monthly: number;             // 每月总额度
  usedPercentage: number;      // 已使用百分比
  remainingPercentage: number; // 剩余百分比
}
```

**计算关系**:
- `usedPercentage = ((monthly - available) / monthly) * 100`
- `remainingPercentage = (available / monthly) * 100`

---

#### QuotaLevel

**定义**: `src/types.ts:73-78`

**说明**: 配额级别枚举

**值**:

```typescript
enum QuotaLevel {
  Normal = 'normal',       // 正常（> warningThreshold）
  Warning = 'warning',     // 警告（criticalThreshold < x <= warningThreshold）
  Critical = 'critical',   // 临界（0 < x <= criticalThreshold）
  Depleted = 'depleted'    // 耗尽（x <= 0）
}
```

**使用场景**: 状态栏颜色判断

---

### 3.2 配置类型

#### Config

**定义**: `src/types.ts:91-106`

**说明**: 扩展配置

**字段**:

```typescript
interface Config {
  enabled: boolean;                                    // 是否启用扩展
  pollingInterval: number;                             // 轮询间隔（秒）
  warningThreshold: number;                            // 警告阈值（%）
  criticalThreshold: number;                           // 临界阈值（%）
  apiMethod: ApiMethodPreference;                      // API 方法
  showPromptCredits: boolean;                          // 是否显示 Prompt Credits
  showPlanName: boolean;                               // 是否显示订阅计划名称
  showGeminiPro: boolean;                              // 是否显示 Gemini Pro
  showGeminiFlash: boolean;                            // 是否显示 Gemini Flash
  displayStyle: 'percentage' | 'progressBar' | 'dots'; // 显示风格
  language: 'auto' | 'en' | 'zh-cn';                   // 界面语言
  logLevel: 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';    // 日志级别
  proxy: ProxyConfig;                                  // 代理配置
}
```

---

#### ApiMethodPreference

**定义**: `src/types.ts:80`

**说明**: API 方法偏好

**值**:

```typescript
type ApiMethodPreference = 'GET_USER_STATUS' | 'GOOGLE_API';
```

---

#### ProxyConfig

**定义**: `src/types.ts:85-89`

**说明**: 代理配置

**字段**:

```typescript
interface ProxyConfig {
  enabled: boolean;      // 代理开关
  autoDetect: boolean;   // 自动检测系统代理
  url: string;           // 代理 URL（手动填写或自动检测）
}
```

---

### 3.3 API 响应类型

#### UserStatusResponse

**定义**: `src/types.ts:19-43`

**说明**: GetUserStatus API 响应（本地 API）

**字段**:

```typescript
interface UserStatusResponse {
  userStatus: {
    name: string;                                      // 用户名
    email: string;                                     // 邮箱
    planStatus?: {                                     // 订阅状态
      planInfo: {
        teamsTier: string;                             // 团队等级
        planName: string;                              // 计划名称
        monthlyPromptCredits: number;                  // 每月 Prompt Credits
        monthlyFlowCredits: number;                    // 每月 Flow Credits
      };
      availablePromptCredits: number;                  // 可用 Prompt Credits
      availableFlowCredits: number;                    // 可用 Flow Credits
    };
    cascadeModelConfigData?: {                         // 模型配置数据
      clientModelConfigs: ModelConfig[];               // 客户端模型配置列表
    };
    userTier?: {                                       // 用户等级
      id: string;                                      // 等级 ID
      name: string;                                    // 等级名称（例如 "Pro"）
      description: string;                             // 等级描述
    };
  };
}
```

---

#### ModelConfig

**定义**: `src/types.ts:5-17`

**说明**: 单个模型的配置信息（来自 API 响应）

**字段**:

```typescript
interface ModelConfig {
  label: string;                                       // 显示标签
  modelOrAlias: {
    model: string;                                     // 模型 ID
  };
  quotaInfo?: {                                        // 配额信息
    remainingFraction?: number;                        // 剩余分数（0-1）
    resetTime: string;                                 // 重置时间（ISO 8601）
  };
  supportsImages?: boolean;                            // 是否支持图片
  isRecommended?: boolean;                             // 是否推荐
  allowedTiers?: string[];                             // 允许的等级
}
```

---

### 3.4 Google API 类型

#### ProjectInfo

**定义**: `src/api/googleCloudCodeClient.ts:21-24`

**说明**: Google Cloud 项目信息

**字段**:

```typescript
interface ProjectInfo {
  projectId: string;  // 项目 ID
  tier: string;       // 订阅等级（'FREE', 'PRO', 'TEAMS' 等）
}
```

---

#### ModelQuotaFromApi

**定义**: `src/api/googleCloudCodeClient.ts:28-35`

**说明**: 从 Google API 获取的模型配额信息

**字段**:

```typescript
interface ModelQuotaFromApi {
  modelName: string;       // 模型名称（例如 "gemini-3-5-flash"）
  displayName: string;     // 显示名称（例如 "Gemini 3.5 Flash"）
  remainingQuota: number;  // 剩余配额（0-1 之间的小数）
  resetTime: string;       // 重置时间（ISO 8601 格式）
  isExhausted: boolean;    // 是否已耗尽
}
```

---

#### ModelsQuotaResponse

**定义**: `src/api/googleCloudCodeClient.ts:40-42`

**说明**: 模型配额列表响应

**字段**:

```typescript
interface ModelsQuotaResponse {
  models: ModelQuotaFromApi[];  // 模型配额列表
}
```

---

#### GoogleApiError

**定义**: `src/api/googleCloudCodeClient.ts:47-71`

**说明**: Google API 错误类

**字段**:

```typescript
class GoogleApiError extends Error {
  statusCode: number;      // HTTP 状态码
  errorCode?: string;      // 错误代码

  isRetryable(): boolean;  // 是否可以重试（5xx 或 429）
  needsReauth(): boolean;  // 是否需要重新登录（401）
}
```

---

### 3.5 认证类型

#### AuthState

**定义**: `src/auth/googleAuthService.ts:27-34`

**说明**: 认证状态枚举

**值**:

```typescript
enum AuthState {
  NOT_AUTHENTICATED = 'not_authenticated',  // 未登录
  AUTHENTICATING = 'authenticating',        // 登录中
  AUTHENTICATED = 'authenticated',          // 已登录
  TOKEN_EXPIRED = 'token_expired',          // Token 过期
  REFRESHING = 'refreshing',                // 刷新中
  ERROR = 'error'                           // 错误
}
```

---

#### AuthStateInfo

**定义**: `src/auth/googleAuthService.ts:39-43`

**说明**: 完整的认证状态信息

**字段**:

```typescript
interface AuthStateInfo {
  state: AuthState;   // 认证状态
  error?: string;     // 错误信息（可选）
  email?: string;     // 用户邮箱（可选）
}
```

---

#### TokenData

**定义**: `src/auth/tokenStorage.ts`

**说明**: Token 数据（存储在 SecretStorage）

**字段**:

```typescript
interface TokenData {
  accessToken: string;                      // Access Token
  refreshToken: string;                     // Refresh Token
  expiresAt: number;                        // 过期时间戳（毫秒）
  tokenType: string;                        // Token 类型（通常为 "Bearer"）
  scope: string;                            // 权限范围
  source: 'manual' | 'imported';            // Token 来源
}
```

---

### 3.6 端口检测类型

#### PortDetectionResult

**定义**: `src/portDetectionService.ts:10-19`

**说明**: 端口检测结果

**字段**:

```typescript
interface PortDetectionResult {
  port: number;           // HTTPS 端口（主端口）
  connectPort: number;    // HTTPS 端口（同 port）
  httpPort: number;       // HTTP 备用端口
  csrfToken: string;      // CSRF Token
  source: 'process';      // 来源（固定为 'process'）
  confidence: 'high';     // 置信度（固定为 'high'）
}
```

---

#### AntigravityProcessInfo

**定义**: `src/processPortDetector.ts`

**说明**: Antigravity 进程信息

**字段**:

```typescript
interface AntigravityProcessInfo {
  connectPort: number;     // HTTPS 端口
  extensionPort: number;   // HTTP 端口
  csrfToken: string;       // CSRF Token
}
```

---

## 4. Type Usage Examples

### 4.1 解析 API 响应为 QuotaSnapshot

```typescript
// src/quotaService.ts:677-715
function parseGetUserStatusResponse(response: UserStatusResponse): QuotaSnapshot {
  const models: ModelQuotaInfo[] = response.userStatus.cascadeModelConfigData
    ?.clientModelConfigs
    .filter(config => config.quotaInfo)
    .map(config => parseModelQuota(config));

  return {
    timestamp: new Date(),
    promptCredits: /* ... */,
    models,
    planName: response.userStatus.userTier?.name
  };
}
```

### 4.2 更新状态栏显示

```typescript
// src/statusBar.ts:53-131
function updateDisplay(snapshot: QuotaSnapshot): void {
  const modelsToShow = selectModelsToDisplay(snapshot.models);

  for (const model of modelsToShow) {
    const indicator = getStatusIndicator(model.remainingPercentage ?? 0);
    // 构建显示文本...
  }
}
```

### 4.3 检查认证状态

```typescript
// src/extension.ts:676
const authState = googleAuthService.getAuthState();
if (authState.state === AuthState.NOT_AUTHENTICATED) {
  // 处理未登录状态...
}
```

## 5. Related Documents

- **Quota Service Architecture**: `llmdoc/architecture/quota-service-architecture.md`
- **Authentication Flow**: `llmdoc/architecture/authentication-flow.md`
- **API Clients**: `llmdoc/architecture/api-clients.md`
