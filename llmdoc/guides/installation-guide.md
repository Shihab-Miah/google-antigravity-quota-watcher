# Installation Guide

安装和配置 Antigravity Quota Watcher 的完整指南。

## 1. 安装扩展

### 方式一：插件市场安装（推荐）

1. 打开 VS Code 或 Antigravity IDE
2. 进入扩展市场（Ctrl+Shift+X / Cmd+Shift+X）
3. 搜索 `wusimpl Antigravity Quota Watcher @sort:name`
4. 认准作者为 `wusimpl` 的插件
5. 点击"安装"按钮
6. 重启 IDE

### 方式二：手动安装

1. 从 [GitHub Releases](https://github.com/wusimpl/AntigravityQuotaWatcher/releases/latest) 下载最新的 `.vsix` 文件
2. 打开 VS Code / Antigravity IDE
3. 进入扩展视图（Ctrl+Shift+X / Cmd+Shift+X）
4. 点击右上角的 `...` 菜单
5. 选择"从 VSIX 安装..."
6. 选择下载的 `.vsix` 文件
7. 重启 IDE

## 2. 首次启动

### Antigravity IDE 环境

扩展会自动：
1. 检测 Antigravity 语言服务器端口
2. 获取 CSRF Token
3. 开始轮询配额数据（延迟 8 秒启动）
4. 在状态栏显示配额信息

**如果检测失败**:
- 确保 Antigravity 语言服务器正在运行
- 使用命令 `Antigravity Quota Watcher: Re-detect Port` 手动重试
- 查看输出面板的日志（选择 "Antigravity Quota Watcher"）

### 非 Antigravity IDE 环境

扩展会提示切换到 GOOGLE_API 方法：

1. 点击"切换到 Google API"按钮
2. 或手动在设置中将 `apiMethod` 改为 `GOOGLE_API`
3. 使用命令 `Antigravity Quota Watcher: Login with Google` 登录
4. 在浏览器中完成 Google OAuth 授权
5. 返回 IDE，扩展开始获取配额

## 3. 基础配置

### 必需配置

无需任何配置即可使用，扩展会自动检测环境并选择合适的 API 方法。

### 推荐配置

打开设置（Ctrl+, / Cmd+,），搜索 `antigravityQuotaWatcher`：

1. **轮询间隔** (`pollingInterval`): 默认 60 秒，可根据需要调整
2. **显示风格** (`displayStyle`): 选择喜欢的显示模式（百分比/进度条/圆点）
3. **语言** (`language`): 选择界面语言（自动/中文/英文）

## 4. 验证安装

### 检查状态栏

安装成功后，VS Code 底部状态栏右侧应显示配额信息，例如：
```
🟢 Claude: 85%  🟢 G Pro: 90%
```

### 打开 Dashboard

1. 按 Ctrl+Shift+P / Cmd+Shift+P 打开命令面板
2. 输入 `Antigravity Quota Watcher: Open Dashboard`
3. 查看详细的配额信息和连接状态

### 查看日志

如果遇到问题，查看日志：
1. 打开输出面板（View → Output）
2. 在下拉菜单中选择 "Antigravity Quota Watcher"
3. 查看详细的运行日志

## 5. 常见安装问题

### 状态栏显示"检测中"一直不变

**原因**: 端口检测失败

**解决方案**:
1. 确保 Antigravity 语言服务器正在运行
2. Linux 用户：安装 `lsof`、`netstat` 或 `ss` 命令
3. 使用命令 `Antigravity Quota Watcher: Re-detect Port` 重试
4. 或切换到 GOOGLE_API 方法

### 状态栏显示"未登录"

**原因**: 使用 GOOGLE_API 方法但未登录

**解决方案**:
1. 使用命令 `Antigravity Quota Watcher: Login with Google`
2. 或点击状态栏的"未登录"文本
3. 在浏览器中完成 Google 授权

### Windows 端口检测错误

**原因**: PowerShell 版本或权限问题

**解决方案**:
1. 在设置中切换 `forcePowerShell` 选项
2. 或以管理员身份运行 IDE
3. 或切换到 GOOGLE_API 方法

## 6. 下一步

- 阅读 [API Method Selection](./api-method-selection.md) 了解如何选择合适的 API 方法
- 阅读 [Configuration Options](../reference/configuration-options.md) 了解所有配置项
- 遇到问题？查看 [Troubleshooting](./troubleshooting.md)
