/**
 * Google OAuth 2.0 Configuration Constants
 *
 * NOTE: These credentials belong to the Google Cloud Code VS Code extension
 * and are public by design for installed/desktop OAuth applications.
 * See: https://developers.google.com/identity/protocols/oauth2/native-app
 *
 * For your own deployment, replace these with credentials from
 * https://console.cloud.google.com/apis/credentials
 */

// Google Cloud Code OAuth Client ID (public credential for installed apps)
export const GOOGLE_CLIENT_ID =
  process.env.AGY_CLIENT_ID ||
  'YOUR_GOOGLE_CLIENT_ID'; // Set AGY_CLIENT_ID env variable or replace this

// Google Cloud Code OAuth Client Secret
// For desktop apps this is NOT considered secret — see Google's documentation above
export const GOOGLE_CLIENT_SECRET =
  process.env.AGY_CLIENT_SECRET ||
  'YOUR_GOOGLE_CLIENT_SECRET'; // Set AGY_CLIENT_SECRET env variable or replace this

// OAuth 2.0 端点
export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// OAuth 权限作用域
// 需要访问 Cloud Code API 的作用域
export const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/cclog',
    'https://www.googleapis.com/auth/experimentsandconfigs',
    'https://www.googleapis.com/auth/drive.file'
].join(' ');

// Token 存储键名 (用于 VS Code SecretStorage)
export const TOKEN_STORAGE_KEY = 'antigravity-quota-watcher.google-oauth-token';

// Google Cloud Code API 端点
export const CLOUD_CODE_API_BASE = 'https://cloudcode-pa.googleapis.com';
export const LOAD_CODE_ASSIST_PATH = '/v1internal:loadCodeAssist';
export const FETCH_AVAILABLE_MODELS_PATH = '/v1internal:fetchAvailableModels';

// OAuth 回调服务器配置
export const CALLBACK_HOST = '127.0.0.1';
export const CALLBACK_PATH = '/callback';

// 超时配置 (毫秒)
export const AUTH_TIMEOUT_MS = 180000;  // 3 分钟
export const API_TIMEOUT_MS = 10000;   // 10 秒

// 重试配置
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;
