export type TranslationKey =
    // Status Bar
    | 'status.initializing'
    | 'status.detecting'
    | 'status.fetching'
    | 'status.retrying'
    | 'status.error'
    | 'status.refreshing'
    | 'status.notLoggedIn'
    | 'status.loggingIn'
    | 'status.loginExpired'
    | 'status.stale'

    // Tooltip
    | 'tooltip.title'
    | 'tooltip.credits'
    | 'tooltip.available'
    | 'tooltip.remaining'
    | 'tooltip.depleted'
    | 'tooltip.resetTime'
    | 'tooltip.model'
    | 'tooltip.status'
    | 'tooltip.error'
    | 'tooltip.clickToRetry'
    | 'tooltip.clickToLogin'
    | 'tooltip.clickToRelogin'
    | 'tooltip.staleWarning'

    // Notifications (vscode.window.show*Message)
    | 'notify.unableToDetectProcess'
    | 'notify.retry'
    | 'notify.cancel'
    | 'notify.refreshingQuota'
    | 'notify.detectionSuccess'
    | 'notify.unableToDetectPort'
    | 'notify.unableToDetectPortHint1'
    | 'notify.unableToDetectPortHint2'
    | 'notify.portDetectionFailed'
    | 'notify.configUpdated'
    | 'notify.nonAntigravityDetected'
    | 'notify.switchToGoogleApi'
    | 'notify.keepLocalApi'
    | 'notify.neverShowAgain'
    | 'notify.portCommandRequired'
    | 'notify.portCommandRequiredDarwin'
    | 'notify.googleApiNoPortDetection'
    | 'notify.pleaseLoginFirst'

    // Login errors
    | 'login.error.serviceNotInitialized'
    | 'login.error.authFailed'

    // Local Token detection
    | 'notify.localTokenDetected'
    | 'notify.useLocalToken'
    | 'notify.manualLogin'

    // Token sync check
    | 'notify.tokenChanged'
    | 'notify.tokenRemoved'
    | 'notify.syncToken'
    | 'notify.keepCurrentToken'
    | 'notify.syncLogout'
    | 'notify.keepLogin'

    // Login success/error messages
    | 'login.success.google'
    | 'login.success.localToken'
    | 'login.error.google'
    | 'login.error.localToken'
    | 'login.error.localTokenImport'
    | 'logout.success'

    // Dev tools
    | 'devTools.previewComplete'
    | 'devTools.stop'

    // Dashboard
    | 'dashboard.title'
    | 'dashboard.comingSoon'
    | 'dashboard.comingSoonHint'
    | 'dashboard.apiMode'
    | 'dashboard.currentMethod'
    | 'dashboard.account'
    | 'dashboard.plan'
    | 'dashboard.localConnection'
    | 'dashboard.googleConnection'
    | 'dashboard.loginStatus'
    | 'dashboard.dataSource'
    | 'dashboard.pollingStatus'
    | 'dashboard.interval'
    | 'dashboard.lastUpdate'
    | 'dashboard.lastError'
    | 'dashboard.quickActions'
    | 'dashboard.refresh'
    | 'dashboard.detectPort'
    | 'dashboard.loginOAuth'
    | 'dashboard.loginLocalToken'
    | 'dashboard.logout'
    | 'dashboard.settings'
    | 'dashboard.refreshPanel'
    | 'dashboard.quotaOverview'
    | 'dashboard.weeklyLimit'
    | 'dashboard.weeklyLimitWarning'
    | 'dashboard.starBannerText'

    // Weekly Limit Check
    | 'weeklyLimit.checking'
    | 'weeklyLimit.ok'
    | 'weeklyLimit.rateLimited'
    | 'weeklyLimit.weeklyLimited'
    | 'weeklyLimit.capacityExhausted'
    | 'weeklyLimit.error'
    | 'weeklyLimit.notLoggedIn';

export interface TranslationMap {
    [key: string]: string;
}
