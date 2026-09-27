# Commands

## 1. Core Summary

Antigravity Quota Watcher 提供的所有命令及其功能说明。

## 2. Source of Truth

- **Primary Code**: `package.json:19-51` - 命令定义
- **Command Handlers**: `src/extension.ts:116-648` - 命令实现

## 3. Command Reference

### 3.1 通用命令

#### antigravity-quota-watcher.refreshQuota

**标题**: Refresh Quota / 刷新配额

**功能**: 手动刷新配额数据，重置错误状态并重新开始轮询

**触发方式**:
- 命令面板: `Ctrl+Shift+P` → 输入 "Refresh Quota"
- 状态栏: 错误状态时点击状态栏

**实现**: `src/extension.ts:149-189`

**执行流程**:
1. 检查 `quotaService` 是否已初始化
2. 如果未初始化：
   - GOOGLE_API 模式: 提示需要先登录
   - 本地 API 模式: 委托给 `detectPort` 命令
3. 如果已初始化：
   - 显示"刷新中"提示
   - 更新状态栏配置
   - 调用 `quotaService.retryFromError()` 重试

**适用场景**:
- 配额获取失败后重试
- 修改配置后手动刷新
- 怀疑数据不准确时

---

#### antigravity-quota-watcher.quickRefreshQuota

**标题**: Quick Refresh Quota / 快速刷新配额

**功能**: 立即刷新配额，不中断轮询循环

**触发方式**:
- 状态栏: 正常状态时点击状态栏

**实现**: `src/extension.ts:117-146`

**执行流程**:
1. 检查 `quotaService` 是否已初始化
2. 如果未初始化：处理方式同 `refreshQuota`
3. 如果已初始化：
   - 显示刷新动画（旋转图标）
   - 调用 `quotaService.quickRefresh()`
   - 不重置错误状态，不中断轮询

**与 refreshQuota 的区别**:
- `quickRefresh`: 快速刷新，保持轮询
- `refreshQuota`: 完整重试，重置状态

---

#### antigravity-quota-watcher.openDashboard

**标题**: Open Dashboard / 打开仪表板

**功能**: 打开 Dashboard 面板，显示详细配额信息

**触发方式**:
- 命令面板: `Ctrl+Shift+P` → 输入 "Open Dashboard"

**实现**: `src/extension.ts:491-520`

**执行流程**:
1. 调用 `WebviewPanelService.createOrShow()` 创建或显示面板
2. 收集当前状态：
   - API 方法
   - 轮询间隔
   - 登录状态
   - 配额快照（从 StatusBarService 缓存获取）
   - 端口信息
3. 调用 `panel.updateState()` 更新面板状态

**Dashboard 功能**:
- 配额概览表格
- 连接状态信息
- 账号信息
- 周限检测
- 快捷操作按钮

---

### 3.2 本地 API 专用命令

#### antigravity-quota-watcher.detectPort

**标题**: Re-detect Port / 重新检测端口

**功能**: 重新检测 Antigravity 语言服务器的端口和 CSRF Token

**触发方式**:
- 命令面板: `Ctrl+Shift+P` → 输入 "Re-detect Port"
- 自动触发: 端口检测失败时

**实现**: `src/extension.ts:192-303`

**执行流程**:
1. 检查当前 API 方法
2. 如果是 GOOGLE_API 方法：
   - 提示该方法不需要端口检测
   - 返回
3. 如果是本地 API 方法：
   - 显示"检测中"状态
   - 调用 `portDetectionService.detectPort()`
   - 检测成功：
     - 更新或创建 `quotaService`
     - 更新端口和 CSRF Token
     - 开始轮询
     - 更新 Dashboard 端口信息
   - 检测失败：
     - 显示错误提示
     - 提供重试选项

**适用场景**:
- 首次启动检测失败
- Antigravity 重启后端口变化
- 状态栏显示端口错误

**注意**: 仅适用于 GET_USER_STATUS API 方法

---

### 3.3 Google API 专用命令

#### antigravity-quota-watcher.googleLogin

**标题**: Login with Google / 使用 Google 登录

**功能**: 发起 Google OAuth 2.0 登录流程

**触发方式**:
- 命令面板: `Ctrl+Shift+P` → 输入 "Login with Google"
- 状态栏: 未登录或登录过期时点击状态栏

**实现**: `src/extension.ts:347-372`

**执行流程**:
1. 检查 `googleAuthService` 是否已初始化
2. 显示"登录中"状态
3. 调用 `googleAuthService.login()`：
   - 打开浏览器进行 OAuth 授权
   - 等待用户授权
   - 交换 Token
   - 保存到安全存储
4. 登录成功：
   - 如果当前配置为 GOOGLE_API，开始轮询
   - 调用 `quotaService.quickRefresh()` 立即获取配额
5. 登录失败：
   - 显示"未登录"状态

**适用场景**:
- 首次使用 GOOGLE_API 方法
- Token 过期需要重新登录
- 切换 Google 账号

**注意**: 仅适用于 GOOGLE_API 方法

---

#### antigravity-quota-watcher.loginLocalToken

**标题**: Login with Local Token / 使用本地凭证登录

**功能**: 从 Antigravity 本地数据库导入 refresh_token 并登录

**触发方式**:
- 命令面板: `Ctrl+Shift+P` → 输入 "Login with Local Token"
- 自动提示: 检测到本地 Antigravity 已登录时

**实现**: `src/extension.ts:375-415`

**执行流程**:
1. 检查 `googleAuthService` 是否已初始化
2. 检查本地 Antigravity 数据库是否存在
3. 提取 refresh_token：
   - 调用 `extractRefreshTokenFromAntigravity()`
   - 读取 `state.vscdb` 数据库
4. 使用 refresh_token 登录：
   - 调用 `googleAuthService.loginWithRefreshToken()`
   - 获取新的 access_token
   - 保存到扩展存储
5. 登录成功：
   - 显示成功提示
   - 开始轮询配额
6. 登录失败：
   - 显示错误提示

**适用场景**:
- 避免重复登录
- Antigravity 已登录，扩展未登录
- 从 GET_USER_STATUS 切换到 GOOGLE_API

**注意**: 需要本地安装 Antigravity IDE

---

#### antigravity-quota-watcher.googleLogout

**标题**: Logout from Google / 登出 Google 账号

**功能**: 清除存储的 Token，登出 Google 账号

**触发方式**:
- 命令面板: `Ctrl+Shift+P` → 输入 "Logout from Google"

**实现**: `src/extension.ts:418-443`

**执行流程**:
1. 检查 `googleAuthService` 是否已初始化
2. 调用 `googleAuthService.logout()`：
   - 清除 TokenStorage 中的所有 Token
   - 设置状态为 NOT_AUTHENTICATED
3. 如果当前配置为 GOOGLE_API：
   - 停止配额轮询
   - 清除状态栏显示
   - 显示"未登录"状态
   - 清除 Dashboard 的登录状态和配额数据
4. 显示登出成功提示

**注意**:
- 不会影响本地 Antigravity 的登录状态
- 仅清除扩展存储的 Token

---

#### antigravity-quota-watcher.checkWeeklyLimit

**标题**: Check Weekly Limit / 检测周限

**功能**: 检测指定模型是否触发周配额限制

**触发方式**:
- Dashboard: 点击模型行的"检测周限"按钮

**实现**: `src/extension.ts:523-628`

**参数**:
- `modelName`: 模型名称（例如 "claude-3-5-sonnet"）

**执行流程**:
1. 检查是否已登录 Google 账号
2. 确定模型所属的配额池：
   - Gemini 3.x 池
   - Claude / GPT 池
   - Gemini 2.5 池
3. 显示"检测中"提示
4. 获取 access_token
5. 获取 Antigravity projectId（用于周限检测）
6. 调用 `WeeklyLimitChecker.checkModel()`：
   - 发送测试请求（提示词 "Hi"）
   - 解析响应状态
7. 显示检测结果：
   - **ok**: 配额正常
   - **rate_limited**: 5 小时限速
   - **weekly_limited**: 周限触发
   - **capacity_exhausted**: 服务器过载
   - **error**: 检测失败

**注意**:
- 会消耗少量配额（一次测试请求）
- 仅适用于 GOOGLE_API 方法
- 需要已登录

---

### 3.4 开发者命令

#### antigravity-quota-watcher.dev.previewNotifications

**标题**: Antigravity Dev: 预览通知弹窗

**功能**: 预览所有通知弹窗样式（开发调试用）

**触发方式**:
- 命令面板: `Ctrl+Shift+P` → 输入 "Antigravity Dev: 预览通知弹窗"

**实现**: `src/devTools.ts`

---

#### antigravity-quota-watcher.dev.previewStatusBar

**标题**: Antigravity Dev: 预览状态栏文本

**功能**: 预览所有状态栏显示样式（开发调试用）

**触发方式**:
- 命令面板: `Ctrl+Shift+P` → 输入 "Antigravity Dev: 预览状态栏文本"

**实现**: `src/devTools.ts`

---

#### antigravity-quota-watcher.dev.previewTooltip

**标题**: Antigravity Dev: 预览 Tooltip

**功能**: 预览 Tooltip 显示样式（开发调试用）

**触发方式**:
- 命令面板: `Ctrl+Shift+P` → 输入 "Antigravity Dev: 预览 Tooltip"

**实现**: `src/devTools.ts`

---

## 4. Command Usage Examples

### 4.1 首次使用（Antigravity IDE）

1. 安装扩展
2. 扩展自动检测端口
3. 如果检测失败，执行 `detectPort` 命令

### 4.2 首次使用（非 Antigravity IDE）

1. 安装扩展
2. 扩展提示切换到 GOOGLE_API
3. 执行 `googleLogin` 命令
4. 在浏览器中完成授权

### 4.3 配额不刷新

1. 点击状态栏（触发 `quickRefreshQuota`）
2. 如果仍然失败，执行 `refreshQuota` 命令
3. 查看日志排查问题

### 4.4 切换 API 方法

1. 修改配置 `apiMethod`
2. 如果切换到 GOOGLE_API：
   - 自动提示导入本地 Token 或手动登录
3. 如果切换到 GET_USER_STATUS：
   - 自动执行端口检测

### 4.5 切换 Google 账号

1. 执行 `googleLogout` 命令
2. 执行 `googleLogin` 命令
3. 在浏览器中选择新账号

## 5. Related Documents

- **Installation Guide**: `llmdoc/guides/installation-guide.md`
- **API Method Selection**: `llmdoc/guides/api-method-selection.md`
- **Google Login Guide**: `llmdoc/guides/google-login-guide.md`
- **Troubleshooting**: `llmdoc/guides/troubleshooting.md`
