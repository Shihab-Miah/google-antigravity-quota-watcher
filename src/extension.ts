/**
 * Antigravity Quota Watcher - main extension file
 */

import * as vscode from 'vscode';
import { QuotaService, QuotaApiMethod } from './quota/quotaService';
import { StatusBarService } from './ui/statusBar';
import { ConfigService } from './config/configService';
import { PortDetectionService, PortDetectionResult } from './platform/portDetectionService';
import { Config, QuotaSnapshot } from './types';
import { LocalizationService } from './i18n/localizationService';
import { versionInfo } from './versionInfo';
import { registerDevCommands } from './devTools';
import { GoogleAuthService, AuthState, AuthStateInfo, extractRefreshTokenFromAntigravity, hasAntigravityDb, TokenSyncChecker } from './auth';
import { logger } from './logger';
import { WebviewPanelService, DashboardState } from './ui/webviewPanel';
import { ProxyService } from './proxy/proxyService';
import { shouldAutoRedetectPort, getApiMethodFromConfig } from './utils/extensionUtils';
import { QuotaHistory } from './failsafe/quotaHistory';
import { LocalQuotaTracker } from './failsafe/localQuotaTracker';

const NON_AG_PROMPT_KEY = 'nonAgSwitchPromptDismissed';

let quotaService: QuotaService | undefined;
let statusBarService: StatusBarService | undefined;
let configService: ConfigService | undefined;
let portDetectionService: PortDetectionService | undefined;
let googleAuthService: GoogleAuthService | undefined;
let configChangeTimer: NodeJS.Timeout | undefined;  // 配置变更防抖定时器
let localTokenCheckTimer: NodeJS.Timeout | undefined;  // 未登录状态下检查本地 token 的定时器
let lastFocusRefreshTime: number = 0;  // 上次焦点刷新时间戳
let globalState: vscode.Memento | undefined;
let localQuotaTracker: LocalQuotaTracker | undefined;
const FOCUS_REFRESH_THROTTLE_MS = 3000;  // 焦点刷新节流阈值
const AUTO_REDETECT_THROTTLE_MS = 30000; // 自动重探端口节流
const LOCAL_TOKEN_CHECK_INTERVAL_MS = 30000; // 未登录状态下检查本地 token 的间隔
let lastAutoRedetectTime: number = 0;

// 缓存最后一次检测到的端口信息（用于 Dashboard 显示）
let cachedPortInfo: { connectPort?: number; httpPort?: number; csrfToken?: string } = {};
let cachedAntigravityProjectId: string | undefined;

/**
 * Called when the extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  // Initialize and print version info
  versionInfo.initialize(context);
  logger.info('Extension', `=== Antigravity Quota Watcher v${versionInfo.getExtensionVersion()} ===`);
  logger.info('Extension', `Running on: ${versionInfo.getIdeName()} v${versionInfo.getIdeVersion()}`);
  globalState = context.globalState;

  // Register logger config change listener
  context.subscriptions.push(logger.onConfigChange());

  // Init services
  configService = new ConfigService();
  let config = configService.getConfig();
  const quotaHistory = new QuotaHistory(context);
  localQuotaTracker = new LocalQuotaTracker(quotaHistory);

  // Initialize localization
  const localizationService = LocalizationService.getInstance();
  localizationService.setLanguage(config.language);

  // Initialize proxy service
  const proxyService = ProxyService.getInstance();
  proxyService.initialize();

  const isAntigravityIde = versionInfo.isAntigravityIde();

  // Init status bar
  statusBarService = new StatusBarService(
    config.warningThreshold,
    config.criticalThreshold,
    config.showPromptCredits,
    config.showPlanName,
    config.showGeminiPro,
    config.showGeminiFlash,
    config.displayStyle
  );

  // Initialize Google Auth Service (always needed for login commands)
  googleAuthService = GoogleAuthService.getInstance();
  await googleAuthService.initialize(context);

  // 根据 API 方法选择不同的初始化路径
  const apiMethod = getApiMethodFromConfig(config.apiMethod);

  // 非 Antigravity 环境且用户选择了本地 API 时，给出切换提示
  const suppressNonAgPrompt = globalState?.get<boolean>(NON_AG_PROMPT_KEY, false);
  if (!isAntigravityIde && apiMethod === QuotaApiMethod.GET_USER_STATUS && !suppressNonAgPrompt) {
    const switchLabel = localizationService.t('notify.switchToGoogleApi');
    const keepLabel = localizationService.t('notify.keepLocalApi');
    const neverLabel = localizationService.t('notify.neverShowAgain');
    const selection = await vscode.window.showInformationMessage(
      localizationService.t('notify.nonAntigravityDetected'),
      switchLabel,
      keepLabel,
      neverLabel
    );

    if (selection === switchLabel) {
      await vscode.workspace.getConfiguration('antigravityQuotaWatcher').update('apiMethod', 'GOOGLE_API', true);
      config = configService.getConfig();
    } else if (selection === neverLabel) {
      await globalState?.update(NON_AG_PROMPT_KEY, true);
    }
  }

  const resolvedApiMethod = getApiMethodFromConfig(config.apiMethod);

  if (resolvedApiMethod === QuotaApiMethod.GOOGLE_API) {
    // GOOGLE_API 方法：只需要 Google Auth，不需要端口检测
    await initializeGoogleApiMethod(context, config, localizationService);
  } else {
    // 本地 API 方法 (GET_USER_STATUS / COMMAND_MODEL_CONFIG)：需要端口检测
    await initializeLocalApiMethod(context, config, localizationService);
  }

  // Command: quick refresh quota (for success state)
  const quickRefreshQuotaCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.quickRefreshQuota',
    async () => {
      logger.debug('Extension', 'quickRefreshQuota command invoked');
      if (!quotaService) {
        // quotaService 未初始化，根据 API 模式给出不同提示
        config = configService!.getConfig();
        const currentApiMethod = getApiMethodFromConfig(config.apiMethod);

        if (currentApiMethod === QuotaApiMethod.GOOGLE_API) {
          // GOOGLE_API 模式下，提示用户需要先登录
          logger.debug('Extension', 'quotaService not initialized in GOOGLE_API mode, prompt login');
          vscode.window.showInformationMessage(
            localizationService.t('notify.pleaseLoginFirst')
          );
        } else {
          // 本地 API 模式，委托给 detectPort 命令进行重新检测
          logger.debug('Extension', 'quotaService not initialized, delegating to detectPort command');
          await vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
        }
        return;
      }

      logger.info('Extension', 'User triggered quick quota refresh');
      // 显示刷新中状态(旋转图标)
      statusBarService?.showQuickRefreshing();
      // 立即刷新一次,不中断轮询
      await quotaService.quickRefresh();
    }
  );

  // Command: refresh quota
  const refreshQuotaCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.refreshQuota',
    async () => {
      logger.debug('Extension', 'refreshQuota command invoked');
      if (!quotaService) {
        // quotaService 未初始化，根据 API 模式给出不同提示
        config = configService!.getConfig();
        const currentApiMethod = getApiMethodFromConfig(config.apiMethod);

        if (currentApiMethod === QuotaApiMethod.GOOGLE_API) {
          // GOOGLE_API 模式下，提示用户需要先登录
          logger.debug('Extension', 'quotaService not initialized in GOOGLE_API mode, prompt login');
          vscode.window.showInformationMessage(
            localizationService.t('notify.pleaseLoginFirst')
          );
        } else {
          // 本地 API 模式，委托给 detectPort 命令进行重新检测
          logger.debug('Extension', 'quotaService not initialized, delegating to detectPort command');
          await vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
        }
        return;
      }

      vscode.window.showInformationMessage(localizationService.t('notify.refreshingQuota'));
      config = configService!.getConfig();
      statusBarService?.setWarningThreshold(config.warningThreshold);
      statusBarService?.setCriticalThreshold(config.criticalThreshold);
      statusBarService?.setShowPromptCredits(config.showPromptCredits);
      statusBarService?.setShowPlanName(config.showPlanName);
      statusBarService?.setShowGeminiPro(config.showGeminiPro);
      statusBarService?.setShowGeminiFlash(config.showGeminiFlash);
      statusBarService?.setDisplayStyle(config.displayStyle);
      statusBarService?.showFetching();

      if (config.enabled) {
        quotaService.setApiMethod(getApiMethodFromConfig(config.apiMethod));
        // 使用新的重试方法,成功后会自动恢复轮询
        await quotaService.retryFromError(config.pollingInterval);
      }
    }
  );

  // Command: re-detect port
  const detectPortCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.detectPort',
    async () => {
      logger.debug('Extension', 'detectPort command invoked');

      config = configService!.getConfig();
      const currentApiMethod = getApiMethodFromConfig(config.apiMethod);

      // GOOGLE_API 方法不需要端口检测
      if (currentApiMethod === QuotaApiMethod.GOOGLE_API) {
        logger.debug('Extension', 'detectPort: GOOGLE_API method does not need port detection');
        vscode.window.showInformationMessage(
          localizationService.t('notify.googleApiNoPortDetection')
        );
        return;
      }

      // 确保 portDetectionService 已初始化
      if (!portDetectionService) {
        portDetectionService = new PortDetectionService(context);
      }

      // 使用状态栏显示检测状态，不弹窗
      statusBarService?.showDetecting();

      statusBarService?.setWarningThreshold(config.warningThreshold);
      statusBarService?.setCriticalThreshold(config.criticalThreshold);
      statusBarService?.setShowPromptCredits(config.showPromptCredits);
      statusBarService?.setShowPlanName(config.showPlanName);
      statusBarService?.setShowGeminiPro(config.showGeminiPro);
      statusBarService?.setShowGeminiFlash(config.showGeminiFlash);
      statusBarService?.setDisplayStyle(config.displayStyle);

      try {
        logger.debug('Extension', 'detectPort: invoking portDetectionService');
        const result = await portDetectionService?.detectPort();

        if (result && result.port && result.csrfToken) {
          logger.info('Extension', 'detectPort succeeded', {
            connectPort: result.connectPort,
            httpPort: result.httpPort,
            csrf: result.csrfToken ? '[present]' : '[missing]'
          });
          // 如果之前没有 quotaService,需要初始化
          if (!quotaService) {
            quotaService = new QuotaService(result.port, result.csrfToken, result.httpPort, localQuotaTracker);
            quotaService.setPorts(result.connectPort, result.httpPort);

            // 注册回调
            quotaService.onQuotaUpdate((snapshot: QuotaSnapshot) => {
              statusBarService?.updateDisplay(snapshot);
            });

            quotaService.onError((error: Error) => {
              logger.error('Extension', 'Quota fetch failed:', error);
              statusBarService?.showError(`Connection failed: ${error.message}`);
            });

            // Register auth status callback (for GOOGLE_API method)
            quotaService.onAuthStatus((needsLogin: boolean, isExpired: boolean) => {
              if (needsLogin) {
                if (isExpired) {
                  statusBarService?.showLoginExpired();
                } else {
                  statusBarService?.showNotLoggedIn();
                }
              }
            });

          } else {
            // 更新现有服务的端口
            quotaService.setPorts(result.connectPort, result.httpPort);
            quotaService.setAuthInfo(undefined, result.csrfToken);
            logger.debug('Extension', 'detectPort: updated existing QuotaService ports');
          }

          // 清除之前的错误状态
          statusBarService?.clearError();

          quotaService.stopPolling();
          quotaService.setApiMethod(getApiMethodFromConfig(config.apiMethod));
          quotaService.startPolling(config.pollingInterval);

          // 更新 Dashboard 端口信息
          cachedPortInfo = {
            connectPort: result.connectPort,
            httpPort: result.httpPort,
            csrfToken: result.csrfToken
          };
          updateDashboardState({
            connectPort: result.connectPort,
            httpPort: result.httpPort,
            csrfToken: result.csrfToken,
            lastError: undefined
          });

          vscode.window.showInformationMessage(localizationService.t('notify.detectionSuccess', { port: result.port }));
        } else {
          logger.warn('Extension', 'detectPort command did not return valid ports');
          vscode.window.showErrorMessage(
            localizationService.t('notify.unableToDetectPort') + '\n' +
            localizationService.t('notify.unableToDetectPortHint1') + '\n' +
            localizationService.t('notify.unableToDetectPortHint2')
          );
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        logger.error('Extension', 'Port detection failed', { message: errorMsg, stack: error?.stack });
        vscode.window.showErrorMessage(localizationService.t('notify.portDetectionFailed', { error: errorMsg }));
      }
    }
  );

  // Listen to config changes
  const configChangeDisposable = configService.onConfigChange((newConfig) => {
    handleConfigChange(newConfig as Config);
  });

  // 窗口焦点刷新：用户从浏览器切回 VS Code 时自动刷新配额
  // 典型场景：用户在浏览器中切换账号（普通号 -> Pro），切回时需要立即看到新配额
  const windowFocusDisposable = vscode.window.onDidChangeWindowState((e) => {
    // 仅在窗口获得焦点时触发
    if (!e.focused) {
      return;
    }

    // 检查插件是否启用
    const currentConfig = configService?.getConfig();
    if (!currentConfig?.enabled) {
      return;
    }
    // GOOGLE_API 模式无需焦点刷新，避免多余请求
    if (getApiMethodFromConfig(currentConfig.apiMethod) === QuotaApiMethod.GOOGLE_API) {
      return;
    }

    // 检查 quotaService 是否已初始化
    if (!quotaService) {
      logger.debug('FocusRefresh', 'quotaService not initialized, skipping');
      return;
    }

    // 节流：X秒内只触发一次，避免频繁刷新
    const now = Date.now();
    if (now - lastFocusRefreshTime < FOCUS_REFRESH_THROTTLE_MS) {
      logger.debug('FocusRefresh', 'Throttled, skipping refresh');
      return;
    }
    lastFocusRefreshTime = now;

    logger.debug('FocusRefresh', 'Window focused, triggering quota refresh');
    quotaService.quickRefresh();
  });

  // Command: Google Login
  const googleLoginCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.googleLogin',
    async () => {
      logger.debug('Extension', 'googleLogin command invoked');
      if (!googleAuthService) {
        vscode.window.showErrorMessage(localizationService.t('login.error.serviceNotInitialized'));
        return;
      }

      statusBarService?.showLoggingIn();
      const success = await googleAuthService.login();
      if (success) {
        // 如果当前配置为 GOOGLE_API，刷新配额
        config = configService!.getConfig();
        if (config.apiMethod === 'GOOGLE_API' && quotaService) {
          if (config.enabled) {
            await quotaService.startPolling(config.pollingInterval);
          }
          await quotaService.quickRefresh();
        }
      } else {
        // 登录失败，显示未登录状态
        statusBarService?.showNotLoggedIn();
      }
    }
  );

  // Command: Login with Local Token (from Antigravity database)
  const loginLocalTokenCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.loginLocalToken',
    async () => {
      logger.debug('Extension', 'loginLocalToken command invoked');
      if (!googleAuthService) {
        vscode.window.showErrorMessage(localizationService.t('login.error.serviceNotInitialized'));
        return;
      }

      // 检查本地 Antigravity 是否有已存储的 token
      if (!hasAntigravityDb()) {
        vscode.window.showWarningMessage(localizationService.t('login.error.localTokenImport'));
        return;
      }

      const refreshToken = await extractRefreshTokenFromAntigravity();
      if (!refreshToken) {
        vscode.window.showWarningMessage(localizationService.t('login.error.localTokenImport'));
        return;
      }

      logger.info('Extension', 'Found local Antigravity token, attempting login...');
      statusBarService?.showLoggingIn();
      const success = await googleAuthService.loginWithRefreshToken(refreshToken);

      if (success) {
        vscode.window.showInformationMessage(localizationService.t('login.success.localToken'));
        // 如果当前配置为 GOOGLE_API，刷新配额
        config = configService!.getConfig();
        if (config.apiMethod === 'GOOGLE_API' && quotaService) {
          if (config.enabled) {
            await quotaService.startPolling(config.pollingInterval);
          }
          await quotaService.quickRefresh();
        }
      } else {
        statusBarService?.showNotLoggedIn();
        vscode.window.showErrorMessage(localizationService.t('login.error.localToken', { error: 'Token invalid or expired' }));
      }
    }
  );

  // Command: Google Logout
  const googleLogoutCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.googleLogout',
    async () => {
      logger.debug('Extension', 'googleLogout command invoked');
      if (!googleAuthService) {
        return;
      }

      const wasLoggedIn = await googleAuthService.logout();
      if (wasLoggedIn) {
        vscode.window.showInformationMessage(localizationService.t('logout.success'));
      }
      // 如果当前配置为 GOOGLE_API，立即停止轮询并更新状态栏
      config = configService!.getConfig();
      if (config.apiMethod === 'GOOGLE_API') {
        quotaService?.stopPolling();
        statusBarService?.clearStale();
        statusBarService?.showNotLoggedIn();
        // 清除 Dashboard 的登录状态和配额数据
        updateDashboardState({
          isLoggedIn: false,
          quotaSnapshot: undefined
        });
      }
    }
  );

  // 监听认证状态变化
  const authStateDisposable = googleAuthService.onAuthStateChange((stateInfo: AuthStateInfo) => {
    logger.debug('Extension', 'Auth state changed:', stateInfo.state);
    const currentConfig = configService?.getConfig();
    if (currentConfig?.apiMethod !== 'GOOGLE_API') {
      return; // 不是 GOOGLE_API 模式，不处理
    }

    switch (stateInfo.state) {
      case AuthState.AUTHENTICATED:
        // 登录成功，停止本地 token 检查，刷新配额并恢复轮询
        stopLocalTokenCheckTimer();
        if (currentConfig?.enabled) {
          quotaService?.startPolling(currentConfig.pollingInterval);
          quotaService?.quickRefresh();
        }
        break;
      case AuthState.NOT_AUTHENTICATED:
        quotaService?.stopPolling();
        statusBarService?.clearStale();
        statusBarService?.showNotLoggedIn();
        // 启动本地 token 检查定时器
        startLocalTokenCheckTimer();
        // 清除 Dashboard 的登录状态和配额数据
        updateDashboardState({
          isLoggedIn: false,
          quotaSnapshot: undefined
        });
        break;
      case AuthState.TOKEN_EXPIRED:
        quotaService?.stopPolling();
        statusBarService?.clearStale();
        statusBarService?.showLoginExpired();
        // 启动本地 token 检查定时器
        startLocalTokenCheckTimer();
        break;
      case AuthState.AUTHENTICATING:
        statusBarService?.showLoggingIn();
        break;
      case AuthState.ERROR:
        statusBarService?.showError(localizationService.t('login.error.authFailed'));
        break;
    }
  });

  // Command: Open Dashboard
  const openDashboardCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.openDashboard',
    () => {
      logger.debug('Extension', 'openDashboard command invoked');
      const panel = WebviewPanelService.createOrShow(context.extensionUri);

      // 初始化 Dashboard 状态
      const currentConfig = configService?.getConfig();
      const currentApiMethod = getApiMethodFromConfig(currentConfig?.apiMethod || 'GET_USER_STATUS');
      const authState = googleAuthService?.getAuthState();

      // 从 StatusBarService 获取缓存的快照
      const cachedSnapshot = statusBarService?.getLastSnapshot();

      const initialState: DashboardState = {
        apiMethod: currentApiMethod,
        pollingInterval: currentConfig?.pollingInterval,
        isLoggedIn: authState?.state === AuthState.AUTHENTICATED,
        quotaSnapshot: cachedSnapshot,
        // 端口信息从缓存获取
        connectPort: cachedPortInfo.connectPort,
        httpPort: cachedPortInfo.httpPort,
        csrfToken: cachedPortInfo.csrfToken,
        // Google API 特有
        projectId: cachedSnapshot?.projectId,
      };

      panel.updateState(initialState);
    }
  );

  // Command: Check Weekly Limit
  const checkWeeklyLimitCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.checkWeeklyLimit',
    async (modelName?: string) => {
      logger.debug('Extension', 'checkWeeklyLimit command invoked', modelName);

      // 检查是否已登录
      if (!googleAuthService || googleAuthService.getAuthState().state !== AuthState.AUTHENTICATED) {
        vscode.window.showWarningMessage(localizationService.t('weeklyLimit.notLoggedIn'));
        return;
      }

      if (!modelName) {
        logger.warn('Extension', 'checkWeeklyLimit: no model specified');
        return;
      }

      // 导入周限检测器
      const { WeeklyLimitChecker, getQuotaPool, getPoolDisplayName } = await import('./api/weeklyLimitChecker');
      const checker = WeeklyLimitChecker.getInstance();
      const pool = getQuotaPool(modelName);
      const poolName = getPoolDisplayName(pool);

      // 显示检测中提示
      vscode.window.showInformationMessage(
        localizationService.t('weeklyLimit.checking', { model: modelName })
      );

      try {
        // 获取 access token
        const accessToken = await googleAuthService.getValidAccessToken();

        // Fetch Antigravity project ID for weekly limit checks
        const { AntigravityClient } = await import('./api/antigravityClient');
        const antigravityClient = AntigravityClient.getInstance();
        let antigravityProjectId = cachedAntigravityProjectId;
        if (!antigravityProjectId) {
          const antigravityProjectInfo = await antigravityClient.loadProjectInfo(accessToken);
          antigravityProjectId = antigravityProjectInfo.projectId;
          cachedAntigravityProjectId = antigravityProjectId;
        }
        if (!antigravityProjectId) {
          throw new Error('Antigravity projectId unavailable');
        }

        // Keep the Cloud Code project ID for logging
        let cloudProjectId = statusBarService?.getLastSnapshot()?.projectId;
        if (!cloudProjectId) {
          const { GoogleCloudCodeClient } = await import('./api/googleCloudCodeClient');
          const apiClient = GoogleCloudCodeClient.getInstance();
          const projectInfo = await apiClient.loadProjectInfo(accessToken);
          cloudProjectId = projectInfo.projectId;
        }
        logger.info(
          'Extension',
          `Weekly limit projectId: antigravity=${antigravityProjectId}, cloudcode=${cloudProjectId || 'unknown'}`
        );

        // 执行周限检测
        const result = await checker.checkModel(accessToken, antigravityProjectId, modelName);

        // 显示结果
        if (result.status === 'ok') {
          vscode.window.showInformationMessage(
            localizationService.t('weeklyLimit.ok', { pool: poolName })
          );
        } else if (result.status === 'rate_limited') {
          const totalMinutes = result.totalMinutesUntilReset ?? 0;
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          vscode.window.showWarningMessage(
            localizationService.t('weeklyLimit.rateLimited', {
              pool: poolName,
              hours: hours.toString(),
              minutes: minutes.toString()
            })
          );
        } else if (result.status === 'weekly_limited') {
          const totalMinutes = result.totalMinutesUntilReset ?? 0;
          const days = Math.floor(totalMinutes / (24 * 60));
          const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
          const minutes = totalMinutes % 60;
          vscode.window.showErrorMessage(
            localizationService.t('weeklyLimit.weeklyLimited', {
              pool: poolName,
              days: days.toString(),
              hours: hours.toString(),
              minutes: minutes.toString()
            })
          );
        } else if (result.status === 'capacity_exhausted') {
          vscode.window.showWarningMessage(
            localizationService.t('weeklyLimit.capacityExhausted', { model: result.errorMessage || modelName })
          );
        } else {
          vscode.window.showErrorMessage(
            localizationService.t('weeklyLimit.error', { error: result.errorMessage || 'Unknown error' })
          );
        }
      } catch (error: any) {
        logger.error('Extension', 'Weekly limit check failed:', error);
        vscode.window.showErrorMessage(
          localizationService.t('weeklyLimit.error', { error: error.message || String(error) })
        );
      }
    }
  );

  // Add to context subscriptions
  context.subscriptions.push(
    quickRefreshQuotaCommand,
    refreshQuotaCommand,
    detectPortCommand,
    googleLoginCommand,
    loginLocalTokenCommand,
    googleLogoutCommand,
    openDashboardCommand,
    checkWeeklyLimitCommand,
    configChangeDisposable,
    windowFocusDisposable,
    authStateDisposable,
    { dispose: () => quotaService?.dispose() },
    { dispose: () => statusBarService?.dispose() }
  );

  // 注册开发工具命令
  registerDevCommands(context);

  // Startup log
  logger.info('Extension', 'Antigravity Quota Watcher initialized');
}

/**
 * Initialize for GOOGLE_API method
 * Only requires Google Auth, no port detection needed
 */
async function initializeGoogleApiMethod(
  context: vscode.ExtensionContext,
  config: Config,
  localizationService: LocalizationService
): Promise<void> {
  logger.info('Extension', 'Initializing GOOGLE_API method (no port detection needed)');

  // 显示初始化状态
  statusBarService!.showInitializing();

  // Init quota service for Google API (no port/csrf needed)
  quotaService = new QuotaService(0, undefined, undefined, localQuotaTracker);
  quotaService.setApiMethod(QuotaApiMethod.GOOGLE_API);

  // Register callbacks
  registerQuotaServiceCallbacks();

  // Check auth state and start polling
  const authState = googleAuthService!.getAuthState();
  if (authState.state === AuthState.NOT_AUTHENTICATED) {
    // 检查本地 Antigravity 是否有已存储的 token
    if (hasAntigravityDb()) {
      logger.info('Extension', 'Detected local Antigravity installation, checking for stored token...');
      const refreshToken = await extractRefreshTokenFromAntigravity();

      if (refreshToken) {
        logger.info('Extension', 'Found local Antigravity token, prompting user...');

        // 先设置为未登录状态并启动定时器，避免弹窗自动消失时状态栏卡住
        // 因为 VS Code 的 showInformationMessage 在弹窗自动消失时 Promise 可能不会立即 resolve
        statusBarService!.showNotLoggedIn();
        statusBarService!.show();
        startLocalTokenCheckTimer();
        logger.debug('Extension', 'Pre-set status to not logged in before showing prompt');

        const useLocalToken = localizationService.t('notify.useLocalToken');
        const manualLogin = localizationService.t('notify.manualLogin');

        // 使用非阻塞方式处理弹窗，不等待用户响应
        vscode.window.showInformationMessage(
          localizationService.t('notify.localTokenDetected'),
          useLocalToken,
          manualLogin
        ).then(async (selection) => {
          if (selection === useLocalToken) {
            logger.info('Extension', 'User selected to use local token');
            stopLocalTokenCheckTimer();
            statusBarService!.showLoggingIn();
            const success = await googleAuthService!.loginWithRefreshToken(refreshToken);
            if (success) {
              // 登录成功，开始轮询
              if (config.enabled) {
                logger.info('Extension', 'GOOGLE_API: Starting quota polling after local token login...');
                statusBarService!.showFetching();
                quotaService!.startPolling(config.pollingInterval);
              }
              statusBarService!.show();
            } else {
              // 登录失败，恢复未登录状态
              logger.warn('Extension', 'Local token login failed, reverting to not logged in');
              statusBarService!.showNotLoggedIn();
              statusBarService!.show();
              startLocalTokenCheckTimer();
            }
          } else if (selection === manualLogin) {
            logger.info('Extension', 'User selected manual login');
            // 状态已经是未登录，定时器已启动，无需额外操作
          } else {
            logger.debug('Extension', 'User dismissed the prompt (selection: undefined)');
            // 弹窗被关闭或自动消失，状态已经是未登录，定时器已启动，无需额外操作
          }
        });

        // 不等待弹窗响应，直接返回
        return;
      } else {
        vscode.window.showWarningMessage(
          localizationService.t('login.error.localTokenImport')
        );
      }
    }

    // Show clear, actionable prompt so the user isn't left staring at a dead status bar
    statusBarService!.showNotLoggedIn();
    statusBarService!.show();

    // Pop a helpful notification with two clear paths instead of silent failure
    const loginBtn = 'Login with Google';
    const localApiBtn = 'Use Local Antigravity API (no login needed)';
    vscode.window.showInformationMessage(
      'Google Antigravity Quota Watcher: You are not logged in. Login with Google to see your quota, or switch to the Local API if Antigravity is running on this machine.',
      loginBtn,
      localApiBtn
    ).then(async (selection) => {
      if (selection === loginBtn) {
        vscode.commands.executeCommand('antigravity-quota-watcher.googleLogin');
      } else if (selection === localApiBtn) {
        // Switch to local API mode — no login required
        await vscode.workspace.getConfiguration('antigravityQuotaWatcher').update('apiMethod', 'GET_USER_STATUS', true);
        vscode.window.showInformationMessage(
          'Switched to Local Antigravity API. Reloading extension...',
        );
        // Trigger a reload of the extension window so the new API method takes effect
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    });

    // Start the local token check timer so we detect a login in a different session
    startLocalTokenCheckTimer();
  } else if (authState.state === AuthState.TOKEN_EXPIRED) {
    statusBarService!.showLoginExpired();
    statusBarService!.show();
    // Token 过期时也启动本地 token 检查定时器
    startLocalTokenCheckTimer();
  } else if (config.enabled) {
    logger.info('Extension', 'GOOGLE_API: Starting quota polling...');
    statusBarService!.showFetching();
    quotaService.startPolling(config.pollingInterval);
    statusBarService!.show();
  }
}

/**
 * Initialize for local API methods (GET_USER_STATUS / COMMAND_MODEL_CONFIG)
 * Requires port detection and CSRF token
 */
async function initializeLocalApiMethod(
  context: vscode.ExtensionContext,
  config: Config,
  localizationService: LocalizationService
): Promise<void> {
  logger.info('Extension', 'Initializing local API method (port detection required)');

  // Initialize port detection service
  portDetectionService = new PortDetectionService(context);

  // 显示检测状态
  statusBarService!.showDetecting();

  // Auto detect port and csrf token
  let detectedPort: number | null = null;
  let detectedCsrfToken: string | null = null;
  let detectionResult: PortDetectionResult | null = null;

  try {
    logger.info('Extension', 'Starting initial port detection');
    const result = await portDetectionService.detectPort();
    if (result) {
      detectionResult = result;
      detectedPort = result.port;
      detectedCsrfToken = result.csrfToken;
      logger.info('Extension', 'Initial port detection success:', detectionResult);
    }
  } catch (error) {
    logger.error('Extension', '❌ Port/CSRF detection failed', error);
    if (error instanceof Error && error.stack) {
      logger.error('Extension', 'Stack:', error.stack);
    }
  }

  // Ensure port and CSRF token are available
  if (!detectedPort || !detectedCsrfToken) {
    logger.error('Extension', 'Missing port or CSRF Token, extension cannot start');
    logger.error('Extension', 'Please ensure Antigravity language server is running');
    statusBarService!.showError('Port/CSRF Detection failed, Please try restart.');
    statusBarService!.show();

    // 显示用户提示,提供重试选项
    vscode.window.showWarningMessage(
      localizationService.t('notify.unableToDetectProcess'),
      localizationService.t('notify.retry'),
      localizationService.t('notify.cancel')
    ).then(action => {
      if (action === localizationService.t('notify.retry')) {
        vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
      }
    });
  } else {
    // 显示初始化状态
    statusBarService!.showInitializing();

    // Init quota service
    quotaService = new QuotaService(detectedPort, undefined, detectionResult?.httpPort, localQuotaTracker);
    quotaService.setPorts(detectionResult?.connectPort ?? detectedPort, detectionResult?.httpPort);
    quotaService.setApiMethod(getApiMethodFromConfig(config.apiMethod));

    // 更新 Dashboard 端口信息（如果面板已打开）
    cachedPortInfo = {
      connectPort: detectionResult?.connectPort ?? detectedPort,
      httpPort: detectionResult?.httpPort,
      csrfToken: detectedCsrfToken
    };
    updateDashboardState({
      apiMethod: QuotaApiMethod.GET_USER_STATUS,
      connectPort: cachedPortInfo.connectPort,
      httpPort: cachedPortInfo.httpPort,
      csrfToken: cachedPortInfo.csrfToken,
      pollingInterval: config.pollingInterval
    });

    // Register callbacks
    registerQuotaServiceCallbacks();

    // If enabled, start polling after a short delay
    if (config.enabled) {
      logger.info('Extension', 'Starting quota polling after delay...');
      statusBarService!.showFetching();

      setTimeout(() => {
        quotaService?.setAuthInfo(undefined, detectedCsrfToken);
        quotaService?.startPolling(config.pollingInterval);
      }, 8000);

      statusBarService!.show();
    }
  }
}

/**
 * 启动本地 token 检查定时器（未登录状态下使用）
 * 定期检查本地 Antigravity 是否有可用的 token
 */
function startLocalTokenCheckTimer(): void {
  // 只在 GOOGLE_API 模式下启动
  const config = configService?.getConfig();
  if (config?.apiMethod !== 'GOOGLE_API') {
    // 如果不是 GOOGLE_API 模式，确保清理已存在的定时器
    stopLocalTokenCheckTimer();
    return;
  }

  // 如果已经在运行，不重复启动
  if (localTokenCheckTimer) {
    logger.debug('LocalTokenCheck', 'Timer already running');
    return;
  }

  logger.info('LocalTokenCheck', 'Starting local token check timer');
  const tokenSyncChecker = TokenSyncChecker.getInstance();

  localTokenCheckTimer = setInterval(async () => {
    logger.debug('LocalTokenCheck', 'Checking for local token...');
    await tokenSyncChecker.checkLocalTokenWhenNotLoggedIn(
      // onLocalTokenLogin: 本地 token 登录成功
      () => {
        logger.info('LocalTokenCheck', 'Local token login successful');
        stopLocalTokenCheckTimer();
        const currentConfig = configService?.getConfig();
        if (currentConfig?.enabled && quotaService) {
          statusBarService?.showFetching();
          quotaService.startPolling(currentConfig.pollingInterval);
        }
      }
    );
  }, LOCAL_TOKEN_CHECK_INTERVAL_MS);
}

/**
 * 停止本地 token 检查定时器
 */
function stopLocalTokenCheckTimer(): void {
  if (localTokenCheckTimer) {
    logger.debug('LocalTokenCheck', 'Stopping local token check timer');
    clearInterval(localTokenCheckTimer);
    localTokenCheckTimer = undefined;
  }
}

/**
 * 更新 Dashboard 状态（如果面板已打开）
 */
function updateDashboardState(partialState: Partial<DashboardState>): void {
  if (WebviewPanelService.currentPanel) {
    WebviewPanelService.currentPanel.updateState(partialState);
  }
}

/**
 * Register common callbacks for quota service
 */
function registerQuotaServiceCallbacks(): void {
  if (!quotaService || !statusBarService) {
    return;
  }

  // Register quota update callback
  quotaService.onQuotaUpdate((snapshot: QuotaSnapshot) => {
    statusBarService?.updateDisplay(snapshot);

    // 更新 Dashboard
    updateDashboardState({
      quotaSnapshot: snapshot,
      lastError: undefined,
      projectId: snapshot.projectId
    });

    // 对于 GOOGLE_API 方法，检查 Token 同步状态
    const apiMethod = quotaService?.getApiMethod();
    if (apiMethod === QuotaApiMethod.GOOGLE_API) {
      const tokenSyncChecker = TokenSyncChecker.getInstance();
      tokenSyncChecker.checkAndHandle(
        // onTokenChanged: 刷新配额
        () => {
          quotaService?.quickRefresh();
        },
        // onLogout: 停止轮询，显示未登录，启动本地 token 检查
        () => {
          quotaService?.stopPolling();
          statusBarService?.clearStale();
          statusBarService?.showNotLoggedIn();
          startLocalTokenCheckTimer();
          updateDashboardState({ isLoggedIn: false });
        },
        // onLocalTokenLogin: 本地 token 登录成功，停止检查定时器，开始轮询
        () => {
          stopLocalTokenCheckTimer();
          const config = configService?.getConfig();
          if (config?.enabled) {
            quotaService?.startPolling(config.pollingInterval);
          }
          updateDashboardState({ isLoggedIn: true });
        }
      );
    }
  });

  // Register error callback (silent, only update status bar)
  quotaService.onError((error: Error) => {
    logger.error('Extension', 'Quota fetch failed:', error);
    statusBarService?.showError(`Connection failed: ${error.message}`);

    // 更新 Dashboard 错误状态
    updateDashboardState({ lastError: error.message });

    // 自动重探：本地 API 且疑似端口/CSRF 失效时，节流触发 detectPort
    const apiMethod = quotaService?.getApiMethod();
    if (shouldAutoRedetectPort(error, apiMethod)) {
      const now = Date.now();
      if (now - lastAutoRedetectTime >= AUTO_REDETECT_THROTTLE_MS) {
        lastAutoRedetectTime = now;
        vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
      } else {
        logger.debug('AutoRedetect', 'Throttled; skip detectPort this time');
      }
    }
  });

  // Register status callback
  quotaService.onStatus((status: 'fetching' | 'retrying', retryCount?: number) => {
    if (status === 'fetching') {
      statusBarService?.showFetching();
    } else if (status === 'retrying' && retryCount !== undefined) {
      statusBarService?.showRetrying(retryCount, 3); // MAX_RETRY_COUNT = 3
    }
  });

  // Register auth status callback (for GOOGLE_API method)
  quotaService.onAuthStatus((needsLogin: boolean, isExpired: boolean) => {
    if (needsLogin) {
      if (isExpired) {
        statusBarService?.showLoginExpired();
      } else {
        statusBarService?.showNotLoggedIn();
      }
      // 未登录或 token 过期时，启动本地 token 检查定时器
      startLocalTokenCheckTimer();
      updateDashboardState({ isLoggedIn: false });
    } else {
      // 已登录，停止本地 token 检查定时器
      stopLocalTokenCheckTimer();
      updateDashboardState({ isLoggedIn: true });
    }
  });

  // Register stale status callback (for GOOGLE_API method - network issues)
  quotaService.onStaleStatus((isStale: boolean) => {
    if (isStale) {
      statusBarService?.showStale();
    } else {
      statusBarService?.clearStale();
    }
  });
}

/**
 * Handle config changes with debounce to prevent race conditions
 */
function handleConfigChange(config: Config): void {
  // 防抖：300ms 内的多次变更只执行最后一次
  if (configChangeTimer) {
    clearTimeout(configChangeTimer);
  }

  configChangeTimer = setTimeout(async () => {
    logger.info('ConfigChange', 'Config updated (debounced)', config);

    const newApiMethod = getApiMethodFromConfig(config.apiMethod);
    const localizationService = LocalizationService.getInstance();
    const isAntigravityIde = versionInfo.isAntigravityIde();
    const suppressNonAgPrompt = globalState?.get<boolean>(NON_AG_PROMPT_KEY, false);

    // Update status bar settings
    statusBarService?.setWarningThreshold(config.warningThreshold);
    statusBarService?.setCriticalThreshold(config.criticalThreshold);
    statusBarService?.setShowPromptCredits(config.showPromptCredits);
    statusBarService?.setShowPlanName(config.showPlanName);
    statusBarService?.setShowGeminiPro(config.showGeminiPro);
    statusBarService?.setShowGeminiFlash(config.showGeminiFlash);
    statusBarService?.setDisplayStyle(config.displayStyle);

    // Update language
    if (localizationService.getLanguage() !== config.language) {
      localizationService.setLanguage(config.language);
    }

    // 非 Antigravity 环境切换到本地 API 时提示用户
    const currentApiMethod = quotaService?.getApiMethod();
    if (
      !isAntigravityIde &&
      newApiMethod === QuotaApiMethod.GET_USER_STATUS &&
      currentApiMethod !== QuotaApiMethod.GET_USER_STATUS &&
      !suppressNonAgPrompt
    ) {
      const switchLabel = localizationService.t('notify.switchToGoogleApi');
      const keepLabel = localizationService.t('notify.keepLocalApi');
      const neverLabel = localizationService.t('notify.neverShowAgain');
      const selection = await vscode.window.showInformationMessage(
        localizationService.t('notify.nonAntigravityDetected'),
        switchLabel,
        keepLabel,
        neverLabel
      );

      if (selection === switchLabel) {
        await vscode.workspace.getConfiguration('antigravityQuotaWatcher').update('apiMethod', 'GOOGLE_API', true);
        return;
      } else if (selection === neverLabel) {
        await globalState?.update(NON_AG_PROMPT_KEY, true);
      }
    }

    // 更新 Dashboard 的 API 方法状态
    updateDashboardState({
      apiMethod: newApiMethod,
      pollingInterval: config.pollingInterval
    });

    // Handle API method change
    if (quotaService) {
      const currentApiMethod = quotaService.getApiMethod();
      quotaService.setApiMethod(newApiMethod);

      // 如果切换到 GOOGLE_API，检查认证状态
      if (newApiMethod === QuotaApiMethod.GOOGLE_API && googleAuthService) {
        const authState = googleAuthService.getAuthState();
        // 更新 Dashboard 登录状态
        updateDashboardState({
          isLoggedIn: authState.state === AuthState.AUTHENTICATED
        });

        if (authState.state === AuthState.NOT_AUTHENTICATED) {
          quotaService.stopPolling();

          // 检查本地 Antigravity 是否有已存储的 token
          if (hasAntigravityDb()) {
            logger.info('ConfigChange', 'Detected local Antigravity installation, checking for stored token...');
            const refreshToken = await extractRefreshTokenFromAntigravity();

            if (refreshToken) {
              logger.info('ConfigChange', 'Found local Antigravity token, prompting user...');
              const useLocalToken = localizationService.t('notify.useLocalToken');
              const manualLogin = localizationService.t('notify.manualLogin');

              const selection = await vscode.window.showInformationMessage(
                localizationService.t('notify.localTokenDetected'),
                useLocalToken,
                manualLogin
              );

              if (selection === useLocalToken) {
                statusBarService?.showLoggingIn();
                const success = await googleAuthService.loginWithRefreshToken(refreshToken);
                if (success) {
                  // 登录成功，开始轮询
                  if (config.enabled) {
                    quotaService.startPolling(config.pollingInterval);
                  }
                  statusBarService?.show();
                  vscode.window.showInformationMessage(localizationService.t('notify.configUpdated'));
                  return;
                }
                // 登录失败，继续显示未登录状态
              }
              // 用户选择手动登录或关闭弹窗，显示未登录状态
            } else {
              vscode.window.showWarningMessage(
                localizationService.t('login.error.localTokenImport')
              );
            }
          }

          statusBarService?.showNotLoggedIn();
          statusBarService?.show();
          vscode.window.showInformationMessage(localizationService.t('notify.configUpdated'));
          return;
        } else if (authState.state === AuthState.TOKEN_EXPIRED) {
          quotaService.stopPolling();
          statusBarService?.showLoginExpired();
          statusBarService?.show();
          vscode.window.showInformationMessage(localizationService.t('notify.configUpdated'));
          return;
        }
      }

      // 如果从 GOOGLE_API 切换到本地 API 方法，需要检测端口和获取 CSRF token
      if (currentApiMethod === QuotaApiMethod.GOOGLE_API && newApiMethod !== QuotaApiMethod.GOOGLE_API) {
        logger.info('ConfigChange', 'Switching from GOOGLE_API to local API, need port detection');
        quotaService.stopPolling();
        stopLocalTokenCheckTimer();
        statusBarService?.showDetecting();

        // 同步执行端口检测，确保完成后再返回
        try {
          // 确保 portDetectionService 已初始化
          if (!portDetectionService) {
            // 需要 context，但这里拿不到，所以触发命令
            await vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
            return;
          }

          const result = await portDetectionService.detectPort();
          if (result && result.port && result.csrfToken) {
            logger.info('ConfigChange', 'Port detection success:', result);
            quotaService.setPorts(result.connectPort, result.httpPort);
            quotaService.setAuthInfo(undefined, result.csrfToken);
            statusBarService?.clearError();

            // 更新 Dashboard 端口信息
            cachedPortInfo = {
              connectPort: result.connectPort,
              httpPort: result.httpPort,
              csrfToken: result.csrfToken
            };
            updateDashboardState({
              connectPort: result.connectPort,
              httpPort: result.httpPort,
              csrfToken: result.csrfToken,
              lastError: undefined
            });

            if (config.enabled) {
              quotaService.startPolling(config.pollingInterval);
            }
            vscode.window.showInformationMessage(localizationService.t('notify.configUpdated'));
          } else {
            logger.warn('ConfigChange', 'Port detection failed, no valid result');
            statusBarService?.showError('Port/CSRF Detection failed');
            const action = await vscode.window.showWarningMessage(
              localizationService.t('notify.unableToDetectPort'),
              localizationService.t('notify.retry')
            );
            if (action === localizationService.t('notify.retry')) {
              vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
            }
          }
        } catch (error: any) {
          logger.error('ConfigChange', 'Port detection error:', error);
          statusBarService?.showError(`Detection failed: ${error.message}`);
        }
        return;
      }
    }

    if (config.enabled) {
      quotaService?.startPolling(config.pollingInterval);
      statusBarService?.show();
    } else {
      quotaService?.stopPolling();
      statusBarService?.hide();
    }

    vscode.window.showInformationMessage(localizationService.t('notify.configUpdated'));
  }, 300);
}

/**
 * Called when the extension is deactivated
 */
export function deactivate() {
  logger.info('Extension', 'Antigravity Quota Watcher deactivated');
  stopLocalTokenCheckTimer();
  quotaService?.dispose();
  statusBarService?.dispose();
}
