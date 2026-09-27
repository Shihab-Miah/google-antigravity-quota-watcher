# Proxy Configuration Guide

配置代理以访问 Google API 的完整指南。

## 1. 代理支持概述

扩展支持三种代理配置方式：

1. **自动继承 VS Code 代理**（推荐）
2. **环境变量代理**
3. **手动配置代理**

## 2. 自动继承 VS Code 代理（推荐）

### 工作原理

扩展默认会继承 VS Code 的代理设置（`http.proxy` 和 `http.proxySupport`）。

### VS Code 代理设置

打开设置（Ctrl+, / Cmd+,），搜索 `http.proxy`：

| 设置项 | 说明 |
|--------|------|
| `http.proxySupport` | 代理支持模式 |
| `http.proxy` | 代理服务器地址 |

#### http.proxySupport 选项

- **`override`** (推荐): 自动使用操作系统的代理设置
- **`on`**: 使用 `http.proxy` 中手动配置的代理
- **`fallback`**: 先尝试直连，失败后使用代理
- **`off`**: 完全不使用代理

### 推荐配置

```json
{
  "http.proxySupport": "override",
  "http.proxy": ""  // 留空，自动检测系统代理
}
```

### 验证代理生效

1. 打开输出面板（View → Output）
2. 选择 "Antigravity Quota Watcher"
3. 查找日志：
   ```
   [GoogleAPI] doRequest: Using proxy agent
   ```

## 3. 环境变量代理

### 设置环境变量

#### Windows (PowerShell)
```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:HTTP_PROXY = "http://127.0.0.1:7890"
```

#### macOS / Linux (Bash)
```bash
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

### 启用环境变量代理

打开设置，搜索 `antigravityQuotaWatcher.proxy`：

```json
{
  "antigravityQuotaWatcher.proxyEnabled": true,
  "antigravityQuotaWatcher.proxyAutoDetect": true
}
```

### 验证环境变量

在终端中运行：

```bash
# Windows (PowerShell)
echo $env:HTTPS_PROXY

# macOS / Linux
echo $HTTPS_PROXY
```

## 4. 手动配置代理

### 配置步骤

1. 打开设置（Ctrl+, / Cmd+,）
2. 搜索 `antigravityQuotaWatcher.proxy`
3. 配置以下选项：

```json
{
  "antigravityQuotaWatcher.proxyEnabled": true,
  "antigravityQuotaWatcher.proxyAutoDetect": false,
  "antigravityQuotaWatcher.proxyUrl": "http://127.0.0.1:7890"
}
```

### 代理 URL 格式

支持以下格式：

- HTTP 代理: `http://127.0.0.1:7890`
- HTTPS 代理: `https://127.0.0.1:7890`
- 带认证: `http://username:password@127.0.0.1:7890`
- SOCKS5: `socks5://127.0.0.1:1080`

## 5. 代理配置优先级

扩展按以下优先级选择代理：

1. **扩展手动配置** (`proxyEnabled: true` + `proxyUrl`)
2. **扩展环境变量** (`proxyEnabled: true` + `proxyAutoDetect: true`)
3. **VS Code 代理设置** (`http.proxy` + `http.proxySupport`)
4. **直连**（无代理）

## 6. 常见代理软件配置

### Clash

1. 打开 Clash 设置
2. 找到"端口"配置（通常为 7890）
3. 启用"系统代理"或"TUN 模式"

**VS Code 配置**:
```json
{
  "http.proxySupport": "override"  // 自动检测系统代理
}
```

或手动配置：
```json
{
  "antigravityQuotaWatcher.proxyEnabled": true,
  "antigravityQuotaWatcher.proxyUrl": "http://127.0.0.1:7890"
}
```

### V2Ray / V2RayN

1. 打开 V2Ray 设置
2. 找到"本地监听端口"（通常为 10808）
3. 启用"系统代理"

**VS Code 配置**:
```json
{
  "http.proxySupport": "override"
}
```

或手动配置：
```json
{
  "antigravityQuotaWatcher.proxyEnabled": true,
  "antigravityQuotaWatcher.proxyUrl": "http://127.0.0.1:10808"
}
```

### Proxifier

Proxifier 会全局代理所有应用，无需额外配置。

**VS Code 配置**:
```json
{
  "http.proxySupport": "off"  // Proxifier 已全局代理
}
```

## 7. 代理问题排查

### 问题 1: 代理配置后仍然无法连接

**排查步骤**:

1. 验证代理服务器是否运行：
   ```bash
   curl -x http://127.0.0.1:7890 https://www.google.com
   ```

2. 检查扩展日志：
   - 打开输出面板（View → Output）
   - 选择 "Antigravity Quota Watcher"
   - 查找 "Using proxy agent" 日志

3. 尝试不同的代理配置方式（见上文优先级）

### 问题 2: 代理导致请求超时

**原因**: 代理服务器响应慢或不稳定

**解决方案**:
1. 切换代理节点（选择延迟低的节点）
2. 增加超时时间（扩展默认 30 秒，不可配置）
3. 使用 TUN 模式代替系统代理

### 问题 3: 本地 API (GET_USER_STATUS) 也走代理

**原因**: 代理软件配置不当，代理了本地请求

**解决方案**:
1. 在代理软件中添加本地地址到"直连列表"：
   - `127.0.0.1`
   - `localhost`
2. 或在 VS Code 中配置 `http.proxyStrictSSL: false`

### 问题 4: 环境变量代理不生效

**原因**: VS Code 未读取到环境变量

**解决方案**:
1. 确保在启动 VS Code **之前**设置环境变量
2. 或在 VS Code 终端中设置环境变量后重启扩展
3. 或改用手动配置代理

## 8. 最佳实践

### 推荐配置（Clash / V2Ray 用户）

```json
{
  // VS Code 全局代理设置
  "http.proxySupport": "override",

  // 扩展代理设置（使用默认值即可）
  "antigravityQuotaWatcher.proxyEnabled": false,
  "antigravityQuotaWatcher.proxyAutoDetect": true
}
```

### 推荐配置（Proxifier 用户）

```json
{
  // VS Code 全局代理设置
  "http.proxySupport": "off",

  // 扩展代理设置
  "antigravityQuotaWatcher.proxyEnabled": false
}
```

### 推荐配置（企业代理用户）

```json
{
  // VS Code 全局代理设置
  "http.proxySupport": "on",
  "http.proxy": "http://proxy.company.com:8080",

  // 扩展代理设置
  "antigravityQuotaWatcher.proxyEnabled": false
}
```

## 9. 安全提示

- ✅ 使用 HTTPS 代理（如果代理支持）
- ✅ 不要在代理 URL 中明文存储密码
- ✅ 定期更新代理软件
- ❌ 不要使用不信任的公共代理
- ❌ 不要在代理日志中记录敏感信息
