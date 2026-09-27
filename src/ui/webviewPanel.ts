/**
 * WebView Panel - Dashboard for quota monitoring and quick actions
 */

import * as vscode from 'vscode';
import { LocalizationService } from '../i18n/localizationService';
import { logger } from '../logger';
import { QuotaSnapshot } from '../types';
import { QuotaApiMethod } from '../quota/quotaService';
import { ProxyService } from '../proxy/proxyService';

/** Dashboard 状态数据 */
export interface DashboardState {
    apiMethod: QuotaApiMethod;
    quotaSnapshot?: QuotaSnapshot;
    // 本地 API 特有
    connectPort?: number;
    httpPort?: number;
    csrfToken?: string;
    // Google API 特有
    projectId?: string;
    // 通用
    pollingInterval?: number;
    isPolling?: boolean;
    lastError?: string;
    isLoggedIn?: boolean;
}

export class WebviewPanelService {
    public static currentPanel: WebviewPanelService | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];
    private state: DashboardState = { apiMethod: QuotaApiMethod.GET_USER_STATUS };

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        this.updateContent();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            (message) => this.handleMessage(message),
            null,
            this.disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri): WebviewPanelService {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (WebviewPanelService.currentPanel) {
            WebviewPanelService.currentPanel.panel.reveal(column);
            return WebviewPanelService.currentPanel;
        }

        const localizationService = LocalizationService.getInstance();
        const panel = vscode.window.createWebviewPanel(
            'antigravityDashboard',
            localizationService.t('dashboard.title'),
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        WebviewPanelService.currentPanel = new WebviewPanelService(panel, extensionUri);
        logger.info('WebviewPanel', 'Dashboard panel created');
        return WebviewPanelService.currentPanel;
    }

    /** 更新 Dashboard 状态并刷新视图 */
    public updateState(partialState: Partial<DashboardState>): void {
        this.state = { ...this.state, ...partialState };
        this.postMessage({ type: 'stateUpdate', state: this.state });
    }

    private updateContent(): void {
        this.panel.webview.html = this.getHtmlContent();
    }

    private handleMessage(message: any): void {
        logger.debug('WebviewPanel', 'Received message:', message);

        switch (message.command) {
            case 'refreshQuota':
                vscode.commands.executeCommand('antigravity-quota-watcher.quickRefreshQuota');
                break;
            case 'detectPort':
                vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
                break;
            case 'login':
                vscode.commands.executeCommand('antigravity-quota-watcher.googleLogin');
                break;
            case 'loginLocalToken':
                vscode.commands.executeCommand('antigravity-quota-watcher.loginLocalToken');
                break;
            case 'logout':
                vscode.commands.executeCommand('antigravity-quota-watcher.googleLogout');
                break;
            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'antigravityQuotaWatcher');
                break;
            case 'refreshPanel':
                this.updateContent();
                this.postMessage({ type: 'stateUpdate', state: this.state });
                break;
            case 'checkWeeklyLimit':
                // 周限检测，传递模型名称
                vscode.commands.executeCommand('antigravity-quota-watcher.checkWeeklyLimit', message.model);
                break;
            case 'ready':
                // Webview 加载完成，发送当前状态
                this.postMessage({ type: 'stateUpdate', state: this.state });
                break;
            case 'testProxy':
                // 测试代理连接
                this.handleTestProxy();
                break;
            case 'detectSystemProxy':
                // 检测系统代理
                this.handleDetectSystemProxy();
                break;
            default:
                logger.warn('WebviewPanel', 'Unknown message command:', message.command);
        }
    }

    private async handleTestProxy(): Promise<void> {
        const proxyService = ProxyService.getInstance();
        const result = await proxyService.testProxyConnection();
        this.postMessage({
            type: 'proxyTestResult',
            success: result.success,
            message: result.message
        });
    }

    private handleDetectSystemProxy(): void {
        const proxyService = ProxyService.getInstance();
        const detectedUrl = proxyService.detectSystemProxy();
        this.postMessage({
            type: 'systemProxyDetected',
            url: detectedUrl || null
        });
    }

    private getHtmlContent(): string {
        const localizationService = LocalizationService.getInstance();
        const nonce = this.getNonce();
        const t = (key: string) => localizationService.t(key as any);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>${t('dashboard.title')}</title>
    <style>
        :root {
            --vscode-font-family: var(--vscode-editor-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            font-size: 13px;
        }
        .container { max-width: 700px; margin: 0 auto; }
        .header {
            display: flex; align-items: center; gap: 10px;
            margin-bottom: 20px; padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-widget-border, #454545);
        }
        .header-title { font-size: 18px; font-weight: 600; }

        .section-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 14px;
            margin-bottom: 14px;
        }
        .section-row > .section {
            min-width: 0; margin-bottom: 0 !important;
        }
        .section-row > .section.hidden {
            display: none !important;
        }
        .section {
            background: var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.04));
            border: 1px solid var(--vscode-widget-border, #454545);
            border-radius: 6px; padding: 14px; margin-bottom: 14px;
        }
        .section-title {
            font-size: 13px; font-weight: 600; margin-bottom: 10px;
            color: var(--vscode-foreground);
            display: flex; align-items: center; gap: 6px;
        }
        .info-row {
            display: flex; justify-content: space-between; padding: 4px 0;
            border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.1));
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: var(--vscode-descriptionForeground); }
        .info-value { font-family: monospace; color: var(--vscode-foreground); }
        .info-value.masked { letter-spacing: 1px; }

        .actions {
            display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;
        }
        .btn {
            padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer;
            font-size: 12px; display: inline-flex; align-items: center; gap: 4px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            transition: opacity 0.15s;
        }
        .btn:hover { opacity: 0.85; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .badge {
            display: inline-block; padding: 2px 6px; border-radius: 3px;
            font-size: 11px; font-weight: 500;
        }
        .badge-google { background: #4285f4; color: #fff; }
        .badge-local { background: #34a853; color: #fff; }
        .badge-warning { background: var(--vscode-inputValidation-warningBackground, #5c4813); }
        .badge-error { background: var(--vscode-inputValidation-errorBackground, #5a1d1d); }

        .empty-state {
            text-align: center; padding: 30px; color: var(--vscode-descriptionForeground);
        }
        .hidden { display: none !important; }

        .quota-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .quota-table th, .quota-table td {
            text-align: left; padding: 6px 8px;
            border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.1));
        }
        .quota-table th { font-weight: 600; font-size: 11px; text-transform: uppercase; color: var(--vscode-descriptionForeground); }
        .progress-bar {
            width: 60px; height: 6px; background: #3a3a3a;
            border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle;
        }
        .progress-fill { height: 100%; transition: width 0.3s; }
        .progress-normal { background: #4caf50; }
        .progress-warning { background: #ff9800; }
        .progress-critical { background: #f44336; }
        .progress-depleted { background: #1a1a1a; }
        .progress-bar.depleted { background: #1a1a1a; }

        .btn-check-limit {
            padding: 2px 6px; border: none; border-radius: 3px; cursor: pointer;
            font-size: 11px; background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-check-limit:hover { opacity: 0.85; }
        .btn-check-limit:disabled { opacity: 0.5; cursor: not-allowed; }

        .info-icon {
            display: inline-flex; align-items: center; justify-content: center;
            width: 16px; height: 16px; border-radius: 50%;
            background: var(--vscode-inputValidation-warningBackground, #5c4813);
            color: var(--vscode-inputValidation-warningForeground, #cca700);
            font-size: 11px; font-weight: bold; cursor: help;
            position: relative;
        }
        .info-icon:hover .tooltip {
            visibility: visible; opacity: 1;
        }
        .tooltip {
            visibility: hidden; opacity: 0;
            position: absolute; bottom: 125%; left: 50%;
            transform: translateX(-50%);
            background: var(--vscode-editorWidget-background, #252526);
            color: var(--vscode-editorWidget-foreground, #cccccc);
            border: 1px solid var(--vscode-widget-border, #454545);
            border-radius: 4px; padding: 6px 10px;
            font-size: 12px; font-weight: normal;
            white-space: nowrap; z-index: 100;
            transition: opacity 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .tooltip::after {
            content: '';
            position: absolute; top: 100%; left: 50%;
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: var(--vscode-widget-border, #454545);
        }

        .star-banner {
            background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 165, 0, 0.1) 100%);
            border: 1px solid rgba(255, 215, 0, 0.3);
            border-radius: 6px; padding: 14px; margin-top: 14px;
            text-align: center;
        }
        .star-banner-content {
            display: flex; align-items: center; justify-content: center;
            gap: 8px; flex-wrap: wrap;
        }
        .star-icon { font-size: 18px; }
        .star-text { color: var(--vscode-foreground); font-size: 13px; }
        .star-link {
            color: #ffd700; text-decoration: none; font-weight: 500;
            display: inline-flex; align-items: center; gap: 4px;
            padding: 4px 10px; border-radius: 4px;
            background: rgba(255, 215, 0, 0.15);
            transition: background 0.2s;
        }
        .star-link:hover { background: rgba(255, 215, 0, 0.25); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="header-title">${t('dashboard.title')}</h1>
        </div>

        <!-- 第1、2卡片并排布局 -->
        <div class="section-row">
            <!-- API 模式与账号信息 -->
            <div class="section">
                <div class="section-title">${t('dashboard.apiMode')}</div>
                <div class="info-row">
                    <span class="info-label">${t('dashboard.currentMethod')}</span>
                    <span id="apiMethodBadge" class="badge badge-local">Local API</span>
                </div>
                <div id="accountRow" class="info-row">
                    <span class="info-label">${t('dashboard.account')}</span>
                    <span id="accountValue" class="info-value">-</span>
                </div>
                <div id="projectIdRow" class="info-row hidden">
                    <span class="info-label">Project ID</span>
                    <span id="projectIdValue" class="info-value">-</span>
                </div>
                <div id="planRow" class="info-row">
                    <span class="info-label">${t('dashboard.plan')}</span>
                    <span id="planValue" class="info-value">-</span>
                </div>
            </div>

            <!-- 本地 API 连接信息 (仅本地模式显示) -->
            <div id="localApiSection" class="section">
                <div class="section-title">${t('dashboard.localConnection')}</div>
                <div class="info-row">
                    <span class="info-label">Connect Port (HTTPS)</span>
                    <span id="connectPortValue" class="info-value">-</span>
                </div>
                <div class="info-row">
                    <span class="info-label">HTTP Port</span>
                    <span id="httpPortValue" class="info-value">-</span>
                </div>
                <div class="info-row">
                    <span class="info-label">CSRF Token</span>
                    <span id="csrfTokenValue" class="info-value masked">-</span>
                </div>
            </div>

            <!-- Google API 连接信息 (仅 Google 模式显示) -->
            <div id="googleApiSection" class="section hidden">
                <div class="section-title">${t('dashboard.googleConnection')}</div>
                <div class="info-row">
                    <span class="info-label">${t('dashboard.loginStatus')}</span>
                    <span id="googleLoginStatus" class="info-value">-</span>
                </div>
                <div class="info-row">
                    <span class="info-label">${t('dashboard.dataSource')}</span>
                    <span id="googleDataSource" class="info-value">Google Cloud API</span>
                </div>
            </div>
        </div>

        <!-- 轮询状态 -->
        <div class="section">
            <div class="section-title">${t('dashboard.pollingStatus')}</div>
            <div class="info-row">
                <span class="info-label">${t('dashboard.interval')}</span>
                <span id="pollingIntervalValue" class="info-value">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">${t('dashboard.lastUpdate')}</span>
                <span id="lastUpdateValue" class="info-value">-</span>
            </div>
            <div id="errorRow" class="info-row hidden">
                <span class="info-label">${t('dashboard.lastError')}</span>
                <span id="errorValue" class="info-value badge-error">-</span>
            </div>
        </div>

        <!-- 快捷操作 -->
        <div class="section">
            <div class="section-title">${t('dashboard.quickActions')}</div>
            <div class="actions">
                <button class="btn btn-secondary" id="btnRefresh">${t('dashboard.refresh')}</button>
                <button class="btn btn-secondary" id="btnDetectPort">${t('dashboard.detectPort')}</button>
                <button class="btn btn-secondary" id="btnLoginOAuth">${t('dashboard.loginOAuth')}</button>
                <button class="btn btn-secondary" id="btnLoginLocalToken">${t('dashboard.loginLocalToken')}</button>
                <button class="btn btn-secondary" id="btnLogout">${t('dashboard.logout')}</button>
                <button class="btn btn-secondary" id="btnSettings">${t('dashboard.settings')}</button>
                <button class="btn btn-secondary" id="btnRefreshPanel">${t('dashboard.refreshPanel')}</button>
            </div>
        </div>

        <!-- 配额概览 (有数据时显示) -->
        <div id="quotaSection" class="section hidden">
            <div class="section-title">${t('dashboard.quotaOverview')}</div>
            <!-- 暂时隐藏提示词额度
            <div id="promptCreditsRow" class="info-row hidden">
                <span class="info-label">${t('tooltip.credits')}</span>
                <span id="promptCreditsValue" class="info-value">-</span>
            </div>
            <table class="quota-table">
                <thead>
                    <tr>
                        <th>${t('tooltip.model')}</th>
                        <th>${t('tooltip.remaining')}</th>
                        <th>${t('tooltip.resetTime')}</th>
                        <th id="weeklyLimitHeader" class="hidden">${t('dashboard.weeklyLimit')} <span id="weeklyLimitWarning" class="info-icon">⚠<span class="tooltip">${t('dashboard.weeklyLimitWarning')}</span></span></th>
                    </tr>
                </thead>
                <tbody id="quotaTableBody"></tbody>
            </table>
        </div>

        <!-- Star 横幅 -->
        <div class="star-banner">
            <div class="star-banner-content">
                <span class="star-icon">⭐</span>
                <span class="star-text">${t('dashboard.starBannerText')}</span>
                <a class="star-link" href="https://github.com/wusimpl/AntigravityQuotaWatcher" target="_blank">
                    GitHub ⭐
                </a>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // DOM elements
        const $ = id => document.getElementById(id);
        const apiMethodBadge = $('apiMethodBadge');
        const accountValue = $('accountValue');
        const projectIdRow = $('projectIdRow');
        const projectIdValue = $('projectIdValue');
        const planValue = $('planValue');
        const localApiSection = $('localApiSection');
        const googleApiSection = $('googleApiSection');
        const connectPortValue = $('connectPortValue');
        const httpPortValue = $('httpPortValue');
        const csrfTokenValue = $('csrfTokenValue');
        const googleLoginStatus = $('googleLoginStatus');
        const googleDataSource = $('googleDataSource');
        const pollingIntervalValue = $('pollingIntervalValue');
        const lastUpdateValue = $('lastUpdateValue');
        const errorRow = $('errorRow');
        const errorValue = $('errorValue');
        const quotaSection = $('quotaSection');
        // 暂时隐藏提示词额度
        const promptCreditsRow = $('promptCreditsRow');
        const promptCreditsValue = $('promptCreditsValue');
        const quotaTableBody = $('quotaTableBody');

        // Buttons
        $('btnRefresh').onclick = () => vscode.postMessage({ command: 'refreshQuota' });
        $('btnDetectPort').onclick = () => vscode.postMessage({ command: 'detectPort' });
        $('btnLoginOAuth').onclick = () => vscode.postMessage({ command: 'login' });
        $('btnLoginLocalToken').onclick = () => vscode.postMessage({ command: 'loginLocalToken' });
        $('btnLogout').onclick = () => vscode.postMessage({ command: 'logout' });
        $('btnSettings').onclick = () => vscode.postMessage({ command: 'openSettings' });
        $('btnRefreshPanel').onclick = () => vscode.postMessage({ command: 'refreshPanel' });

        function maskToken(token) {
            if (!token || token.length <= 14) return '***';
            return token.substring(0, 6) + '••••••' + token.substring(token.length - 4);
        }

        function formatTime(date) {
            if (!date) return '-';
            const d = new Date(date);
            return d.toLocaleTimeString();
        }

        function getProgressClass(pct) {
            // 按 README 规则: >=50% 绿色, 30-50% 黄色, <30% 红色, 0% 黑色
            if (pct <= 0) return 'progress-depleted';
            if (pct < 30) return 'progress-critical';
            if (pct < 50) return 'progress-warning';
            return 'progress-normal';
        }

        function updateUI(state) {
            const isGoogleApi = state.apiMethod === 'GOOGLE_API';
            const snapshot = state.quotaSnapshot;

            // API 模式
            apiMethodBadge.textContent = isGoogleApi ? 'Google API' : 'Local API';
            apiMethodBadge.className = 'badge ' + (isGoogleApi ? 'badge-google' : 'badge-local');

            // 本地 API 模块
            localApiSection.classList.toggle('hidden', isGoogleApi);
            googleApiSection.classList.toggle('hidden', !isGoogleApi);
            $('btnDetectPort').classList.toggle('hidden', isGoogleApi);

            // Google API 连接信息
            if (isGoogleApi) {
                googleLoginStatus.textContent = state.isLoggedIn ? '已登录' : '未登录';
            }

            // Google API 特有
            projectIdRow.classList.toggle('hidden', !isGoogleApi || !state.projectId);
            projectIdValue.textContent = state.projectId || '-';

            // 周限检测列 - 仅 Google API 模式显示
            $('weeklyLimitHeader').classList.toggle('hidden', !isGoogleApi);

            // 登录/登出按钮状态 - 仅 Google API 模式显示
            $('btnLoginOAuth').classList.toggle('hidden', !isGoogleApi || state.isLoggedIn);
            $('btnLoginLocalToken').classList.toggle('hidden', !isGoogleApi || state.isLoggedIn);
            $('btnLogout').classList.toggle('hidden', !isGoogleApi || !state.isLoggedIn);

            // 账号/计划
            accountValue.textContent = snapshot?.userEmail || '-';
            planValue.textContent = snapshot?.planName || '-';

            // 本地连接信息
            connectPortValue.textContent = state.connectPort || '-';
            httpPortValue.textContent = state.httpPort || '-';
            csrfTokenValue.textContent = maskToken(state.csrfToken);

            // 轮询状态
            pollingIntervalValue.textContent = state.pollingInterval ? (state.pollingInterval / 1000) + 's' : '-';
            lastUpdateValue.textContent = snapshot ? formatTime(snapshot.timestamp) : '-';

            // 错误
            if (state.lastError) {
                errorRow.classList.remove('hidden');
                errorValue.textContent = state.lastError;
            } else {
                errorRow.classList.add('hidden');
            }

            // 配额表格
            if (snapshot && snapshot.models && snapshot.models.length > 0) {
                quotaSection.classList.remove('hidden');

                // Prompt Credits - 暂时隐藏
                if (snapshot.promptCredits) {
                    promptCreditsRow.classList.remove('hidden');
                    const pc = snapshot.promptCredits;
                    promptCreditsValue.textContent = pc.available + ' / ' + pc.monthly + ' (' + pc.remainingPercentage.toFixed(1) + '%)';
                } else {
                    promptCreditsRow.classList.add('hidden');
                }

                // Models - 按名称排序保持稳定顺序，过滤掉不需要显示的模型
                const sortedModels = [...snapshot.models]
                    .filter(m => !m.label.includes('Gemini 3 Pro Image'))
                    .sort((a, b) => a.label.localeCompare(b.label));
                quotaTableBody.innerHTML = sortedModels.map(m => {
                    const pct = m.remainingPercentage ?? 0;
                    const pctStr = pct.toFixed(1) + '%';
                    const progressClass = getProgressClass(pct);
                    const barClass = pct <= 0 ? 'progress-bar depleted' : 'progress-bar';
                    // 周限检测按钮 - 仅 Google API 模式显示
                    const checkBtn = isGoogleApi 
                        ? '<td><button class="btn-check-limit" data-model="' + encodeURIComponent(m.modelId || m.label) + '">检测</button></td>'
                        : '';
                    return '<tr>' +
                        '<td>' + m.label + '</td>' +
                        '<td><div class="' + barClass + '"><div class="progress-fill ' + progressClass + '" style="width:' + pct + '%"></div></div> ' + pctStr + '</td>' +
                        '<td>' + m.timeUntilResetFormatted + '</td>' +
                        checkBtn +
                        '</tr>';
                }).join('');

                // 绑定周限检测按钮事件
                if (isGoogleApi) {
                    quotaTableBody.querySelectorAll('.btn-check-limit').forEach(btn => {
                        btn.onclick = function() {
                            const model = decodeURIComponent(this.getAttribute('data-model'));
                            vscode.postMessage({ command: 'checkWeeklyLimit', model: model });
                        };
                    });
                }
            } else {
                quotaSection.classList.add('hidden');
            }
        }

        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.type === 'stateUpdate') {
                updateUI(msg.state);
            }
        });

        // 通知 extension 已准备好接收数据
        vscode.postMessage({ command: 'ready' });
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public postMessage(message: any): void {
        this.panel.webview.postMessage(message);
    }

    public dispose(): void {
        WebviewPanelService.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) d.dispose();
        }
        logger.info('WebviewPanel', 'Dashboard panel disposed');
    }
}
