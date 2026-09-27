/**
 * Antigravity Quota Watcher - type definitions
 */

export interface ModelConfig {
  label: string;
  modelOrAlias: {
    model: string;
  };
  quotaInfo?: {
    remainingFraction?: number;
    resetTime: string;
  };
  supportsImages?: boolean;
  isRecommended?: boolean;
  allowedTiers?: string[];
}

export interface UserStatusResponse {
  userStatus: {
    name: string;
    email: string;
    planStatus?: {
      planInfo: {
        teamsTier: string;
        planName: string;
        monthlyPromptCredits: number;
        monthlyFlowCredits: number;
      };
      availablePromptCredits: number;
      availableFlowCredits: number;
    };
    cascadeModelConfigData?: {
      clientModelConfigs: ModelConfig[];
    };
    // 账号级别信息（如 Free、Pro）
    userTier?: {
      id: string;
      name: string;
      description: string;
    };
  };
}

export interface PromptCreditsInfo {
  available: number;
  monthly: number;
  usedPercentage: number;
  remainingPercentage: number;
}

export interface ModelQuotaInfo {
  label: string;
  modelId: string;
  remainingFraction?: number;
  remainingPercentage?: number;
  isExhausted: boolean;
  resetTime: Date;
  timeUntilReset: number;
  timeUntilResetFormatted: string;
  ratePerHour?: number;
  estimatedDepletionTimeMs?: number | null;
}

export interface QuotaSnapshot {
  timestamp: Date;
  promptCredits?: PromptCreditsInfo;
  models: ModelQuotaInfo[];
  planName?: string;
  userEmail?: string;  // Google 账号邮箱 (仅 GOOGLE_API 方法)
  projectId?: string;  // Google Cloud Project ID (仅 GOOGLE_API 方法)
  isStale?: boolean;   // 数据是否过时 (网络问题或超时)
}

export enum QuotaLevel {
  Normal = 'normal',
  Warning = 'warning',
  Critical = 'critical',
  Depleted = 'depleted'
}

export type ApiMethodPreference = /* 'COMMAND_MODEL_CONFIG' | */ 'GET_USER_STATUS' | 'GOOGLE_API';

/**
 * 代理配置
 */
export interface ProxyConfig {
  enabled: boolean;      // 代理开关
  autoDetect: boolean;   // 自动检测系统代理
  url: string;           // 代理 URL (手动填写或自动检测)
}

export interface Config {
  enabled: boolean;
  pollingInterval: number;
  warningThreshold: number;
  criticalThreshold: number;
  apiMethod: ApiMethodPreference;
  showPromptCredits: boolean;
  showPlanName: boolean;
  showGeminiPro: boolean;
  showGeminiFlash: boolean;
  displayStyle: 'percentage' | 'progressBar' | 'dots' | 'bulbs';
  language: 'auto' | 'en' | 'zh-cn';
  logLevel: 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';
  proxy: ProxyConfig;  // 代理配置
}
