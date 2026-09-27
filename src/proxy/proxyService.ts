/**
 * 代理服务 - 提供代理配置管理和 HTTPS Agent 创建
 * 
 * 职责：
 * - 存储代理配置 (enabled, autoDetect, url)
 * - 检测系统代理 (读取环境变量 HTTPS_PROXY, HTTP_PROXY)
 * - 提供 https.Agent 给网络请求使用
 * - 监听代理配置变更
 */

import * as https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as vscode from 'vscode';
import { ProxyConfig } from '../types';
import { logger } from '../logger';

/**
 * 代理服务 - 单例模式
 */
export class ProxyService {
    private static instance: ProxyService;
    private config: ProxyConfig = {
        enabled: false,
        autoDetect: true,
        url: ''
    };
    private cachedAgent: https.Agent | undefined;
    private disposables: vscode.Disposable[] = [];

    private constructor() { }

    /**
     * 获取单例实例
     */
    public static getInstance(): ProxyService {
        if (!ProxyService.instance) {
            ProxyService.instance = new ProxyService();
        }
        return ProxyService.instance;
    }

    /**
     * 初始化服务，加载配置并监听变更
     */
    public initialize(): void {
        this.loadConfig();
        this.watchConfigChanges();
        logger.info('ProxyService', `Initialized: enabled=${this.config.enabled}, autoDetect=${this.config.autoDetect}, url=${this.sanitizeProxyUrl(this.config.url || '(empty)')}`);
        // 输出初始化调试信息（单行聚合）
        this.logProxyDebugInfo('Initialization');
    }

    /**
     * 脱敏处理代理 URL（隐藏凭据信息）
     * @param url 原始代理 URL
     * @returns 脱敏后的 URL
     */
    private sanitizeProxyUrl(url: string | undefined): string {
        if (!url || url === '(not set)' || url === '(none)') {
            return url || '(not set)';
        }

        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            // 如果是本地地址，直接返回完整 URL
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
                return url;
            }

            // 非本地地址，脱敏处理
            if (urlObj.username || urlObj.password) {
                urlObj.username = '***';
                urlObj.password = '***';
            }
            return urlObj.toString();
        } catch (error) {
            // URL 解析失败，返回脱敏标记
            return '(invalid URL format)';
        }
    }

    /**
     * 输出代理调试信息
     * @param context 调用上下文描述
     */
    private logProxyDebugInfo(context: string): void {
        const sanitizeEnvVar = (value: string | undefined): string => {
            if (!value) { return '(not set)'; }
            return this.sanitizeProxyUrl(value);
        };

        const envVars = [
            `HTTPS_PROXY=${sanitizeEnvVar(process.env.HTTPS_PROXY || process.env.https_proxy)}`,
            `HTTP_PROXY=${sanitizeEnvVar(process.env.HTTP_PROXY || process.env.http_proxy)}`,
            `ALL_PROXY=${sanitizeEnvVar(process.env.ALL_PROXY || process.env.all_proxy)}`,
            `NO_PROXY=${process.env.NO_PROXY || '(not set)'}`,
            `no_proxy=${process.env.no_proxy || '(not set)'}`
        ].join(', ');

        const summary = {
            context,
            enabled: this.config.enabled,
            autoDetect: this.config.autoDetect,
            url: this.sanitizeProxyUrl(this.config.url || '(not set)'),
            env: envVars,
            effectiveUrl: this.sanitizeProxyUrl(this.getEffectiveProxyUrlInternal() || '(none)'),
        };

        logger.debug('ProxyService', 'Proxy debug', summary);
    }

    /**
     * 内部方法：获取有效代理 URL（不输出日志，避免递归）
     */
    private getEffectiveProxyUrlInternal(): string | undefined {
        if (!this.config.enabled) {
            return undefined;
        }
        if (this.config.url && this.config.url.trim() !== '') {
            return this.config.url.trim();
        }
        if (this.config.autoDetect) {
            return this.detectSystemProxyInternal();
        }
        return undefined;
    }

    /**
     * 内部方法：检测系统代理（不输出日志，避免递归）
     */
    private detectSystemProxyInternal(): string | undefined {
        const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
        if (httpsProxy) { return httpsProxy; }
        const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
        if (httpProxy) { return httpProxy; }
        const allProxy = process.env.ALL_PROXY || process.env.all_proxy;
        if (allProxy) { return allProxy; }
        return undefined;
    }

    /**
     * 从 VSCode 配置中加载代理配置
     */
    private loadConfig(): void {
        const vscodeConfig = vscode.workspace.getConfiguration('antigravityQuotaWatcher');
        const oldConfig = { ...this.config };
        
        this.config = {
            enabled: vscodeConfig.get<boolean>('proxyEnabled', false),
            autoDetect: vscodeConfig.get<boolean>('proxyAutoDetect', true),
            url: vscodeConfig.get<string>('proxyUrl', '')
        };
        
        // 记录配置加载详情
        logger.debug('ProxyService', `loadConfig: proxyEnabled=${this.config.enabled}, proxyAutoDetect=${this.config.autoDetect}, proxyUrl="${this.sanitizeProxyUrl(this.config.url || '(empty)')}"`);

        // 如果配置发生变化，记录变化详情
        if (oldConfig.enabled !== this.config.enabled ||
            oldConfig.autoDetect !== this.config.autoDetect ||
            oldConfig.url !== this.config.url) {
            logger.debug('ProxyService', `Config changed: enabled ${oldConfig.enabled} -> ${this.config.enabled}, autoDetect ${oldConfig.autoDetect} -> ${this.config.autoDetect}, url "${this.sanitizeProxyUrl(oldConfig.url)}" -> "${this.sanitizeProxyUrl(this.config.url)}"`);
        }
        
        // 清除缓存的 Agent
        this.cachedAgent = undefined;
    }

    /**
     * 监听配置变更
     */
    private watchConfigChanges(): void {
        const disposable = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('antigravityQuotaWatcher.proxyEnabled') ||
                event.affectsConfiguration('antigravityQuotaWatcher.proxyAutoDetect') ||
                event.affectsConfiguration('antigravityQuotaWatcher.proxyUrl')) {
                logger.info('ProxyService', 'Proxy configuration changed, reloading...');
                this.loadConfig();
                // 配置变更后输出完整的调试信息
                this.logProxyDebugInfo('Configuration Changed');
            }
        });
        this.disposables.push(disposable);
    }

    /**
     * 获取当前代理配置
     */
    public getConfig(): ProxyConfig {
        return { ...this.config };
    }

    /**
     * 检测系统代理
     * 优先读取环境变量 HTTPS_PROXY / HTTP_PROXY
     * 
     * @returns 检测到的代理 URL，如果没有检测到返回 undefined
     */
    public detectSystemProxy(): string | undefined {
        logger.debug('ProxyService', 'detectSystemProxy: Starting system proxy detection...');

        // 记录所有代理相关环境变量的当前值（合并为一行，脱敏处理）
        const sanitizeEnvVar = (value: string | undefined): string => {
            if (!value) { return '(not set)'; }
            return this.sanitizeProxyUrl(value);
        };

        const envCheck = [
            `HTTPS_PROXY="${sanitizeEnvVar(process.env.HTTPS_PROXY)}"`,
            `https_proxy="${sanitizeEnvVar(process.env.https_proxy)}"`,
            `HTTP_PROXY="${sanitizeEnvVar(process.env.HTTP_PROXY)}"`,
            `http_proxy="${sanitizeEnvVar(process.env.http_proxy)}"`,
            `ALL_PROXY="${sanitizeEnvVar(process.env.ALL_PROXY)}"`,
            `all_proxy="${sanitizeEnvVar(process.env.all_proxy)}"`
        ].join(', ');
        logger.debug('ProxyService', `detectSystemProxy: Env check: ${envCheck}`);

        // 优先检测 HTTPS_PROXY
        const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
        if (httpsProxy) {
            logger.info('ProxyService', `Detected system proxy from HTTPS_PROXY: ${this.sanitizeProxyUrl(httpsProxy)}`);
            return httpsProxy;
        }

        // 其次检测 HTTP_PROXY
        const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
        if (httpProxy) {
            logger.info('ProxyService', `Detected system proxy from HTTP_PROXY: ${this.sanitizeProxyUrl(httpProxy)}`);
            return httpProxy;
        }

        // 检测 ALL_PROXY (通用代理)
        const allProxy = process.env.ALL_PROXY || process.env.all_proxy;
        if (allProxy) {
            logger.info('ProxyService', `Detected system proxy from ALL_PROXY: ${this.sanitizeProxyUrl(allProxy)}`);
            return allProxy;
        }

        logger.debug('ProxyService', 'detectSystemProxy: No system proxy detected from environment variables');
        return undefined;
    }

    /**
     * 获取有效的代理 URL
     * 如果开启了自动检测，会尝试检测系统代理
     * 
     * @returns 代理 URL，如果没有代理返回 undefined
     */
    public getEffectiveProxyUrl(): string | undefined {
        logger.debug('ProxyService', `getEffectiveProxyUrl: enabled=${this.config.enabled}, autoDetect=${this.config.autoDetect}, configuredUrl="${this.sanitizeProxyUrl(this.config.url || '(empty)')}"`);

        if (!this.config.enabled) {
            logger.debug('ProxyService', 'getEffectiveProxyUrl: Proxy is disabled, returning undefined');
            return undefined;
        }

        // 如果手动配置了代理 URL，优先使用
        if (this.config.url && this.config.url.trim() !== '') {
            logger.debug('ProxyService', `getEffectiveProxyUrl: Using manually configured URL: ${this.sanitizeProxyUrl(this.config.url.trim())}`);
            return this.config.url.trim();
        }

        // 如果开启了自动检测，尝试检测系统代理
        if (this.config.autoDetect) {
            logger.debug('ProxyService', 'getEffectiveProxyUrl: autoDetect is enabled, attempting to detect system proxy...');
            const detectedUrl = this.detectSystemProxy();
            if (detectedUrl) {
                logger.debug('ProxyService', `getEffectiveProxyUrl: Auto-detected proxy URL: ${this.sanitizeProxyUrl(detectedUrl)}`);
            } else {
                logger.debug('ProxyService', 'getEffectiveProxyUrl: Auto-detection enabled but no proxy found in environment');
            }
            return detectedUrl;
        }

        logger.debug('ProxyService', 'getEffectiveProxyUrl: No proxy URL available (autoDetect is disabled and no manual URL configured)');
        return undefined;
    }

    /**
     * 获取 HTTPS Agent
     * 如果代理未启用或无有效代理 URL，返回 undefined
     * 
     * @returns https.Agent 或 undefined
     */
    public getHttpsAgent(): https.Agent | undefined {
        logger.debug('ProxyService', 'getHttpsAgent: Requesting HTTPS agent...');
        const proxyUrl = this.getEffectiveProxyUrl();

        if (!proxyUrl) {
            logger.debug('ProxyService', 'getHttpsAgent: No proxy URL available, returning undefined agent');
            return undefined;
        }

        // 如果代理 URL 没变，返回缓存的 Agent
        if (this.cachedAgent && (this.cachedAgent as any)._proxyUrl === proxyUrl) {
            logger.debug('ProxyService', `getHttpsAgent: Returning cached agent for URL: ${this.sanitizeProxyUrl(proxyUrl)}`);
            return this.cachedAgent;
        }

        try {
            logger.info('ProxyService', `getHttpsAgent: Creating new proxy agent for URL: ${this.sanitizeProxyUrl(proxyUrl)}`);
            const agent = new HttpsProxyAgent(proxyUrl);
            // 标记代理 URL 用于缓存判断
            (agent as any)._proxyUrl = proxyUrl;
            this.cachedAgent = agent;
            logger.debug('ProxyService', 'getHttpsAgent: Proxy agent created and cached successfully');
            return agent;
        } catch (error: any) {
            logger.error('ProxyService', `getHttpsAgent: Failed to create proxy agent: ${error.message}`);
            logger.debug('ProxyService', `getHttpsAgent: Error details:`, error);
            return undefined;
        }
    }

    /**
     * 测试代理连接
     * 通过访问 Google API 测试代理是否可用
     * 
     * @returns Promise<boolean> 代理是否可用
     */
    public async testProxyConnection(): Promise<{ success: boolean; message: string }> {
        logger.info('ProxyService', 'testProxyConnection: Starting proxy connection test...');
        
        // 输出当前代理配置状态
        this.logProxyDebugInfo('Proxy Connection Test');
        
        const proxyUrl = this.getEffectiveProxyUrl();

        if (!proxyUrl) {
            logger.warn('ProxyService', 'testProxyConnection: No proxy URL configured or proxy disabled');
            return { success: false, message: '未配置代理或代理未启用' };
        }

        logger.info('ProxyService', `testProxyConnection: Testing connection through proxy: ${this.sanitizeProxyUrl(proxyUrl)}`);

        return new Promise((resolve) => {
            const agent = this.getHttpsAgent();
            if (!agent) {
                logger.error('ProxyService', 'testProxyConnection: Failed to create proxy agent');
                resolve({ success: false, message: '创建代理 Agent 失败' });
                return;
            }

            const testHost = 'www.googleapis.com';
            const testPath = '/oauth2/v2/tokeninfo?access_token=test';
            logger.debug('ProxyService', `testProxyConnection: Sending test request to https://${testHost}${testPath}`);

            const options: https.RequestOptions = {
                hostname: testHost,
                port: 443,
                path: testPath,
                method: 'GET',
                agent: agent,
                timeout: 10000
            };

            const startTime = Date.now();
            const req = https.request(options, (res) => {
                const elapsed = Date.now() - startTime;
                // 只要能收到响应（即使是错误响应），说明代理连接正常
                logger.info('ProxyService', `testProxyConnection: Received response - status=${res.statusCode}, elapsed=${elapsed}ms`);
                resolve({
                    success: true,
                    message: `代理连接成功 (HTTP ${res.statusCode})`
                });
            });

            req.on('error', (error) => {
                const elapsed = Date.now() - startTime;
                logger.error('ProxyService', `testProxyConnection: Request failed - error=${error.message}, elapsed=${elapsed}ms`);
                resolve({
                    success: false,
                    message: `代理连接失败: ${error.message}`
                });
            });

            req.on('timeout', () => {
                const elapsed = Date.now() - startTime;
                logger.error('ProxyService', `testProxyConnection: Request timed out after ${elapsed}ms`);
                req.destroy();
                resolve({
                    success: false,
                    message: '代理连接超时'
                });
            });

            req.end();
        });
    }

    /**
     * 判断请求是否应该绕过代理
     * localhost 和 127.0.0.1 的请求应该绕过代理
     * 
     * @param hostname 目标主机名
     * @returns 是否应该绕过代理
     */
    public shouldBypassProxy(hostname: string): boolean {
        const host = hostname.toLowerCase();
        return host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '::1' ||
            host.endsWith('.local');
    }

    /**
     * 获取请求的 Agent，自动判断是否应该使用代理
     * 
     * @param hostname 目标主机名
     * @returns https.Agent 或 undefined
     */
    public getAgentForHost(hostname: string): https.Agent | undefined {
        logger.debug('ProxyService', `getAgentForHost: Requesting agent for host: ${hostname}`);
        
        if (this.shouldBypassProxy(hostname)) {
            logger.debug('ProxyService', `getAgentForHost: Bypassing proxy for local host: ${hostname}`);
            return undefined;
        }
        
        const agent = this.getHttpsAgent();
        if (agent) {
            logger.debug('ProxyService', `getAgentForHost: Using proxy agent for host: ${hostname}`);
        } else {
            logger.debug('ProxyService', `getAgentForHost: No proxy agent available for host: ${hostname}`);
        }
        return agent;
    }

    /**
     * 释放资源
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.cachedAgent = undefined;
    }
}
