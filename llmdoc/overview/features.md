# Features

## 1. Identity

- **What it is:** Antigravity Quota Watcher 的核心功能特性列表。
- **Purpose:** 说明扩展提供的主要功能和用户价值。

## 2. Core Features

### 实时配额监控

- **定时轮询**: 默认每 60 秒自动刷新配额数据（可配置）
- **手动刷新**: 点击状态栏立即刷新配额
- **窗口焦点刷新**: 从浏览器切回 VS Code 时自动刷新（仅本地 API 模式）

### 状态栏显示

- **多模型支持**: 同时显示 Claude、Gemini Pro、Gemini Flash 等模型配额
- **三种显示风格**:
  - 百分比模式: `🟢 Claude: 85%`
  - 进度条模式: `🟢 Claude ███████░`
  - 圆点模式: `🟢 Claude ●●●●○`
- **智能状态指示**:
  - 🟢 绿色: 配额充足 (≥50%)
  - 🟡 黄色: 配额中等 (30%-50%)
  - 🔴 红色: 配额不足 (<30%)
  - ⚫ 黑色: 配额耗尽 (0%)

### Dashboard 面板

通过命令 `Antigravity Quota Watcher: Open Dashboard` 打开，提供：

- **配额概览**: 表格形式展示所有模型的剩余配额和重置时间
- **连接状态**: 显示当前 API 模式、端口信息、轮询状态
- **账号信息**: 显示登录账号和订阅计划
- **周限检测**: 检测是否触发周配额限制（会消耗少量配额）
- **快捷操作**: 刷新配额、重新检测端口、登录/登出

### 双 API 模式

#### GET_USER_STATUS (本地检测)
- 自动检测 Antigravity 语言服务器端口
- 读取进程参数获取 CSRF Token
- 通过本地 HTTPS/HTTP 接口获取配额
- 适用于 Antigravity IDE 环境

#### GOOGLE_API (远程检测)
- 通过 Google OAuth 2.0 登录
- 直接调用 Google Cloud Code API
- 支持非 Antigravity IDE 环境（WindSurf、Kiro、VS Code 等）
- 支持远程 SSH 项目

### 认证功能

- **Google 登录**: 标准 OAuth 2.0 流程，支持 PKCE
- **本地 Token 导入**: 自动检测 Antigravity 本地数据库中的 refresh_token 并导入
- **Token 同步检测**: 定期检查本地 Antigravity 登录状态变化
- **自动刷新**: Token 过期前自动刷新，无需重新登录

### 代理支持

- **自动继承**: 默认使用 VS Code 的代理设置
- **环境变量**: 支持读取 `HTTPS_PROXY` / `HTTP_PROXY`
- **手动配置**: 可单独为扩展配置代理 URL

### 国际化

- **自动检测**: 默认跟随 VS Code 语言设置
- **支持语言**: 简体中文、英文
- **可配置**: 可手动切换语言

### 错误处理

- **自动重试**: 请求失败时自动重试 3 次（间隔 5 秒）
- **智能降级**: HTTPS 失败时自动回退到 HTTP
- **端口重探**: 检测到端口失效时自动重新检测
- **过时标记**: 网络问题时标记数据为过时，保留上次配额显示

### 开发者工具

- **日志系统**: 支持 ERROR/WARNING/INFO/DEBUG 四级日志
- **预览命令**: 开发模式下可预览通知、状态栏、Tooltip
- **详细错误信息**: 提供完整的错误堆栈和上下文信息
