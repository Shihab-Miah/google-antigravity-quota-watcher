# Troubleshooting Guide

常见问题的诊断和解决方案。

## 1. 配额不刷新问题

### 症状
- 状态栏一直显示 100%
- 配额数据长时间不更新

### 可能原因
1. **官方接口机制变更**（已知问题）
2. 代理节点地区限制
3. 网络连接问题

### 解决方案

#### 方案 1: 切换代理节点
```
当前已知：配额递减规律为 20% 更新一次（100% → 80% → 60%...）
```
1. 切换到美国地区的代理节点（可能已失效）
2. 等待配额实际消耗到下一个 20% 阈值

#### 方案 2: 切换 API 方法
1. 尝试从 GET_USER_STATUS 切换到 GOOGLE_API
2. 或反向切换
3. 观察是否有改善

#### 方案 3: 手动刷新
1. 点击状态栏立即刷新
2. 或使用命令 `Antigravity Quota Watcher: Refresh Quota`

## 2. 端口检测失败

### 症状
- 状态栏显示"检测中"或"端口检测失败"
- 日志显示 "Failed to get port and CSRF Token"

### 可能原因
1. Antigravity 语言服务器未运行
2. 系统缺少端口检测命令
3. 权限不足

### 解决方案

#### Linux 用户
安装必需的端口检测工具：

```bash
# Debian/Ubuntu
sudo apt-get install lsof

# RHEL/CentOS
sudo yum install lsof

# 或安装 net-tools
sudo apt-get install net-tools
```

#### Windows 用户
1. 在设置中切换 `forcePowerShell` 选项
2. 或以管理员身份运行 VS Code
3. 或切换到 GOOGLE_API 方法

#### 通用方案
1. 确保 Antigravity 语言服务器正在运行
2. 重启 IDE
3. 使用命令 `Antigravity Quota Watcher: Re-detect Port` 重试

## 3. Google 登录失败

### 症状
- 浏览器授权后显示"回调失败"
- 状态栏显示"登录失败"

### 可能原因
1. 防火墙阻止本地回调服务器
2. 网络连接问题
3. Token 请求失败

### 解决方案

#### 检查防火墙
1. 临时关闭防火墙测试
2. 或添加 VS Code 到防火墙白名单
3. 允许端口 3000-3100 的入站连接

#### 检查网络连接
```bash
# 测试 Google API 连接
curl https://accounts.google.com
curl https://oauth2.googleapis.com
```

#### 配置代理
如果在国内网络环境，需要配置代理：
- 参考 [Proxy Configuration Guide](./proxy-configuration.md)

#### 重试登录
1. 使用命令 `Antigravity Quota Watcher: Logout from Google`
2. 再次使用命令 `Antigravity Quota Watcher: Login with Google`

## 4. 代理配置问题

### 症状
- 配置代理后仍然无法连接
- 请求超时

### 解决方案

参考 [Proxy Configuration Guide](./proxy-configuration.md) 的"代理问题排查"章节。

## 5. Token 过期问题

### 症状
- 状态栏显示"登录已过期"
- 日志显示 "Token expired" 或 "invalid_grant"

### 解决方案

#### 自动刷新失败
1. 检查网络连接
2. 检查代理配置
3. 手动重新登录：
   - 使用命令 `Antigravity Quota Watcher: Login with Google`

#### Refresh Token 失效
如果长期未使用（通常 6 个月），Refresh Token 会失效：
1. 使用命令 `Antigravity Quota Watcher: Logout from Google`
2. 重新登录获取新的 Token

## 6. 状态栏不显示

### 症状
- 状态栏没有配额信息
- 扩展似乎没有运行

### 解决方案

#### 检查扩展是否启用
1. 打开扩展视图（Ctrl+Shift+X / Cmd+Shift+X）
2. 搜索 "Antigravity Quota Watcher"
3. 确保扩展已启用

#### 检查配置
1. 打开设置（Ctrl+, / Cmd+,）
2. 搜索 `antigravityQuotaWatcher.enabled`
3. 确保设置为 `true`

#### 查看日志
1. 打开输出面板（View → Output）
2. 选择 "Antigravity Quota Watcher"
3. 查找错误信息

## 7. 数据过时警告

### 症状
- 状态栏显示 "⚠️" 图标
- Tooltip 显示"数据可能已过时"

### 可能原因
- 网络连接不稳定
- API 请求超时
- 代理问题

### 解决方案

#### 临时解决
1. 点击状态栏手动刷新
2. 等待网络恢复

#### 长期解决
1. 检查网络连接稳定性
2. 优化代理配置（选择延迟低的节点）
3. 增加轮询间隔（减少请求频率）

## 8. 周限检测失败

### 症状
- Dashboard 中周限检测显示错误
- 提示"检测失败"

### 可能原因
1. 未登录 Google 账号
2. 网络连接问题
3. API 限流

### 解决方案

#### 确保已登录
1. 使用 GOOGLE_API 方法
2. 确保已通过 Google 登录

#### 避免频繁检测
周限检测会发送测试请求，建议：
- 不要频繁点击检测按钮
- 仅在怀疑触发周限时使用

## 9. 性能问题

### 症状
- VS Code 响应变慢
- CPU 占用高

### 解决方案

#### 增加轮询间隔
```json
{
  "antigravityQuotaWatcher.pollingInterval": 120  // 改为 2 分钟
}
```

#### 降低日志级别
```json
{
  "antigravityQuotaWatcher.logLevel": "WARNING"  // 只记录警告和错误
}
```

#### 禁用不需要的功能
```json
{
  "antigravityQuotaWatcher.showGeminiPro": false,
  "antigravityQuotaWatcher.showGeminiFlash": false
}
```

## 10. 获取诊断信息

### 导出日志

1. 打开输出面板（View → Output）
2. 选择 "Antigravity Quota Watcher"
3. 右键 → "Copy All"
4. 粘贴到文本文件保存

### 查看扩展版本

1. 打开扩展视图（Ctrl+Shift+X / Cmd+Shift+X）
2. 搜索 "Antigravity Quota Watcher"
3. 查看版本号

### 查看系统信息

在输出面板中查找：
```
=== Antigravity Quota Watcher v1.0.2 ===
Running on: Antigravity v1.11.3
```

## 11. 提交 Issue

如果以上方案都无法解决问题，请提交 Issue：

### 准备信息

1. **系统信息**:
   - 操作系统和版本
   - IDE 名称和版本
   - 扩展版本

2. **问题描述**:
   - 详细描述问题现象
   - 复现步骤
   - 预期行为 vs 实际行为

3. **日志文件**:
   - 导出完整日志（见上文）
   - 截图（如果有）

### 提交地址

GitHub Issues: https://github.com/wusimpl/AntigravityQuotaWatcher/issues

### 注意事项

- ❌ 不要在 Issue 中包含 Token 或密码
- ❌ 不要包含个人敏感信息
- ✅ 提供尽可能详细的日志
- ✅ 说明已尝试的解决方案
