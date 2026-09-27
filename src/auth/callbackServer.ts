/**
 * OAuth 回调 HTTP 服务器
 * 启动临时本地服务器接收 Google OAuth 回调
 */

import * as http from 'http';
import { CALLBACK_HOST, CALLBACK_PATH, AUTH_TIMEOUT_MS } from './constants';
import { logger } from '../logger';

/**
 * OAuth 回调结果
 */
export interface CallbackResult {
  code: string;  // Authorization code
  state?: string; // 状态参数 (用于 CSRF 保护)
}

/**
 * 回调服务器类
 * 启动临时 HTTP 服务器接收 OAuth 回调
 */
export class CallbackServer {
  private server: http.Server | null = null;
  private port: number = 0;
  private iconBase64: string | null = null;
  // 单个请求的超时时间（毫秒）
  private readonly REQUEST_TIMEOUT_MS = 30000;

  /**
   * 设置页面显示的图标 (Base64)
   */
  public setIcon(base64: string): void {
    this.iconBase64 = base64;
  }

  /**
   * 获取回调 URL
   * @returns 回调 URL
   */
  public getRedirectUri(): string {
    if (this.port === 0) {
      throw new Error('Server not started');
    }
    return `http://${CALLBACK_HOST}:${this.port}${CALLBACK_PATH}`;
  }

  /**
   * 启动服务器监听
   * 等待服务器开始监听后返回，之后可以调用 getRedirectUri() 获取回调地址
   */
  public startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer();

      // 监听随机端口
      this.server.listen(0, CALLBACK_HOST, () => {
        const address = this.server!.address();
        if (typeof address === 'object' && address !== null) {
          this.port = address.port;
          logger.info('CallbackServer', `OAuth callback server listening on port ${this.port}`);
          resolve();
        } else {
          reject(new Error('Failed to get server address'));
        }
      });

      // 处理服务器错误
      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * 等待 OAuth 回调
   * 必须先调用 startServer() 启动服务器
   * @param expectedState 期望的 state 参数 (CSRF 保护)
   * @returns Promise<CallbackResult> 回调结果
   */
  public waitForCallback(expectedState: string): Promise<CallbackResult> {
    if (this.port === 0) {
      return Promise.reject(new Error('Server not started. Call startServer() first.'));
    }

    return new Promise((resolve, reject) => {
      // 创建超时定时器
      const timeout = setTimeout(() => {
        this.stop();
        reject(new Error('OAuth callback timeout'));
      }, AUTH_TIMEOUT_MS);

      // 设置请求处理器
      this.server!.on('request', (req, res) => {
        // 设置单个请求的超时，防止慢速攻击
        req.setTimeout(this.REQUEST_TIMEOUT_MS, () => {
          logger.warn('CallbackServer', 'Request timeout, destroying connection');
          req.destroy();
        });

        const url = new URL(req.url || '', `http://${CALLBACK_HOST}`);

        // 只处理回调路径
        if (url.pathname !== CALLBACK_PATH) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        // 解析参数
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        // 清除超时
        clearTimeout(timeout);

        // 检查错误
        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.getErrorHtml(error, errorDescription || 'Unknown error'));
          this.stop();
          reject(new Error(`OAuth error: ${error} - ${errorDescription}`));
          return;
        }

        // 验证 authorization code
        if (!code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.getErrorHtml('missing_code', 'No authorization code received'));
          this.stop();
          reject(new Error('No authorization code received'));
          return;
        }

        // 验证 state (CSRF 保护)
        if (state !== expectedState) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.getErrorHtml('invalid_state', 'Invalid state parameter'));
          this.stop();
          reject(new Error('Invalid state parameter (CSRF protection)'));
          return;
        }

        // 返回成功页面
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.getSuccessHtml());

        // 停止服务器并返回结果
        this.stop();
        resolve({ code, state });
      });
    });
  }

  /**
   * 停止服务器
   */
  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.port = 0;
    }
  }

  /**
   * 生成成功 HTML 页面
   */
  private getSuccessHtml(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signed In &mdash; Google Antigravity Quota Watcher</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #0a0a0f;
      color: #f0f0f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    /* Animated background orbs */
    .bg-orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.18;
      animation: drift 12s ease-in-out infinite alternate;
      pointer-events: none;
    }
    .bg-orb-1 { width: 500px; height: 500px; background: #4f8cff; top: -150px; left: -150px; animation-delay: 0s; }
    .bg-orb-2 { width: 400px; height: 400px; background: #a855f7; bottom: -120px; right: -100px; animation-delay: 3s; }
    .bg-orb-3 { width: 300px; height: 300px; background: #22d3ee; top: 50%; left: 50%; transform: translate(-50%, -50%); animation-delay: 6s; }

    @keyframes drift {
      from { transform: translate(0, 0) scale(1); }
      to   { transform: translate(30px, 20px) scale(1.08); }
    }

    .card {
      position: relative;
      z-index: 10;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.10);
      border-radius: 20px;
      padding: 48px 40px;
      max-width: 420px;
      width: 90vw;
      text-align: center;
      backdrop-filter: blur(20px);
      box-shadow: 0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
      animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(24px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .logo-wrap {
      display: flex;
      justify-content: center;
      margin-bottom: 28px;
    }

    .logo-wrap img {
      width: 72px;
      height: 72px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(79, 140, 255, 0.35);
    }

    .checkmark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      border-radius: 50%;
      margin: 0 auto 24px;
      box-shadow: 0 0 0 8px rgba(34,197,94,0.12), 0 8px 24px rgba(34,197,94,0.3);
      animation: popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
    }

    @keyframes popIn {
      from { opacity: 0; transform: scale(0.5); }
      to   { opacity: 1; transform: scale(1); }
    }

    .checkmark svg { width: 28px; height: 28px; stroke: white; stroke-width: 2.5; fill: none; }

    .label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.35);
      margin-bottom: 10px;
    }

    h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 12px;
      line-height: 1.2;
    }

    p {
      font-size: 15px;
      color: rgba(255,255,255,0.55);
      line-height: 1.65;
    }

    p strong { color: rgba(255,255,255,0.85); font-weight: 600; }

    .divider {
      width: 40px;
      height: 2px;
      background: linear-gradient(90deg, #4f8cff, #a855f7);
      border-radius: 2px;
      margin: 20px auto;
    }

    .close-hint {
      margin-top: 28px;
      font-size: 12px;
      color: rgba(255,255,255,0.25);
    }
  </style>
</head>
<body>
  <div class="bg-orb bg-orb-1"></div>
  <div class="bg-orb bg-orb-2"></div>
  <div class="bg-orb bg-orb-3"></div>

  <div class="card">
    ${this.iconBase64 ? `<div class="logo-wrap"><img src="${this.iconBase64}" alt="Logo"></div>` : ''}

    <div class="checkmark">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    </div>

    <div class="label">Google Antigravity Quota Watcher</div>
    <h1>You're all set!</h1>

    <div class="divider"></div>

    <p>Your Google account has been connected successfully. Head back to <strong>VS Code</strong> &mdash; your quota data will start loading shortly.</p>

    <p class="close-hint">You can safely close this tab.</p>
  </div>
</body>
</html>`;
  }

  /**
   * 生成错误 HTML 页面
   */
  private getErrorHtml(error: string, description: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign-in Failed &mdash; Google Antigravity Quota Watcher</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #0a0a0f;
      color: #f0f0f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .bg-orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.15;
      animation: drift 12s ease-in-out infinite alternate;
      pointer-events: none;
    }
    .bg-orb-1 { width: 400px; height: 400px; background: #ef4444; top: -100px; left: -100px; animation-delay: 0s; }
    .bg-orb-2 { width: 350px; height: 350px; background: #f97316; bottom: -80px; right: -80px; animation-delay: 4s; }

    @keyframes drift {
      from { transform: translate(0, 0) scale(1); }
      to   { transform: translate(25px, 15px) scale(1.06); }
    }

    .card {
      position: relative;
      z-index: 10;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(239, 68, 68, 0.20);
      border-radius: 20px;
      padding: 48px 40px;
      max-width: 420px;
      width: 90vw;
      text-align: center;
      backdrop-filter: blur(20px);
      box-shadow: 0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
      animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(24px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .logo-wrap { display: flex; justify-content: center; margin-bottom: 28px; }
    .logo-wrap img { width: 72px; height: 72px; border-radius: 16px; opacity: 0.6; filter: grayscale(0.5); }

    .x-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #ef4444, #b91c1c);
      border-radius: 50%;
      margin: 0 auto 24px;
      box-shadow: 0 0 0 8px rgba(239,68,68,0.12), 0 8px 24px rgba(239,68,68,0.3);
      animation: popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
    }

    @keyframes popIn {
      from { opacity: 0; transform: scale(0.5); }
      to   { opacity: 1; transform: scale(1); }
    }

    .x-mark svg { width: 28px; height: 28px; stroke: white; stroke-width: 2.5; fill: none; }

    .label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 10px; }

    h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; margin-bottom: 12px; }

    p { font-size: 15px; color: rgba(255,255,255,0.55); line-height: 1.65; margin-bottom: 16px; }

    .error-code {
      margin-top: 16px;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.20);
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
      color: rgba(255,255,255,0.35);
      text-align: left;
    }

    .error-code span { color: #ef4444; }

    .divider { width: 40px; height: 2px; background: linear-gradient(90deg, #ef4444, #f97316); border-radius: 2px; margin: 20px auto; }
  </style>
</head>
<body>
  <div class="bg-orb bg-orb-1"></div>
  <div class="bg-orb bg-orb-2"></div>

  <div class="card">
    ${this.iconBase64 ? `<div class="logo-wrap"><img src="${this.iconBase64}" alt="Logo"></div>` : ''}

    <div class="x-mark">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>

    <div class="label">Google Antigravity Quota Watcher</div>
    <h1>Sign-in failed</h1>

    <div class="divider"></div>

    <p>${this.escapeHtml(description)}</p>

    <div class="error-code"><span>Error:</span> ${this.escapeHtml(error)}</div>
  </div>
</body>
</html>`;
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

