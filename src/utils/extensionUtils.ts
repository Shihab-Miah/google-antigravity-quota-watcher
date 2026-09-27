/**
 * Extension utility functions
 */

import { QuotaApiMethod } from '../quota/quotaService';

/**
 * 判断是否需要自动重探端口/CSRF
 * 仅在本地 API 模式下对端口/CSRF/连接错误触发
 */
export function shouldAutoRedetectPort(error: Error, apiMethod: QuotaApiMethod | undefined): boolean {
  if (!apiMethod || apiMethod === QuotaApiMethod.GOOGLE_API) {
    return false;
  }

  const msg = (error?.message || '').toLowerCase();
  if (!msg) {
    return false;
  }

  return (
    error.name === 'QuotaInvalidCodeError' ||
    msg.includes('missing csrf') ||
    msg.includes('csrf token') ||
    msg.includes('connection refused') ||
    msg.includes('econnrefused') ||
    msg.includes('socket') ||
    msg.includes('port') ||
    (msg.includes('http error') && msg.includes('403')) ||
    msg.includes('invalid response code')
  );
}

/**
 * Convert config apiMethod string to QuotaApiMethod enum
 */
export function getApiMethodFromConfig(apiMethod: string): QuotaApiMethod {
  switch (apiMethod) {
    //     case 'COMMAND_MODEL_CONFIG':
    //       return QuotaApiMethod.COMMAND_MODEL_CONFIG;
    case 'GOOGLE_API':
      return QuotaApiMethod.GOOGLE_API;
    case 'GET_USER_STATUS':
    default:
      return QuotaApiMethod.GET_USER_STATUS;
  }
}
