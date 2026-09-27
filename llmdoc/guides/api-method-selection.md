# API Method Selection Guide

如何选择合适的 API 方法获取配额信息。

## 1. 两种 API 方法对比

### GET_USER_STATUS (本地检测)

**工作原理**:
- 检测本地 Antigravity 语言服务器进程
- 从进程参数中提取端口和 CSRF Token
- 通过本地 HTTPS/HTTP 接口调用 `GetUserStatus` API

**优势**:
- ✅ 无需额外登录，自动使用 Antigravity 的认证
- ✅ 响应速度快（本地请求）
- ✅ 无需网络代理配置（本地通信）

**限制**:
- ❌ 仅适用于 Antigravity IDE 环境
- ❌ 不支持远程 SSH 项目
- ❌ 需要系统支持端口检测命令（lsof/netstat/ss）

**适用场景**:
- 使用官方 Antigravity IDE
- 本地开发环境
- 不想配置 Google 登录

### GOOGLE_API (远程检测)

**工作原理**:
- 通过 Google OAuth 2.0 登录
- 直接调用 Google Cloud Code API 获取配额
- 支持自动刷新 Token

**优势**:
- ✅ 支持所有 IDE 环境（WindSurf、Kiro、VS Code 等）
- ✅ 支持远程 SSH 项目
- ✅ 无需本地 Antigravity 服务器
- ✅ 可导入 Antigravity 本地 Token（无需重新登录）

**限制**:
- ❌ 需要 Google 账号登录
- ❌ 需要网络连接（访问 Google API）
- ❌ 首次使用需要浏览器授权

**适用场景**:
- 使用 Antigravity Fork 版本（WindSurf、Kiro 等）
- 使用原生 VS Code
- 远程 SSH 开发
- 端口检测失败时的备选方案

## 2. 如何选择

### 决策流程图

```
是否使用官方 Antigravity IDE？
├─ 是 → 是否本地开发（非 SSH）？
│       ├─ 是 → 推荐使用 GET_USER_STATUS
│       └─ 否 → 必须使用 GOOGLE_API
└─ 否 → 必须使用 GOOGLE_API
```

### 推荐配置

| 环境 | 推荐方法 | 原因 |
|------|---------|------|
| Antigravity IDE (本地) | GET_USER_STATUS | 自动检测，无需登录 |
| Antigravity IDE (SSH) | GOOGLE_API | 本地检测不支持远程 |
| WindSurf / Kiro | GOOGLE_API | 非官方 IDE，无本地服务器 |
| VS Code | GOOGLE_API | 非官方 IDE，无本地服务器 |

## 3. 切换 API 方法

### 方法一：通过设置界面

1. 打开设置（Ctrl+, / Cmd+,）
2. 搜索 `antigravityQuotaWatcher.apiMethod`
3. 选择：
   - `GET_USER_STATUS`: 本地检测
   - `GOOGLE_API`: 远程检测

### 方法二：通过 settings.json

```json
{
  "antigravityQuotaWatcher.apiMethod": "GOOGLE_API"
}
```

### 切换后的行为

#### 切换到 GET_USER_STATUS
1. 扩展停止当前轮询
2. 开始检测本地端口和 CSRF Token
3. 检测成功后自动开始轮询
4. 检测失败会提示重试或切换回 GOOGLE_API

#### 切换到 GOOGLE_API
1. 扩展停止当前轮询
2. 检查是否已登录 Google 账号
3. 如果未登录：
   - 检测本地 Antigravity 是否有 Token
   - 提示导入本地 Token 或手动登录
4. 登录成功后自动开始轮询

## 4. 本地 Token 导入功能

### 什么是本地 Token 导入？

当你切换到 GOOGLE_API 方法时，扩展会自动检测本地 Antigravity 是否已登录，并提示导入其 refresh_token，避免重复登录。

### 工作原理

1. 扩展读取 Antigravity 本地数据库：
   - Windows: `%APPDATA%\Antigravity\User\globalStorage\state.vscdb`
   - macOS: `~/Library/Application Support/Antigravity/User/globalStorage/state.vscdb`
   - Linux: `~/.config/Antigravity/User/globalStorage/state.vscdb`

2. 提取 Google OAuth refresh_token

3. 使用该 Token 获取新的 access_token

4. 保存到扩展的安全存储中

### 使用场景

- 从 GET_USER_STATUS 切换到 GOOGLE_API
- 首次启动扩展（GOOGLE_API 模式）
- Antigravity 本地已登录，但扩展未登录

### 手动触发导入

使用命令：`Antigravity Quota Watcher: Login with Local Token`

## 5. 常见问题

### Q: 我应该使用哪种方法？

**A**: 如果你使用官方 Antigravity IDE 且是本地开发，推荐 GET_USER_STATUS（默认）。其他情况使用 GOOGLE_API。

### Q: 切换方法后需要重启 IDE 吗？

**A**: 不需要，扩展会自动处理切换逻辑。

### Q: GOOGLE_API 方法会消耗更多配额吗？

**A**: 不会，两种方法获取的配额数据相同，不会额外消耗 AI 模型配额。

### Q: 本地 Token 导入安全吗？

**A**: 是的，Token 存储在 VS Code 的 SecretStorage 中，使用系统级加密。扩展不会上传或泄露 Token。

### Q: 为什么 GET_USER_STATUS 检测失败？

**A**: 可能原因：
- Antigravity 语言服务器未运行
- 系统缺少端口检测命令（Linux 需要 lsof/netstat/ss）
- 权限不足（Windows 可能需要管理员权限）

解决方案：切换到 GOOGLE_API 方法。
