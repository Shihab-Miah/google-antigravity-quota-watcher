/**
 * Process-based port detector.
 * Reads Antigravity Language Server command line args to extract ports and CSRF token.
 * Uses platform-specific strategies for cross-platform support.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import { PlatformDetector, IPlatformStrategy } from './platformDetector';
import { versionInfo } from '../versionInfo';
import { logger } from '../logger';

const execAsync = promisify(exec);

export interface AntigravityProcessInfo {
  /** HTTP port from --extension_server_port */
  extensionPort: number;
  /** HTTPS port for Connect/CommandModelConfigs (detected via testing) */
  connectPort: number;
  csrfToken: string;
}

export class ProcessPortDetector {
  private platformDetector: PlatformDetector;
  private platformStrategy: IPlatformStrategy;
  private processName: string;

  constructor() {
    this.platformDetector = new PlatformDetector();
    this.platformStrategy = this.platformDetector.getStrategy();
    this.processName = this.platformDetector.getProcessName();
  }

  /**
   * Detect credentials (ports + CSRF token) from the running process.
   * @param maxRetries Maximum number of retry attempts (default: 3)
   * @param retryDelay Delay between retries in milliseconds (default: 2000)
   */
  async detectProcessInfo(maxRetries: number = 3, retryDelay: number = 2000): Promise<AntigravityProcessInfo | null> {
    const platformName = this.platformDetector.getPlatformName();
    const errorMessages = this.platformStrategy.getErrorMessages();

    logger.info('PortDetector', `Starting port detection on ${platformName}, processName=${this.processName}`);

    // 在 Windows 平台显示当前使用的检测模式
    if (platformName === 'Windows') {
      const windowsStrategy = this.platformStrategy as any;
      const mode = windowsStrategy.isUsingPowerShell?.() ? 'PowerShell' : 'WMIC';
      logger.info('PortDetector', `Windows detection mode: ${mode}`);
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('PortDetector', `Attempt ${attempt}/${maxRetries}: Detecting Antigravity process...`);

        // Fetch full command line for the language server process using platform-specific command
        const command = this.platformStrategy.getProcessListCommand(this.processName);
        logger.debug('PortDetector', `Running command: ${command}`);
        const { stdout } = await execAsync(command, { timeout: 15000 });
        const preview = stdout.trim().split('\n').slice(0, 3).join(' | ');
        logger.debug('PortDetector', `Command output preview: ${preview || '(empty)'}`);

        // Parse process info using platform-specific parser
        const processInfo = this.platformStrategy.parseProcessInfo(stdout);

        if (!processInfo) {
          logger.warn('PortDetector', `Attempt ${attempt}: ${errorMessages.processNotFound}`);
          throw new Error(errorMessages.processNotFound);
        }

        const { pid, extensionPort, csrfToken } = processInfo;

        logger.info('PortDetector', `Found process: PID=${pid}, extensionPort=${extensionPort || 'N/A'}, csrfToken=${csrfToken ? '[present]' : '[missing]'}`);

        // 获取该进程监听的所有端口
        logger.debug('PortDetector', `Fetching listening ports for PID ${pid}...`);
        const listeningPorts = await this.getProcessListeningPorts(pid);

        if (listeningPorts.length === 0) {
          logger.warn('PortDetector', `Attempt ${attempt}: Process ${pid} is not listening on any ports`);
          throw new Error('Process is not listening on any ports');
        }

        logger.info('PortDetector', `Found ${listeningPorts.length} listening ports: ${listeningPorts.join(', ')}`);

        // 逐个测试端口，找到能响应 API 的端口
        logger.debug('PortDetector', 'Testing port connectivity...');
        const connectPort = await this.findWorkingPort(listeningPorts, csrfToken);

        if (!connectPort) {
          logger.warn('PortDetector', `Attempt ${attempt}: All port tests failed`);
          throw new Error('Unable to find a working API port');
        }

        logger.info('PortDetector', `Detection succeeded: connectPort=${connectPort}, extensionPort=${extensionPort}`);

        return { extensionPort, connectPort, csrfToken };

      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        logger.error('PortDetector', `Attempt ${attempt} failed: ${errorMsg}`);
        if (error?.stack) {
          logger.debug('PortDetector', `Stack: ${error.stack}`);
        }

        // 提供更具体的错误提示
        if (errorMsg.includes('timeout')) {
          logger.error('PortDetector', 'Reason: Command execution timed out; the system may be under heavy load');
        } else if (errorMsg.includes('not found') || errorMsg.includes('not recognized') || errorMsg.includes('不是内部或外部命令')) {
          logger.error('PortDetector', `Reason: ${errorMessages.commandNotAvailable}`);

          // Windows 平台特殊处理:WMIC 降级到 PowerShell
          if (this.platformDetector.getPlatformName() === 'Windows') {
            const windowsStrategy = this.platformStrategy as any;
            if (windowsStrategy.setUsePowerShell && !windowsStrategy.isUsingPowerShell()) {
              logger.warn('PortDetector', 'WMIC command is unavailable (Windows 10 21H1+/Windows 11 deprecated WMIC)');
              logger.info('PortDetector', 'Switching to PowerShell mode and retrying...');
              windowsStrategy.setUsePowerShell(true);

              // 不消耗重试次数,直接重试当前尝试
              attempt--;
              continue;
            }
          }
        }
      }

      // 如果还有重试机会,等待后重试
      if (attempt < maxRetries) {
        logger.info('PortDetector', `Waiting ${retryDelay}ms before retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    logger.error('PortDetector', `All ${maxRetries} attempts failed; requirements=${errorMessages.requirements.join(' | ')}`);

    return null;
  }

  /**
   * 获取进程监听的所有端口
   */
  private async getProcessListeningPorts(pid: number): Promise<number[]> {
    try {
      // Ensure port detection command is available before running
      await this.platformStrategy.ensurePortCommandAvailable();

      const command = this.platformStrategy.getPortListCommand(pid);
      logger.debug('PortDetector', `Running port list command for PID ${pid}: ${command}`);
      const { stdout } = await execAsync(command, { timeout: 3000 });
      const portPreview = stdout.trim().split('\n').slice(0, 5).join(' | ');
      logger.debug('PortDetector', `Port list output preview: ${portPreview || '(empty)'}`);

      // Parse ports using platform-specific parser
      const ports = this.platformStrategy.parseListeningPorts(stdout);
      logger.debug('PortDetector', `Parsed listening ports: ${ports.length > 0 ? ports.join(', ') : '(none)'}`);
      return ports;
    } catch (error: any) {
      logger.error('PortDetector', `Failed to fetch listening ports: ${error.message}`);
      return [];
    }
  }

  /**
   * 测试端口列表，找到第一个能响应 API 的端口
   */
  private async findWorkingPort(ports: number[], csrfToken: string): Promise<number | null> {
    logger.debug('PortDetector', `Testing ${ports.length} candidate ports: ${ports.join(', ') || '(none)'}`);
    for (const port of ports) {
      logger.debug('PortDetector', `Testing port ${port}...`);
      const isWorking = await this.testPortConnectivity(port, csrfToken);
      if (isWorking) {
        logger.info('PortDetector', `Port ${port} test succeeded`);
        return port;
      } else {
        logger.debug('PortDetector', `Port ${port} test failed`);
      }
    }
    return null;
  }

  /**
   * 测试端口是否能响应 API 请求
   * 使用 GetUnleashData 端点，因为它不需要用户登录即可访问
   */
  private async testPortConnectivity(port: number, csrfToken: string): Promise<boolean> {
    return new Promise((resolve) => {
      const requestBody = JSON.stringify({
        context: {
          properties: {
            devMode: "false",
            extensionVersion: versionInfo.getExtensionVersion(),
            hasAnthropicModelAccess: "true",
            ide: "antigravity",
            ideVersion: versionInfo.getIdeVersion(),
            installationId: "test-detection",
            language: "UNSPECIFIED",
            os: versionInfo.getOs(),
            requestedModelId: "MODEL_UNSPECIFIED"
          }
        }
      });

      const options = {
        hostname: '127.0.0.1',
        port: port,
        path: '/exa.language_server_pb.LanguageServerService/GetUnleashData',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'Connect-Protocol-Version': '1',
          'X-Codeium-Csrf-Token': csrfToken
        },
        rejectUnauthorized: false,
        timeout: 2000
      };

      logger.debug('PortDetector', `Sending GetUnleashData probe to port ${port}`);
      const req = https.request(options, (res) => {
        const success = res.statusCode === 200;
        logger.debug('PortDetector', `Port ${port} responded with status ${res.statusCode}`);
        res.resume();
        resolve(success);
      });

      req.on('error', (err) => {
        logger.debug('PortDetector', `Port ${port} connectivity error: ${err.message}`);
        resolve(false);
      });

      req.on('timeout', () => {
        logger.debug('PortDetector', `Port ${port} probe timed out`);
        req.destroy();
        resolve(false);
      });

      req.write(requestBody);
      req.end();
    });
  }
}
