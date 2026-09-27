# Authentication Flow

## 1. Identity

- **What it is:** Google OAuth 2.0 认证流程和 Token 管理机制。
- **Purpose:** 管理用户登录状态、Token 刷新和本地 Token 同步。

## 2. Core Components

- `src/auth/googleAuthService.ts` (GoogleAuthService): 认证服务主类
- `src/auth/tokenStorage.ts` (TokenStorage): Token 安全存储
- `src/auth/callbackServer.ts` (CallbackServer): OAuth 回调服务器
- `src/auth/antigravityTokenExtractor.ts` (extractRefreshTokenFromAntigravity): 本地 Token 提取
- `src/auth/tokenSyncChecker.ts` (TokenSyncChecker): Token 同步检测

## 3. Execution Flow (LLM Retrieval Map)

### 3.1 认证服务初始化

**入口**: `src/auth/googleAuthService.ts:112-149`

**执行步骤**:

1. **保存上下文** (`src/auth/googleAuthService.ts:114`)
   - 保存 VS Code ExtensionContext
   - 初始化 TokenStorage

2. **检查存储的 Token** (`src/auth/googleAuthService.ts:117-119`)
   - 调用 `tokenStorage.hasToken()`
   - 判断是否有已保存的 Token

3. **Token 存在的情况** (`src/auth/googleAuthService.ts:121-144`)
   - 检查是否过期 (`tokenStorage.isTokenExpired()`)
   - **未过期**: 设置状态为 AUTHENTICATED
   - **已过期**: 尝试刷新 Token
     - 刷新成功 → AUTHENTICATED
     - 刷新失败 → TOKEN_EXPIRED 或 ERROR

4. **Token 不存在的情况** (`src/auth/googleAuthService.ts:146-148`)
   - 设置状态为 NOT_AUTHENTICATED

### 3.2 标准 OAuth 登录流程

**入口**: `src/auth/googleAuthService.ts:173-269`

**执行步骤**:

1. **生成安全参数** (`src/auth/googleAuthService.ts:185-194`)
   - `state`: 随机字符串（CSRF 保护）
   - `codeVerifier`: PKCE code verifier
   - `codeChallenge`: SHA256(codeVerifier) 的 base64url 编码

2. **启动回调服务器** (`src/auth/googleAuthService.ts:197-219`)
   - 创建 CallbackServer 实例
   - 加载插件图标（用于回调页面）
   - 调用 `callbackServer.startServer()` 启动 HTTP 服务器
   - 获取重定向 URI（例如 `http://localhost:3000/callback`）

3. **构建授权 URL** (`src/auth/googleAuthService.ts:222`)
   - 调用 `buildAuthUrl(redirectUri, state, codeChallenge)`
   - 参数包括：
     - `client_id`: Google OAuth Client ID
     - `redirect_uri`: 回调服务器地址
     - `response_type`: "code"
     - `scope`: 所需权限范围
     - `code_challenge`: PKCE challenge
     - `access_type`: "offline"（获取 refresh_token）
     - `prompt`: "consent"（强制显示授权页面）

4. **打开浏览器** (`src/auth/googleAuthService.ts:229`)
   - 调用 `vscode.env.openExternal()` 打开授权 URL
   - 用户在浏览器中完成授权

5. **等待回调** (`src/auth/googleAuthService.ts:226-233`)
   - 调用 `callbackServer.waitForCallback(state)`
   - 阻塞等待用户授权完成
   - 验证 state 参数（CSRF 保护）
   - 返回 authorization code

6. **交换 Token** (`src/auth/googleAuthService.ts:235-242`)
   - 调用 `exchangeCodeForToken(code, redirectUri, codeVerifier)`
   - 发送 POST 请求到 Google Token 端点
   - 参数包括：
     - `code`: authorization code
     - `redirect_uri`: 必须与步骤 3 一致
     - `code_verifier`: PKCE verifier
     - `grant_type`: "authorization_code"
   - 返回 TokenData（包含 access_token 和 refresh_token）

7. **保存 Token** (`src/auth/googleAuthService.ts:245-246`)
   - 调用 `tokenStorage.saveToken(tokenData)`
   - 存储到 VS Code SecretStorage

8. **更新状态** (`src/auth/googleAuthService.ts:248`)
   - 设置状态为 AUTHENTICATED
   - 通知所有监听器

### 3.3 本地 Token 导入流程

**入口**: `src/auth/googleAuthService.ts:293-341`

**执行步骤**:

1. **状态检查** (`src/auth/googleAuthService.ts:296-299`)
   - 如果正在认证或刷新，跳过

2. **使用 Refresh Token 获取 Access Token** (`src/auth/googleAuthService.ts:304-314`)
   - 构建请求参数：
     - `client_id`: Google OAuth Client ID
     - `client_secret`: Google OAuth Client Secret
     - `refresh_token`: 从 Antigravity 提取的 Token
     - `grant_type`: "refresh_token"
   - 调用 `makeTokenRequest(params)`

3. **构建 TokenData** (`src/auth/googleAuthService.ts:317-324`)
   - `accessToken`: 从响应获取
   - `refreshToken`: 使用导入的 refresh_token
   - `expiresAt`: 当前时间 + expires_in
   - `source`: "imported"（标记为导入）

4. **保存并更新状态** (`src/auth/googleAuthService.ts:326-330`)
   - 保存到 TokenStorage
   - 设置状态为 AUTHENTICATED

### 3.4 Token 刷新流程

**入口**: `src/auth/googleAuthService.ts:481-522`

**触发条件**:
- Token 过期前 5 分钟（`tokenStorage.isTokenExpired()` 返回 true）
- 调用 `getValidAccessToken()` 时自动触发

**执行步骤**:

1. **获取 Refresh Token** (`src/auth/googleAuthService.ts:486-490`)
   - 调用 `tokenStorage.getRefreshToken()`
   - 如果不存在，抛出错误

2. **发送刷新请求** (`src/auth/googleAuthService.ts:493-501`)
   - 构建请求参数：
     - `client_id`: Google OAuth Client ID
     - `client_secret`: Google OAuth Client Secret
     - `refresh_token`: 存储的 refresh_token
     - `grant_type`: "refresh_token"
   - 调用 `makeTokenRequest(params)`

3. **更新 Access Token** (`src/auth/googleAuthService.ts:505-509`)
   - 调用 `tokenStorage.updateAccessToken()`
   - 只更新 access_token 和 expiresAt
   - 保留原有的 refresh_token

4. **更新状态** (`src/auth/googleAuthService.ts:511`)
   - 设置状态为 AUTHENTICATED

5. **错误处理** (`src/auth/googleAuthService.ts:512-521`)
   - 调用 `classifyRefreshFailure(error)` 判断错误类型：
     - `invalid_grant`: TOKEN_EXPIRED（需要重新登录）
     - 其他错误: ERROR

### 3.5 Token 同步检测

**入口**: `src/auth/tokenSyncChecker.ts`

**工作原理**:

1. **定时检查** (`src/extension.ts:876-890`)
   - 每 30 秒执行一次
   - 仅在扩展未登录或 Token 过期时运行

2. **检测本地 Token** (`src/auth/tokenSyncChecker.ts:checkLocalTokenWhenNotLoggedIn`)
   - 读取 Antigravity 本地数据库
   - 提取 refresh_token
   - 与扩展存储的 Token 比较

3. **处理 Token 变化**:
   - **本地新登录**: 自动导入新 Token
   - **本地登出**: 提示用户是否同步登出
   - **Token 相同**: 无操作

### 3.6 认证状态管理

**状态枚举**: `src/auth/googleAuthService.ts:27-34`

```typescript
enum AuthState {
  NOT_AUTHENTICATED,    // 未登录
  AUTHENTICATING,       // 登录中
  AUTHENTICATED,        // 已登录
  TOKEN_EXPIRED,        // Token 过期
  REFRESHING,           // 刷新中
  ERROR                 // 错误
}
```

**状态转换**:

```
NOT_AUTHENTICATED
  ├─ login() → AUTHENTICATING
  │   ├─ 成功 → AUTHENTICATED
  │   └─ 失败 → ERROR
  └─ loginWithRefreshToken() → REFRESHING
      ├─ 成功 → AUTHENTICATED
      └─ 失败 → NOT_AUTHENTICATED

AUTHENTICATED
  ├─ Token 过期 → REFRESHING
  │   ├─ 成功 → AUTHENTICATED
  │   └─ 失败 → TOKEN_EXPIRED / ERROR
  └─ logout() → NOT_AUTHENTICATED

TOKEN_EXPIRED
  └─ login() → AUTHENTICATING
```

### 3.7 回调服务器机制

**入口**: `src/auth/callbackServer.ts`

**工作原理**:

1. **启动服务器** (`startServer`)
   - 创建 HTTP 服务器
   - 监听端口 3000-3100（自动选择可用端口）
   - 设置 30 秒超时

2. **处理回调请求** (`waitForCallback`)
   - 解析 URL 参数（code, state）
   - 验证 state 参数（CSRF 保护）
   - 返回 HTML 页面（显示"登录成功"）
   - 返回 authorization code

3. **关闭服务器** (`stop`)
   - 关闭所有连接
   - 释放端口

## 4. Design Rationale

### PKCE 支持
- **原因**: 增强安全性，防止 authorization code 被拦截
- **实现**: 使用 SHA256 生成 code_challenge

### 本地 Token 导入
- **原因**: 避免用户重复登录，提升体验
- **实现**: 读取 Antigravity 本地数据库，提取 refresh_token

### Token 自动刷新
- **原因**: 避免用户频繁重新登录
- **实现**: 在 `getValidAccessToken()` 中自动检查并刷新

### 提前 5 分钟刷新
- **原因**: 避免在请求过程中 Token 过期
- **实现**: `isTokenExpired()` 检查 `expiresAt - 5分钟`

### 状态变化通知
- **原因**: 扩展需要根据认证状态更新 UI
- **实现**: 观察者模式，`onAuthStateChange()` 注册监听器

### Token 同步检测
- **原因**: 用户可能在 Antigravity 中切换账号
- **实现**: 定时检查本地数据库，自动同步 Token
