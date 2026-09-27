# Project Overview

## 1. Identity

- **What it is:** 一个 VS Code 扩展，用于实时监控 Antigravity AI 模型的配额使用情况并在状态栏显示。
- **Purpose:** 帮助开发者实时了解 AI 模型配额剩余情况，避免因配额耗尽而中断工作流程。

## 2. High-Level Description

Antigravity Quota Watcher 是一个轻量级的 VS Code 扩展，专为使用 Antigravity AI 服务的开发者设计。它通过两种方式获取配额信息：

1. **本地检测 (GET_USER_STATUS)**: 自动检测本地运行的 Antigravity 语言服务器，通过内部 API 获取配额
2. **远程检测 (GOOGLE_API)**: 通过 Google Cloud Code API 直接获取配额，支持非 Antigravity IDE 环境

扩展在 VS Code 底部状态栏实时显示各模型的配额剩余百分比，并提供以下核心能力：

- **自动检测**: 无需手动配置，自动检测 Antigravity 服务端口和认证信息
- **智能预警**: 配额不足时通过颜色变化提醒（绿色/黄色/红色/黑色）
- **多种显示模式**: 支持百分比、进度条、圆点三种显示风格
- **Dashboard 面板**: 提供详细的配额概览、连接状态、周限检测等功能
- **国际化支持**: 支持中英文界面

### 主要交互组件

- **StatusBarService**: 状态栏显示和用户交互入口
- **QuotaService**: 配额数据获取和轮询管理
- **PortDetectionService**: 本地端口和 CSRF Token 检测
- **GoogleAuthService**: Google OAuth 认证管理
- **WebviewPanelService**: Dashboard 面板渲染

### 技术特点

- 支持 Windows、macOS、Linux 平台（Windows ARM64 除外）
- 兼容 Antigravity 及其 Fork 版本（WindSurf、Kiro、VS Code 等）
- 代理支持：自动继承 VS Code 代理设置或手动配置
- 本地 Token 同步：自动检测 Antigravity 本地登录状态并导入凭证
