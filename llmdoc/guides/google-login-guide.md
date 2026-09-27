# Google Login Guide

配置和使用 Google 登录功能的完整指南。

## 1. 前置条件

- 有效的 Google 账号
- 网络连接（可访问 Google API）
- 浏览器（用于 OAuth 授权）

## 2. 首次登录

### 步骤 1: 触发登录

三种方式触发登录：

1. **命令面板**:
   - 按 Ctrl+Shift+P / Cmd+Shift+P
   - 输入 `Antigravity Quota Watcher: Login with Google`
   - 回车执行

2. **点击状态栏**:
   - 当状态栏显示"未登录"时
   - 直接点击状态栏文本

3. **自动提示**:
   - 切换到 GOOGLE_API 方法时
   - 扩展会自动提示登录

### 步骤 2: 浏览器授权

1. 扩展会自动打开浏览器
2. 显示 Google 登录页面
3. 选择或输入你的 Google 账号
4. 查看权限请求：
   - 查看你的 Google 账号信息
   - 访问 Cloud Code API
5. 点击"允许"按钮

### 步骤 3: 完成登录

1. 浏览器显示"登录成功"页面
2. 可以关闭浏览器标签页
3. 返回 VS Code
4. 状态栏开始显示配额信息

## 3. 本地 Token 导入

### 什么时候会提示导入？

当满足以下条件时，扩展会提示导入本地 Token：

- 使用 GOOGLE_API 方法
- 扩展检测到本地 Antigravity 已登录
- 扩展本身未登录

### 导入流程

1. 扩展弹出提示：
   ```
   检测到本地 Antigravity 已登录，是否导入登录凭证？
   [使用本地凭证] [手动登录]
   ```

2. 选择"使用本地凭证"：
   - 扩展自动提取 refresh_token
   - 使用该 Token 获取 access_token
   - 保存到扩展的安全存储
   - 开始获取配额

3. 选择"手动登录"：
   - 跳过导入，使用标准 OAuth 流程
   - 需要在浏览器中完成授权

### 手动触发导入

如果错过了自动提示，可以手动触发：

1. 打开命令面板（Ctrl+Shift+P / Cmd+Shift+P）
2. 输入 `Antigravity Quota Watcher: Login with Local Token`
3. 回车执行

## 4. Token 管理

### Token 存储位置

Token 存储在 VS Code 的 SecretStorage 中，使用系统级加密：

- **Windows**: Windows Credential Manager
- **macOS**: Keychain
- **Linux**: Secret Service API (gnome-keyring / kwallet)

### Token 自动刷新

- Access Token 有效期：1 小时
- 扩展会在过期前 5 分钟自动刷新
- 刷新失败时会提示重新登录

### Token 同步检测

扩展会定期检测本地 Antigravity 的登录状态变化：

- **检测间隔**: 30 秒
- **触发条件**: 扩展未登录或 Token 过期时
- **自动行为**:
  - 检测到本地新登录 → 自动导入 Token
  - 检测到本地登出 → 提示扩展也登出

## 5. 登出

### 如何登出

1. 打开命令面板（Ctrl+Shift+P / Cmd+Shift+P）
2. 输入 `Antigravity Quota Watcher: Logout from Google`
3. 回车执行

### 登出后的行为

- 清除扩展存储的所有 Token
- 停止配额轮询
- 状态栏显示"未登录"
- 不会影响本地 Antigravity 的登录状态

## 6. 常见问题

### Q: 登录时浏览器没有自动打开？

**A**: 手动复制授权 URL：
1. 查看 VS Code 输出面板（View → Output）
2. 选择 "Antigravity Quota Watcher"
3. 找到以 `https://accounts.google.com/o/oauth2/v2/auth?` 开头的 URL
4. 复制到浏览器中打开

### Q: 授权后显示"回调失败"？

**A**: 可能原因：
- 防火墙阻止了本地回调服务器（端口 3000-3100）
- 浏览器阻止了重定向

解决方案：
1. 检查防火墙设置
2. 重试登录流程

### Q: Token 过期后需要重新授权吗？

**A**: 通常不需要，扩展会自动刷新 Token。只有在以下情况需要重新授权：
- Refresh Token 失效（长期未使用）
- Google 账号密码已更改
- 撤销了应用授权

### Q: 可以使用多个 Google 账号吗？

**A**: 扩展同时只支持一个账号。切换账号需要：
1. 先登出当前账号
2. 重新登录新账号

### Q: 导入本地 Token 后，Antigravity 登出会影响扩展吗？

**A**: 不会立即影响。扩展使用的是独立的 Token 副本。但如果 Google 账号本身登出，扩展的 Token 也会失效。

### Q: 登录信息会被上传吗？

**A**: 不会。所有 Token 都存储在本地，扩展不会上传任何登录信息到第三方服务器。

## 7. 安全建议

- ✅ 定期检查 Google 账号的已授权应用
- ✅ 不要在公共电脑上使用"记住登录"
- ✅ 发现异常时立即撤销授权并重新登录
- ❌ 不要分享你的 Token 或 refresh_token
- ❌ 不要在不信任的网络环境下登录
