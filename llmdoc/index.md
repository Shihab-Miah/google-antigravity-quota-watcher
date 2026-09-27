# Antigravity Quota Watcher - LLM Documentation Index

## 项目概述

Antigravity Quota Watcher 是一个 VS Code 扩展，用于实时监控 Antigravity AI 模型的配额使用情况。

**版本**: 1.0.2
**发布者**: wusimpl
**许可证**: MIT

## 文档结构

### 1. Overview (概览)
- [project-overview.md](./overview/project-overview.md) - 项目整体介绍
- [features.md](./overview/features.md) - 核心功能特性
- [system-requirements.md](./overview/system-requirements.md) - 系统要求和兼容性

### 2. Guides (指南)
- [installation-guide.md](./guides/installation-guide.md) - 安装和配置指南
- [api-method-selection.md](./guides/api-method-selection.md) - API 方法选择指南
- [google-login-guide.md](./guides/google-login-guide.md) - Google 登录配置
- [proxy-configuration.md](./guides/proxy-configuration.md) - 代理设置指南
- [troubleshooting.md](./guides/troubleshooting.md) - 常见问题排查

### 3. Architecture (架构)
- [extension-lifecycle.md](./architecture/extension-lifecycle.md) - 扩展生命周期
- [quota-service-architecture.md](./architecture/quota-service-architecture.md) - 配额服务架构
- [authentication-flow.md](./architecture/authentication-flow.md) - 认证流程
- [api-clients.md](./architecture/api-clients.md) - API 客户端设计
- [port-detection.md](./architecture/port-detection.md) - 端口检测机制
- [status-bar-system.md](./architecture/status-bar-system.md) - 状态栏显示系统

### 4. Reference (参考)
- [configuration-options.md](./reference/configuration-options.md) - 配置项完整说明
- [commands.md](./reference/commands.md) - 命令列表
- [type-definitions.md](./reference/type-definitions.md) - 类型定义
- [api-endpoints.md](./reference/api-endpoints.md) - API 端点说明

## 快速导航

### 我想了解...
- **项目是什么？** → [project-overview.md](./overview/project-overview.md)
- **如何安装？** → [installation-guide.md](./guides/installation-guide.md)
- **如何选择 API 方法？** → [api-method-selection.md](./guides/api-method-selection.md)
- **系统如何工作？** → [extension-lifecycle.md](./architecture/extension-lifecycle.md)
- **配置项有哪些？** → [configuration-options.md](./reference/configuration-options.md)

### 我遇到了问题...
- **配额不刷新** → [troubleshooting.md](./guides/troubleshooting.md)
- **端口检测失败** → [port-detection.md](./architecture/port-detection.md)
- **Google 登录失败** → [google-login-guide.md](./guides/google-login-guide.md)
- **代理配置问题** → [proxy-configuration.md](./guides/proxy-configuration.md)

## 关键概念

- **API 方法**: 两种获取配额的方式 (GET_USER_STATUS 本地检测 / GOOGLE_API 远程检测)
- **端口检测**: 自动检测 Antigravity 语言服务器的端口和 CSRF Token
- **配额轮询**: 定时获取模型配额并更新状态栏显示
- **认证管理**: Google OAuth 2.0 认证和 Token 管理
- **状态栏**: 实时显示配额状态的 UI 组件

## 开发者注意事项

本项目为非官方工具，依赖于 Antigravity 语言服务器的内部实现细节，相关机制可能随时变动。

**主要依赖**:
- VS Code Extension API (^1.85.0)
- Node.js HTTPS 模块
- sql.js (用于读取 Antigravity 本地数据库)
- https-proxy-agent (代理支持)
