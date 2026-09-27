/**
 * Google OAuth 2.0 认证服务
 * 管理 Google 账号登录、Token 刷新和认证状态
 */

import * as vscode from 'vscode';
import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_AUTH_ENDPOINT,
    GOOGLE_TOKEN_ENDPOINT,
    GOOGLE_SCOPES,
} from './constants';
import { TokenStorage, TokenData } from './tokenStorage';
import { CallbackServer } from './callbackServer';
import { LocalizationService } from '../i18n/localizationService';
import { logger } from '../logger';
import { ProxyService } from '../proxy/proxyService';

/**
 * 认证状态枚举
 */
export enum AuthState {
    NOT_AUTHENTICATED = 'not_authenticated',
    AUTHENTICATING = 'authenticating',
    AUTHENTICATED = 'authenticated',
    TOKEN_EXPIRED = 'token_expired',
    REFRESHING = 'refreshing',
    ERROR = 'error',
}

/**
 * 完整的认证状态信息
 */
export interface AuthStateInfo {
    state: AuthState;
    error?: string;
    email?: string;
}

/**
 * Token 响应类型
 */
interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
}

class OAuthTokenRequestError extends Error {
    public readonly oauthError: string;
    public readonly oauthErrorDescription?: string;

    constructor(oauthError: string, oauthErrorDescription?: string) {
        const descriptionPart = oauthErrorDescription ? ` - ${oauthErrorDescription}` : '';
        super(`Token error: ${oauthError}${descriptionPart}`);
        this.name = 'OAuthTokenRequestError';
        this.oauthError = oauthError;
        this.oauthErrorDescription = oauthErrorDescription;
    }
}

/**
 * 用户信息响应类型
 */
interface UserInfoResponse {
    id: string;
    email: string;
    verified_email: boolean;
    name?: string;
    picture?: string;
}

/**
 * Google OAuth 认证服务
 * 单例模式
 */
export class GoogleAuthService {
    private static instance: GoogleAuthService;
    private tokenStorage: TokenStorage;
    private callbackServer: CallbackServer | null = null;
    private context: vscode.ExtensionContext | null = null;
    private currentState: AuthState = AuthState.NOT_AUTHENTICATED;
    private lastError: string | undefined;
    private userEmail: string | undefined;
    private stateChangeListeners: Set<(state: AuthStateInfo) => void> = new Set();

    private constructor() {
        this.tokenStorage = TokenStorage.getInstance();
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): GoogleAuthService {
        if (!GoogleAuthService.instance) {
            GoogleAuthService.instance = new GoogleAuthService();
        }
        return GoogleAuthService.instance;
    }

    /**
     * 初始化服务
     * @param context VS Code 扩展上下文
     */
    public async initialize(context: vscode.ExtensionContext): Promise<void> {
        logger.info('GoogleAuth', 'Initializing auth service...');
        this.context = context;
        this.tokenStorage.initialize(context);

        // 检查是否有存储的 Token
        const hasToken = await this.tokenStorage.hasToken();
        logger.info('GoogleAuth', `Has stored token: ${hasToken}`);

        if (hasToken) {
            const isExpired = await this.tokenStorage.isTokenExpired();
            logger.info('GoogleAuth', `Token expired: ${isExpired}`);

            if (isExpired) {
                // 尝试刷新 Token
                try {
                    logger.info('GoogleAuth', 'Attempting to refresh expired token...');
                    await this.refreshToken();
                    logger.info('GoogleAuth', 'Token refreshed successfully');
                    this.setState(AuthState.AUTHENTICATED);
                    logger.info('GoogleAuth', 'Set state to AUTHENTICATED (token refreshed)');
                } catch (e) {
                    // 刷新失败，设置为 TOKEN_EXPIRED 状态
                    // 后续 getValidAccessToken() 会再次尝试刷新
                    const nextState = this.classifyRefreshFailure(e);
                    logger.warn('GoogleAuth', `Token refresh failed during init, nextState=${nextState}: ${e}`);
                    this.setState(nextState);
                }
            } else {
                // Token 未过期，设置为已认证状态
                this.setState(AuthState.AUTHENTICATED);
                logger.info('GoogleAuth', 'Set state to AUTHENTICATED (token valid)');
            }
        } else {
            this.setState(AuthState.NOT_AUTHENTICATED);
            logger.info('GoogleAuth', 'No stored token, user needs to login');
        }
    }

    /**
     * 检查是否已登录
     */
    public isAuthenticated(): boolean {
        return this.currentState === AuthState.AUTHENTICATED;
    }

    /**
     * 获取完整认证状态
     */
    public getAuthState(): AuthStateInfo {
        return {
            state: this.currentState,
            error: this.lastError,
            email: this.userEmail,
        };
    }

    /**
     * 发起 Google 登录流程
     * @returns 是否登录成功
     */
    public async login(): Promise<boolean> {
        logger.info('GoogleAuth', `Login initiated, current state: ${this.currentState}`);

        if (this.currentState === AuthState.AUTHENTICATING) {
            logger.info('GoogleAuth', 'Already authenticating, skipping');
            return false; // 正在登录中
        }

        try {
            this.setState(AuthState.AUTHENTICATING);

            // 生成 state 参数 (CSRF 保护)
            const state = crypto.randomBytes(32).toString('hex');
            logger.debug('GoogleAuth', 'Generated state for CSRF protection');

            // 生成 PKCE code verifier 和 challenge
            const codeVerifier = crypto.randomBytes(32).toString('base64url');
            const codeChallenge = crypto
                .createHash('sha256')
                .update(codeVerifier)
                .digest('base64url');
            logger.debug('GoogleAuth', 'Generated PKCE code challenge');

            // 启动回调服务器
            this.callbackServer = new CallbackServer();

            // 尝试加载图标
            try {
                if (this.context) {
                    const iconPath = path.join(this.context.extensionPath, 'icon.png');
                    if (fs.existsSync(iconPath)) {
                        const iconBuffer = fs.readFileSync(iconPath);
                        const iconBase64 = `data:image/png;base64,${iconBuffer.toString('base64')}`;
                        this.callbackServer.setIcon(iconBase64);
                        logger.debug('GoogleAuth', 'Loaded plugin icon for callback page');
                    }
                }
            } catch (iconError) {
                logger.warn('GoogleAuth', `Failed to load icon for callback page: ${iconError}`);
            }

            // 等待服务器启动并获取端口
            await this.callbackServer.startServer();

            // 获取重定向 URI（服务器已启动，端口已分配）
            const redirectUri = this.callbackServer.getRedirectUri();
            logger.info('GoogleAuth', `Callback server started, redirect URI: ${redirectUri}`);

            // 构建授权 URL
            const authUrl = this.buildAuthUrl(redirectUri, state, codeChallenge);
            logger.info('GoogleAuth', 'Opening browser for authorization...');

            // 开始等待回调（此时设置请求处理器）
            const callbackPromise = this.callbackServer.waitForCallback(state);

            // 在浏览器中打开授权页面
            await vscode.env.openExternal(vscode.Uri.parse(authUrl));

            // 等待回调
            logger.debug('GoogleAuth', 'Waiting for OAuth callback...');
            const result = await callbackPromise;
            logger.info('GoogleAuth', 'Received authorization code, exchanging for token...');

            // 交换 authorization code 获取 Token
            const tokenData = await this.exchangeCodeForToken(
                result.code,
                redirectUri,
                codeVerifier
            );
            logger.info('GoogleAuth', `Token exchange successful, expires at: ${new Date(tokenData.expiresAt).toISOString()}`);

            // 保存 Token
            await this.tokenStorage.saveToken(tokenData);
            logger.info('GoogleAuth', 'Token saved to secure storage');

            this.setState(AuthState.AUTHENTICATED);
            vscode.window.showInformationMessage(LocalizationService.getInstance().t('login.success.google'));
            return true;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            logger.error('GoogleAuth', 'Login failed', {
                message: errorMessage,
                stack: e instanceof Error ? e.stack : undefined
            });
            this.lastError = errorMessage;
            this.setState(AuthState.ERROR);
            vscode.window.showErrorMessage(LocalizationService.getInstance().t('login.error.google', { error: errorMessage }));
            return false;
        } finally {
            // 确保服务器已关闭
            if (this.callbackServer) {
                this.callbackServer.stop();
                this.callbackServer = null;
                logger.debug('GoogleAuth', 'Callback server stopped');
            }
        }
    }

    /**
     * 登出并清除 Token
     * @returns 是否实际执行了登出操作（之前是否已登录）
     */
    public async logout(): Promise<boolean> {
        const wasAuthenticated = this.currentState === AuthState.AUTHENTICATED ||
            this.currentState === AuthState.TOKEN_EXPIRED ||
            this.currentState === AuthState.REFRESHING;

        await this.tokenStorage.clearToken();
        this.userEmail = undefined;
        this.lastError = undefined;
        this.setState(AuthState.NOT_AUTHENTICATED);

        return wasAuthenticated;
    }

    /**
     * 使用已有的 refresh_token 登录（从 Antigravity 本地数据库导入）
     * @param refreshToken 从 Antigravity 提取的 refresh_token
     * @returns 是否登录成功
     */
    public async loginWithRefreshToken(refreshToken: string): Promise<boolean> {
        logger.info('GoogleAuth', 'Attempting login with imported refresh_token');

        if (this.currentState === AuthState.AUTHENTICATING || this.currentState === AuthState.REFRESHING) {
            logger.info('GoogleAuth', 'Already authenticating/refreshing, skipping');
            return false;
        }

        try {
            this.setState(AuthState.REFRESHING);

            // 使用 refresh_token 获取新的 access_token
            const params = new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            });

            logger.debug('GoogleAuth', 'Sending token refresh request with imported refresh_token...');
            const response = await this.makeTokenRequest(params);
            logger.info('GoogleAuth', `Token refresh response received, expires_in: ${response.expires_in}`);

            // 构建 TokenData 并保存
            const tokenData: TokenData = {
                accessToken: response.access_token,
                refreshToken: refreshToken, // 使用导入的 refresh_token
                expiresAt: Date.now() + response.expires_in * 1000,
                tokenType: response.token_type,
                scope: response.scope,
                source: 'imported',  // 从本地 Antigravity 导入
            };

            await this.tokenStorage.saveToken(tokenData);
            logger.info('GoogleAuth', 'Token saved to secure storage');

            this.setState(AuthState.AUTHENTICATED);
            vscode.window.showInformationMessage(LocalizationService.getInstance().t('login.success.localToken'));
            return true;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            logger.error('GoogleAuth', `Login with refresh_token failed: ${errorMessage}`);
            this.lastError = errorMessage;
            await this.tokenStorage.clearToken();
            this.setState(AuthState.NOT_AUTHENTICATED);
            vscode.window.showErrorMessage(LocalizationService.getInstance().t('login.error.localToken', { error: errorMessage }));
            return false;
        }
    }

    /**
     * 将 Token 来源转换为手动登录（用户选择不同步时调用）
     * 这样后续不会再触发同步校验
     */
    public async convertToManualSource(): Promise<void> {
        try {
            await this.tokenStorage.updateTokenSource('manual');
            logger.info('GoogleAuth', 'Token source converted to manual');
        } catch (e) {
            logger.error('GoogleAuth', `Failed to convert token source: ${e}`);
        }
    }

    /**
     * 获取当前 Token 来源
     * @returns Token 来源，'manual' 或 'imported'
     */
    public async getTokenSource(): Promise<'manual' | 'imported'> {
        return await this.tokenStorage.getTokenSource();
    }

    /**
     * 获取有效的 Access Token
     * 如果 Token 已过期会自动刷新
     * @throws 如果无法获取有效 Token
     */
    public async getValidAccessToken(): Promise<string> {
        logger.debug('GoogleAuth', 'Getting valid access token...');
        const token = await this.tokenStorage.getToken();
        if (!token) {
            logger.info('GoogleAuth', 'No token found');
            this.setState(AuthState.NOT_AUTHENTICATED);
            throw new Error('Not authenticated');
        }

        // 检查是否需要刷新 (提前 5 分钟)
        const isExpired = await this.tokenStorage.isTokenExpired();
        if (isExpired) {
            logger.info('GoogleAuth', 'Token expired or expiring soon, refreshing...');
            await this.refreshToken();
        }

        const accessToken = await this.tokenStorage.getAccessToken();
        if (!accessToken) {
            logger.error('GoogleAuth', 'Failed to get access token after refresh');
            throw new Error('Failed to get access token');
        }
        logger.debug('GoogleAuth', `Access token obtained: ${this.maskToken(accessToken)}`);
        return accessToken;
    }

    /**
     * 监听认证状态变化
     * @param callback 状态变化回调
     * @returns Disposable
     */
    public onAuthStateChange(callback: (state: AuthStateInfo) => void): vscode.Disposable {
        this.stateChangeListeners.add(callback);
        return {
            dispose: () => {
                this.stateChangeListeners.delete(callback);
            }
        };
    }

    /**
     * 获取当前登录用户的邮箱
     * @returns 用户邮箱，未登录或获取失败返回 undefined
     */
    public getUserEmail(): string | undefined {
        return this.userEmail;
    }

    /**
     * 获取用户信息（包括邮箱）
     * @param accessToken OAuth access token
     * @returns 用户信息
     */
    public async fetchUserInfo(accessToken: string): Promise<UserInfoResponse> {
        logger.debug('GoogleAuth', 'Fetching user info...');
        return new Promise((resolve, reject) => {
            // 获取代理 Agent（如果配置了代理）
            const proxyAgent = ProxyService.getInstance().getAgentForHost('www.googleapis.com');

            const options: https.RequestOptions = {
                hostname: 'www.googleapis.com',
                port: 443,
                path: '/oauth2/v2/userinfo',
                method: 'GET',
                agent: proxyAgent,  // 添加代理 agent 支持
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            const response = JSON.parse(data) as UserInfoResponse;
                            logger.info('GoogleAuth', 'User info fetched', { email: response.email });
                            // 缓存邮箱
                            this.userEmail = response.email;
                            resolve(response);
                        } else {
                            const preview = data.substring(0, 200);
                            logger.error('GoogleAuth', 'Failed to fetch user info', {
                                status: res.statusCode,
                                bodyPreview: preview
                            });
                            reject(new Error(`Failed to fetch user info: ${res.statusCode} - ${preview}`));
                        }
                    } catch (e) {
                        const preview = data.substring(0, 200);
                        logger.error('GoogleAuth', 'Failed to parse user info response', { bodyPreview: preview });
                        reject(new Error(`Failed to parse user info response: ${preview}`));
                    }
                });
            });

            req.on('error', (e) => {
                logger.error('GoogleAuth', 'User info request error', { message: e.message });
                reject(e);
            });

            req.end();
        });
    }

    /**
     * 刷新 Token
     */
    private async refreshToken(): Promise<void> {
        logger.info('GoogleAuth', 'Refreshing token...');
        this.setState(AuthState.REFRESHING);

        try {
            const refreshToken = await this.tokenStorage.getRefreshToken();
            if (!refreshToken) {
                logger.error('GoogleAuth', 'No refresh token available');
                throw new Error('No refresh token available');
            }
            logger.debug('GoogleAuth', `Using refresh token: ${this.maskToken(refreshToken)}`);

            const params = new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            });

            logger.debug('GoogleAuth', 'Sending token refresh request to Google...');
            const response = await this.makeTokenRequest(params);
            logger.info('GoogleAuth', `Token refresh response received, expires_in: ${response.expires_in}`);

            // 更新 access token
            await this.tokenStorage.updateAccessToken(
                response.access_token,
                response.expires_in
            );
            logger.info('GoogleAuth', 'Access token updated successfully');

            this.setState(AuthState.AUTHENTICATED);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            logger.error('GoogleAuth', 'Token refresh failed', {
                message: errorMessage,
                stack: e instanceof Error ? e.stack : undefined
            });
            this.lastError = errorMessage;
            this.setState(this.classifyRefreshFailure(e));
            throw e;
        }
    }

    /**
     * 遮蔽 token，只显示前6位和后4位
     */
    private classifyRefreshFailure(error: unknown): AuthState {
        if (error instanceof Error && error.message === 'No refresh token available') {
            return AuthState.NOT_AUTHENTICATED;
        }
        return this.isReauthRequired(error) ? AuthState.TOKEN_EXPIRED : AuthState.ERROR;
    }

    private isReauthRequired(error: unknown): boolean {
        if (error instanceof OAuthTokenRequestError) {
            return error.oauthError === 'invalid_grant';
        }
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            return msg.includes('invalid_grant') || msg.includes('invalid_rapt');
        }
        return false;
    }

    private maskToken(token: string): string {
        if (token.length <= 14) {
            return '***';
        }
        return `${token.substring(0, 6)}***${token.substring(token.length - 4)}`;
    }

    /**
     * 构建授权 URL
     */
    private buildAuthUrl(redirectUri: string, state: string, codeChallenge: string): string {
        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: GOOGLE_SCOPES,
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            access_type: 'offline',
            prompt: 'consent',
        });

        return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
    }

    /**
     * 交换 authorization code 获取 Token
     */
    private async exchangeCodeForToken(
        code: string,
        redirectUri: string,
        codeVerifier: string
    ): Promise<TokenData> {
        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier,
        });

        const response = await this.makeTokenRequest(params);

        if (!response.refresh_token) {
            throw new Error('No refresh token in response');
        }

        return {
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            expiresAt: Date.now() + response.expires_in * 1000,
            tokenType: response.token_type,
            scope: response.scope,
            source: 'manual',  // 手动登录
        };
    }

    /**
     * 发送 Token 请求
     */
    private makeTokenRequest(params: URLSearchParams): Promise<TokenResponse> {
        return new Promise((resolve, reject) => {
            const postData = params.toString();
            const url = new URL(GOOGLE_TOKEN_ENDPOINT);

            // 获取代理 Agent（如果配置了代理）
            const proxyAgent = ProxyService.getInstance().getAgentForHost(url.hostname);

            const options: https.RequestOptions = {
                hostname: url.hostname,
                port: 443,
                path: url.pathname,
                method: 'POST',
                agent: proxyAgent,  // 添加代理 agent 支持
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                },
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.error) {
                            reject(new OAuthTokenRequestError(response.error, response.error_description));
                        } else {
                            resolve(response as TokenResponse);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse token response: ${data}`));
                    }
                });
            });

            req.on('error', (e) => {
                reject(e);
            });

            req.write(postData);
            req.end();
        });
    }

    /**
     * 设置状态并通知监听器
     */
    private setState(state: AuthState): void {
        const previousState = this.currentState;
        this.currentState = state;
        logger.info('GoogleAuth', `State changed: ${previousState} -> ${state}`);

        const stateInfo = this.getAuthState();
        this.stateChangeListeners.forEach((listener) => {
            try {
                listener(stateInfo);
            } catch (e) {
                logger.error('GoogleAuth', `Auth state listener error: ${e}`);
            }
        });
    }
}
