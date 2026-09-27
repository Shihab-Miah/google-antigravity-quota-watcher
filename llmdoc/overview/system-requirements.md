# System Requirements

## 1. Identity

- **What it is:** Antigravity Quota Watcher 的系统要求和兼容性说明。
- **Purpose:** 帮助用户确认其环境是否满足扩展运行条件。

## 2. Platform Support

### Supported Platforms

- ✅ **Windows (amd64)**: 完全支持
- ✅ **macOS**: 完全支持
- ✅ **Linux**: 完全支持
- ❌ **Windows (arm64)**: 不支持

### VS Code Version

- **最低版本**: VS Code ^1.85.0
- **推荐版本**: 最新稳定版

## 3. IDE Compatibility

### Antigravity IDE
- **完全支持**: 所有功能可用
- **推荐 API 方法**: GET_USER_STATUS（本地检测）
- **自动检测**: 无需手动配置

### Antigravity Fork 版本
- **WindSurf**: 支持（需使用 GOOGLE_API 方法）
- **Kiro**: 支持（需使用 GOOGLE_API 方法）
- **VS Code**: 支持（需使用 GOOGLE_API 方法）
- **其他 Fork**: 理论支持，需使用 GOOGLE_API 方法

## 4. API Method Requirements

### GET_USER_STATUS (本地检测)

**前置条件**:
- Antigravity 语言服务器必须正在运行
- 系统支持以下命令之一：
  - **Windows**: `netstat` 或 PowerShell
  - **Linux**: `lsof`、`netstat` 或 `ss`
  - **macOS**: `lsof` 或 `netstat`

**限制**:
- 仅适用于 Antigravity IDE 环境
- 不支持远程 SSH 项目

### GOOGLE_API (远程检测)

**前置条件**:
- 有效的 Google 账号
- 网络连接（可访问 Google API）
- 浏览器（用于 OAuth 登录）

**优势**:
- 支持所有 IDE 环境
- 支持远程 SSH 项目
- 无需本地 Antigravity 服务器

## 5. Network Requirements

### 本地 API (GET_USER_STATUS)
- **端口**: 自动检测（通常为 42100-42200 范围）
- **协议**: HTTPS (主) / HTTP (备用)
- **目标**: localhost (127.0.0.1)

### Google API (GOOGLE_API)
- **端点**:
  - `https://accounts.google.com` (OAuth)
  - `https://oauth2.googleapis.com` (Token)
  - `https://cloudcode-pa.clients6.google.com` (Cloud Code API)
  - `https://daily-cloudcode-pa.sandbox.googleapis.com` (Antigravity API)
- **协议**: HTTPS
- **代理**: 支持 HTTP/HTTPS 代理

## 6. Linux Specific Requirements

Linux 系统必须安装以下命令之一用于端口检测：

- **lsof**: 推荐，最可靠
  ```bash
  # Debian/Ubuntu
  sudo apt-get install lsof

  # RHEL/CentOS
  sudo yum install lsof
  ```

- **netstat**: 备选方案
  ```bash
  # Debian/Ubuntu
  sudo apt-get install net-tools

  # RHEL/CentOS
  sudo yum install net-tools
  ```

- **ss**: 现代替代方案（通常已预装）
  ```bash
  # 通常包含在 iproute2 包中
  sudo apt-get install iproute2
  ```

## 7. Optional Dependencies

### 本地 Token 导入功能
- **sql.js**: 已内置，用于读取 Antigravity 本地数据库
- **Antigravity 数据库**: 位于用户配置目录
  - Windows: `%APPDATA%\Antigravity\User\globalStorage\state.vscdb`
  - macOS: `~/Library/Application Support/Antigravity/User/globalStorage/state.vscdb`
  - Linux: `~/.config/Antigravity/User/globalStorage/state.vscdb`

### 代理功能
- **https-proxy-agent**: 已内置
- **环境变量**: `HTTPS_PROXY` 或 `HTTP_PROXY`（可选）
