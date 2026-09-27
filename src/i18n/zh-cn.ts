import { TranslationMap } from './types';

export const zh_cn: TranslationMap = {
    // 状态栏
    'status.initializing': '⏳ 初始化中...',
    'status.detecting': '🔍 检测端口中...',
    'status.fetching': '$(sync~spin) 获取配额中...',
    'status.retrying': '$(sync~spin) 重试中 ({current}/{max})...',
    'status.error': '$(error) Antigravity Quota Watcher: 错误',
    'status.refreshing': '$(sync~spin) 刷新中...',
    'status.notLoggedIn': '$(account) 未登录，点击登录',
    'status.loggingIn': '$(sync~spin) 登录中...',
    'status.loginExpired': '$(warning) 登录已过期，点击重新登录',
    'status.stale': '$(circle-slash)',

    // hover 提示框
    'tooltip.title': '**Antigravity 模型配额**',
    'tooltip.credits': '💳 提示词额度',
    'tooltip.available': '可用',
    'tooltip.remaining': '剩余',
    'tooltip.depleted': '⚠️ **已耗尽**',
    'tooltip.resetTime': '重置时间',
    'tooltip.model': '模型',
    'tooltip.status': '剩余',
    'tooltip.error': '获取配额信息时出错。',
    'tooltip.clickToRetry': '点击重试',
    'tooltip.clickToLogin': '点击登录 Google 账号',
    'tooltip.clickToRelogin': '登录已过期，点击重新登录',
    'tooltip.staleWarning': '⚠️ 数据已过时（网络问题或请求超时）',

    // 通知弹窗 (vscode.window.show*Message)
    'notify.unableToDetectProcess': 'Antigravity Quota Watcher: 无法检测到 Antigravity 进程。',
    'notify.retry': '重试',
    'notify.cancel': '取消',
    'notify.refreshingQuota': '🔄 正在刷新配额...',
    'notify.detectionSuccess': '✅ 检测成功！端口: {port}',
    'notify.unableToDetectPort': '❌ 无法检测到有效端口。请确保：',
    'notify.unableToDetectPortHint1': '1. 已在Antigravity登录 Google 账户 2. Antigravity为运行状态',
    'notify.unableToDetectPortHint2': '3. 系统有权限运行检测命令 4. 科学上网连接正常',
    'notify.portDetectionFailed': '❌ 端口检测失败: {error}',
    'notify.configUpdated': 'Antigravity Quota Watcher 配置已更新',
    'notify.nonAntigravityDetected': '检测到非 Antigravity 环境，推荐使用 Google API 方式获取配额。',
    'notify.switchToGoogleApi': '切换',
    'notify.keepLocalApi': '不切换',
    'notify.neverShowAgain': '不再提示',
    'notify.portCommandRequired': '端口检测需要 lsof、ss 或 netstat。请安装其中之一',
    'notify.portCommandRequiredDarwin': '端口检测需要 lsof 或 netstat。请安装其中之一',
    'notify.googleApiNoPortDetection': 'Google API 方法不需要端口检测。请使用 Google 登录功能。',
    'notify.pleaseLoginFirst': '请先登录 Google 账号',

    // 登录错误
    'login.error.serviceNotInitialized': '认证服务尚未初始化',
    'login.error.authFailed': '认证失败',

    // 本地 Token 检测
    'notify.localTokenDetected': '检测到本地 Antigravity 已登录，是否使用该账号？',
    'notify.useLocalToken': '使用本地 Token 登录',
    'notify.manualLogin': '手动登录',

    // Token 同步检查
    'notify.tokenChanged': '检测到 Antigravity 账号已变更，是否同步？',
    'notify.tokenRemoved': '检测到 Antigravity 已退出登录，是否同步退出？',
    'notify.syncToken': '同步',
    'notify.keepCurrentToken': '保持当前',
    'notify.syncLogout': '同步退出',
    'notify.keepLogin': '保持登录',

    // 登录成功/错误消息
    'login.success.google': 'Google 账号登录成功！',
    'login.success.localToken': '已使用本地 Antigravity 账号登录成功！',
    'login.error.google': 'Google 登录失败: {error}',
    'login.error.localToken': '使用本地 Token 登录失败: {error}',
    'login.error.localTokenImport': '未检测到本地 Antigravity 登录状态，请点击右下角状态栏进行手动登录。',
    'logout.success': '已登出 Google 账号',

    // 开发工具
    'devTools.previewComplete': '✅ 通知预览完成',
    'devTools.stop': '停止',

    // 仪表盘
    'dashboard.title': 'Antigravity Quota Watcher 面板',
    'dashboard.comingSoon': '更多功能即将推出...',
    'dashboard.comingSoonHint': '此面板将显示 Project ID、周限检测等功能。',
    'dashboard.apiMode': 'API 模式与账号',
    'dashboard.currentMethod': '当前配额获取方式',
    'dashboard.account': '账号',
    'dashboard.plan': '计划',
    'dashboard.localConnection': '本地连接',
    'dashboard.googleConnection': 'Google 连接',
    'dashboard.loginStatus': '登录状态',
    'dashboard.dataSource': '数据来源',
    'dashboard.pollingStatus': '轮询状态',
    'dashboard.interval': '间隔',
    'dashboard.lastUpdate': '最后更新',
    'dashboard.lastError': '最近错误',
    'dashboard.quickActions': '快捷操作',
    'dashboard.refresh': '刷新配额',
    'dashboard.detectPort': '检测端口',
    'dashboard.loginOAuth': 'OAuth登录',
    'dashboard.loginLocalToken': '本地Token登录',
    'dashboard.logout': '登出',
    'dashboard.settings': '修改配置',
    'dashboard.refreshPanel': '刷新面板',
    'dashboard.quotaOverview': '配额概览',
    'dashboard.weeklyLimit': '周限检测',
    'dashboard.weeklyLimitWarning': '周限检测功能需要消耗少量额度，请勿频繁使用',
    'dashboard.starBannerText': '如果觉得本项目有帮助，请给个 Star 支持一下！',

    // 周限检测
    'weeklyLimit.checking': '正在检测 {model} 的周限状态...',
    'weeklyLimit.ok': '✅ {pool} 池: 配额正常',
    'weeklyLimit.rateLimited': '🟡 {pool} 池: 已触发小时频率限制，{hours}小时{minutes}分钟后重置额度',
    'weeklyLimit.weeklyLimited': '🔴 {pool} 池: 已触发周限！{days}天{hours}小时{minutes}分钟后重置',
    'weeklyLimit.capacityExhausted': '⚠️ 模型 {model} 服务器过载，请稍后重试',
    'weeklyLimit.error': '❌ 检测失败: {error}',
    'weeklyLimit.notLoggedIn': '请先登录 Google 账号以检测周限',

    // 代理设置
    'proxy.title': '代理设置',
    'proxy.enabled': '启用代理',
    'proxy.autoDetect': '自动检测系统代理',
    'proxy.url': '代理 URL',
    'proxy.urlPlaceholder': '例如: http://127.0.0.1:7890',
    'proxy.testConnection': '测试连接',
    'proxy.testing': '测试中...',
    'proxy.testSuccess': '代理连接成功',
    'proxy.testFailed': '代理连接失败',
    'proxy.detectedUrl': '检测到系统代理',
    'proxy.noSystemProxy': '未检测到系统代理',
    'proxy.save': '保存',
    'proxy.currentStatus': '当前状态',
    'proxy.statusEnabled': '已启用',
    'proxy.statusDisabled': '已禁用'
};
