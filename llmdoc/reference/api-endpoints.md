# API Endpoints

## 1. Core Summary

Antigravity Quota Watcher 使用的所有 API 端点说明，包括本地 API 和 Google API。

## 2. Source of Truth

- **Local API**: `src/quotaService.ts:104-105` - 本地 API 路径定义
- **Google Cloud Code API**: `src/auth/constants.ts:4-11` - Google API 端点
- **Antigravity API**: `src/api/antigravityClient.ts:5-8` - Antigravity API 端点

## 3. API Endpoints Reference

### 3.1 本地 API（Antigravity 语言服务器）

#### 基础信息

- **协议**: HTTPS (主) / HTTP (备用)
- **主机**: 127.0.0.1
- **端口**: 动态检测（通常 42100-42200）
- **认证**: CSRF Token (Header: `X-Codeium-Csrf-Token`)

---

#### GetUserStatus

**端点**: `POST /exa.language_server_pb.LanguageServerService/GetUserStatus`

**用途**: 获取用户状态和配额信息

**请求头**:
```
Content-Type: application/json
X-Codeium-Csrf-Token: <csrf_token>
Connect-Protocol-Version: 1
```

**请求体**:
```json
{
  "metadata": {
    "ideName": "antigravity",
    "extensionName": "antigravity",
    "ideVersion": "1.11.3",
    "locale": "en"
  }
}
```

**响应体**:
```json
{
  "userStatus": {
    "name": "用户名",
    "email": "user@example.com",
    "userTier": {
      "id": "pro",
      "name": "Pro",
      "description": "Pro tier"
    },
    "planStatus": {
      "planInfo": {
        "teamsTier": "INDIVIDUAL",
        "planName": "Pro",
        "monthlyPromptCredits": 1000,
        "monthlyFlowCredits": 500
      },
      "availablePromptCredits": 850,
      "availableFlowCredits": 450
    },
    "cascadeModelConfigData": {
      "clientModelConfigs": [
        {
          "label": "Claude 3.5 Sonnet",
          "modelOrAlias": {
            "model": "claude-3-5-sonnet"
          },
          "quotaInfo": {
            "remainingFraction": 0.85,
            "resetTime": "2024-01-01T00:00:00Z"
          }
        }
      ]
    }
  }
}
```

**实现**: `src/quotaService.ts:502-520`

**错误处理**:
- HTTP 非 200: 抛出错误
- 响应格式错误: 抛出解析错误
- CSRF Token 无效: 返回 401/403

---

### 3.2 Google Cloud Code API

#### 基础信息

- **协议**: HTTPS
- **主机**: cloudcode-pa.clients6.google.com
- **端口**: 443
- **认证**: OAuth 2.0 Bearer Token
- **超时**: 30 秒

---

#### LoadCodeAssist

**端点**: `POST https://cloudcode-pa.clients6.google.com/v1internal:loadCodeAssist`

**用途**: 加载项目信息和订阅等级

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <access_token>
User-Agent: AntigravityQuotaWatcher/1.0
```

**请求体**:
```json
{
  "metadata": {
    "ideType": "ANTIGRAVITY"
  }
}
```

**响应体**:
```json
{
  "cloudaicompanionProject": "project-id-123",
  "currentTier": {
    "id": "FREE",
    "name": "Free"
  },
  "paidTier": {
    "id": "PRO",
    "name": "Pro"
  }
}
```

**实现**: `src/api/googleCloudCodeClient.ts:96-122`

**错误处理**:
- HTTP 401: 需要重新登录
- HTTP 5xx: 可重试
- HTTP 429: 限流，可重试

---

#### FetchAvailableModels

**端点**: `POST https://cloudcode-pa.clients6.google.com/v1internal:fetchAvailableModels`

**用途**: 获取所有模型的配额信息

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <access_token>
User-Agent: AntigravityQuotaWatcher/1.0
```

**请求体**:
```json
{
  "project": "project-id-123"
}
```

**注意**: 如果 `project` 为空，可省略该字段

**响应体**:
```json
{
  "models": {
    "gemini-3-5-flash": {
      "quotaInfo": {
        "remainingFraction": 0.85,
        "resetTime": "2024-01-01T00:00:00Z"
      },
      "maxTokens": 1000000
    },
    "claude-3-5-sonnet": {
      "quotaInfo": {
        "remainingFraction": 0.75,
        "resetTime": "2024-01-01T00:00:00Z"
      },
      "maxTokens": 200000
    }
  }
}
```

**实现**: `src/api/googleCloudCodeClient.ts:130-199`

**模型过滤**:
- 只保留包含 "gemini"/"claude"/"gpt" 的模型
- 过滤掉 Gemini < 3.0 的旧版本

---

### 3.3 Antigravity API（周限检测专用）

#### 基础信息

- **协议**: HTTPS
- **主机**: daily-cloudcode-pa.sandbox.googleapis.com
- **端口**: 443
- **认证**: OAuth 2.0 Bearer Token
- **超时**: 30 秒

---

#### LoadCodeAssist

**端点**: `POST https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:loadCodeAssist`

**用途**: 加载 Antigravity 项目信息（用于周限检测）

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <access_token>
User-Agent: antigravity/1.11.3 windows/amd64
```

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

**响应体**:
```json
{
  "cloudaicompanionProject": "antigravity-project-id",
  "currentTier": {
    "id": "PRO",
    "name": "Pro"
  },
  "allowedTiers": [
    {
      "id": "LEGACY",
      "name": "Legacy",
      "isDefault": true
    }
  ]
}
```

**实现**: `src/api/antigravityClient.ts:29-63`

---

#### OnboardUser

**端点**: `POST https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:onboardUser`

**用途**: 创建 Antigravity 项目（如果不存在）

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <access_token>
User-Agent: antigravity/1.11.3 windows/amd64
```

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

**响应体**:
```json
{
  "done": true,
  "response": {
    "cloudaicompanionProject": "new-project-id"
  }
}
```

**轮询机制**:
- 最大尝试次数: 5 次
- 重试延迟: 2 秒
- 成功条件: `done === true`

**实现**: `src/api/antigravityClient.ts:113-141`

---

### 3.4 Google OAuth 2.0 API

#### 基础信息

- **协议**: HTTPS
- **主机**: accounts.google.com / oauth2.googleapis.com
- **端口**: 443

---

#### Authorization Endpoint

**端点**: `GET https://accounts.google.com/o/oauth2/v2/auth`

**用途**: 获取 authorization code

**参数**:
```
client_id: <client_id>
redirect_uri: http://localhost:3000/callback
response_type: code
scope: openid email profile https://www.googleapis.com/auth/cloudcode
state: <random_state>
code_challenge: <pkce_challenge>
code_challenge_method: S256
access_type: offline
prompt: consent
```

**响应**: 重定向到 `redirect_uri?code=<code>&state=<state>`

**实现**: `src/auth/googleAuthService.ts:555-568`

---

#### Token Endpoint

**端点**: `POST https://oauth2.googleapis.com/token`

**用途**: 交换 authorization code 获取 Token

**请求头**:
```
Content-Type: application/x-www-form-urlencoded
```

**请求体** (Authorization Code):
```
client_id=<client_id>
client_secret=<client_secret>
code=<authorization_code>
redirect_uri=<redirect_uri>
grant_type=authorization_code
code_verifier=<pkce_verifier>
```

**请求体** (Refresh Token):
```
client_id=<client_id>
client_secret=<client_secret>
refresh_token=<refresh_token>
grant_type=refresh_token
```

**响应体**:
```json
{
  "access_token": "ya29.xxx",
  "refresh_token": "1//xxx",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "openid email profile https://www.googleapis.com/auth/cloudcode"
}
```

**实现**: `src/auth/googleAuthService.ts:607-655`

**错误响应**:
```json
{
  "error": "invalid_grant",
  "error_description": "Token has been expired or revoked."
}
```

---

#### UserInfo Endpoint

**端点**: `GET https://www.googleapis.com/oauth2/v2/userinfo`

**用途**: 获取用户信息（邮箱）

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应体**:
```json
{
  "id": "123456789",
  "email": "user@example.com",
  "verified_email": true,
  "name": "User Name",
  "picture": "https://..."
}
```

**实现**: `src/auth/googleAuthService.ts:421-476`

---

## 4. API Error Handling

### 4.1 本地 API 错误

| 错误类型 | HTTP 状态码 | 处理方式 |
|---------|------------|---------|
| CSRF Token 无效 | 401/403 | 重新检测端口 |
| 端口错误 | ECONNREFUSED | 重新检测端口 |
| HTTPS 失败 | EPROTO | 回退到 HTTP |
| 超时 | ETIMEDOUT | 重试 3 次 |
| 其他错误 | - | 重试 3 次 |

### 4.2 Google API 错误

| 错误类型 | HTTP 状态码 | 处理方式 |
|---------|------------|---------|
| 未授权 | 401 | 提示重新登录 |
| 限流 | 429 | 延迟重试 |
| 服务器错误 | 5xx | 延迟重试 |
| 客户端错误 | 4xx (除 401/429) | 不重试，显示错误 |
| 网络错误 | - | 标记数据过时，继续轮询 |

### 4.3 OAuth 错误

| 错误代码 | 说明 | 处理方式 |
|---------|------|---------|
| invalid_grant | Token 无效或过期 | 提示重新登录 |
| invalid_client | Client ID/Secret 错误 | 显示错误 |
| access_denied | 用户拒绝授权 | 显示错误 |
| server_error | 服务器错误 | 重试 |

## 5. API Rate Limits

### 5.1 本地 API

- **无限制**: 本地请求，无速率限制
- **推荐间隔**: 60 秒（避免频繁请求）

### 5.2 Google Cloud Code API

- **限制**: 未公开，建议不要过于频繁
- **推荐间隔**: 60 秒
- **错误处理**: 遇到 429 时延迟重试

### 5.3 Google OAuth API

- **Token 刷新**: 无明确限制
- **推荐**: 仅在 Token 过期前 5 分钟刷新

## 6. API Security

### 6.1 CSRF Token

- **来源**: 从 Antigravity 进程参数提取
- **存储**: 内存中（不持久化）
- **传输**: HTTPS 加密
- **日志**: 遮蔽显示（只显示前 6 位和后 4 位）

### 6.2 OAuth Token

- **存储**: VS Code SecretStorage（系统级加密）
- **传输**: HTTPS 加密
- **刷新**: 自动刷新，无需用户操作
- **日志**: 遮蔽显示

### 6.3 代理支持

- **HTTPS 代理**: 支持
- **认证代理**: 支持（URL 中包含用户名密码）
- **SOCKS5**: 支持
- **证书验证**: 本地 API 禁用（`rejectUnauthorized: false`）

## 7. Related Documents

- **Quota Service Architecture**: `llmdoc/architecture/quota-service-architecture.md`
- **Authentication Flow**: `llmdoc/architecture/authentication-flow.md`
- **API Clients**: `llmdoc/architecture/api-clients.md`
- **Proxy Configuration**: `llmdoc/guides/proxy-configuration.md`
