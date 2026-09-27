/**
 * 统一日志系统
 */

import * as vscode from 'vscode';

/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 0,   // 错误：严重问题，需要立即关注
  WARNING = 1, // 警告：潜在问题，但不影响正常运行
  INFO = 2,    // 信息：重要的业务流程信息
  DEBUG = 3    // 调试：详细的调试信息
}

/**
 * 日志级别名称映射
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARNING]: 'WARNING',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG'
};

/**
 * 日志服务类
 */
export class Logger {
  private static instance: Logger;
  private currentLevel: LogLevel = LogLevel.DEBUG;
  private readonly configKey = 'antigravityQuotaWatcher.logLevel';

  private constructor() {
    this.loadLogLevel();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 从配置加载日志级别
   */
  private loadLogLevel(): void {
    const config = vscode.workspace.getConfiguration();
    const levelStr = config.get<string>(this.configKey, 'DEBUG');
    this.currentLevel = this.parseLogLevel(levelStr);
  }

  /**
   * 解析日志级别字符串
   */
  private parseLogLevel(level: string): LogLevel {
    const upperLevel = level.toUpperCase();
    switch (upperLevel) {
      case 'ERROR':
        return LogLevel.ERROR;
      case 'WARNING':
        return LogLevel.WARNING;
      case 'INFO':
        return LogLevel.INFO;
      case 'DEBUG':
      default:
        return LogLevel.DEBUG;
    }
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * 获取当前日志级别
   */
  getLogLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * 监听配置变更
   */
  onConfigChange(): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(this.configKey)) {
        this.loadLogLevel();
        this.info('Logger', `Log level changed to: ${LOG_LEVEL_NAMES[this.currentLevel]}`);
      }
    });
  }

  /**
   * 判断是否应该输出日志
   */
  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel;
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, tag: string, message: string, ...args: any[]): string {
    const timestamp = this.getTimestamp();
    const levelName = LOG_LEVEL_NAMES[level];
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') : '';
    return `[${timestamp}] [${levelName}] [${tag}] ${message}${formattedArgs}`;
  }

  /**
   * 统一生成时间戳（ISO8601）
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * 输出错误日志
   */
  error(tag: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, tag, message, ...args));
    }
  }

  /**
   * 输出警告日志
   */
  warn(tag: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARNING)) {
      console.warn(this.formatMessage(LogLevel.WARNING, tag, message, ...args));
    }
  }

  /**
   * 输出信息日志
   */
  info(tag: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, tag, message, ...args));
    }
  }

  /**
   * 输出调试日志
   */
  debug(tag: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, tag, message, ...args));
    }
  }
}

/**
 * 导出全局日志实例
 */
export const logger = Logger.getInstance();
