/**
 * Status bar service
 */

import * as vscode from 'vscode';
import { ModelQuotaInfo, QuotaSnapshot } from '../types';
import { LocalizationService } from '../i18n/localizationService';

export class StatusBarService {
  private notifiedModels: Set<string> = new Set();
  private statusBarItem: vscode.StatusBarItem;
  private warningThreshold: number;
  private criticalThreshold: number;
  private showPromptCredits: boolean;
  private showPlanName: boolean;
  private showGeminiPro: boolean;
  private showGeminiFlash: boolean;
  private displayStyle: 'percentage' | 'progressBar' | 'dots' | 'stars';
  private localizationService: LocalizationService;
  /** ???? tooltip ?????????,???? prepend */
  private hasStaleWarning: boolean = false;

  private isQuickRefreshing: boolean = false;
  private refreshStartTime: number = 0;
  private readonly minRefreshDuration: number = 1000;

  /** ??????????? */
  private lastSnapshot: QuotaSnapshot | undefined;

  constructor(
    warningThreshold: number = 50,
    criticalThreshold: number = 30,
    showPromptCredits: boolean = false,
    showPlanName: boolean = false,
    showGeminiPro: boolean = true,
    showGeminiFlash: boolean = true,
    displayStyle: 'percentage' | 'progressBar' | 'dots' | 'stars' = 'progressBar'
  ) {
    this.localizationService = LocalizationService.getInstance();
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'antigravity-quota-watcher.showQuota';
    this.warningThreshold = warningThreshold;
    this.criticalThreshold = criticalThreshold;
    this.showPromptCredits = showPromptCredits;
    this.showPlanName = showPlanName;
    this.showGeminiPro = showGeminiPro;
    this.showGeminiFlash = showGeminiFlash;
    this.displayStyle = displayStyle;
  }

  updateDisplay(snapshot: QuotaSnapshot): void {
    // Check if we need to wait for the minimum animation duration
    if (this.isQuickRefreshing && this.refreshStartTime > 0) {
      const elapsed = Date.now() - this.refreshStartTime;
      if (elapsed < this.minRefreshDuration) {
        const remaining = this.minRefreshDuration - elapsed;
        setTimeout(() => {
          this.updateDisplay(snapshot);
        }, remaining);
        return;
      }
    }

    // ???????
    this.lastSnapshot = snapshot;

    // ??????
    this.isQuickRefreshing = false;
    this.refreshStartTime = 0;
    // ?????????,??????????
    this.statusBarItem.command = 'antigravity-quota-watcher.quickRefreshQuota';

    const parts: string[] = [];

    // Display Plan Name if available and enabled
    if (this.showPlanName && snapshot.planName) {
      const planNameFormatted = this.formatPlanName(snapshot.planName);
      parts.push(`Plan: ${planNameFormatted}`);
    }

    if (this.showPromptCredits && snapshot.promptCredits) {
      const { available, monthly, remainingPercentage } = snapshot.promptCredits;
      const indicator = this.getStatusIndicator(remainingPercentage);
      const creditsPart = `${indicator} ?? ${available}/${this.formatNumber(monthly)} (${remainingPercentage.toFixed(0)}%)`;
      parts.push(creditsPart);
    }

    const modelsToShow = this.selectModelsToDisplay(snapshot.models);

    for (const model of modelsToShow) {
      const emoji = this.getModelEmoji(model.label);
      const shortName = this.getShortModelName(model.label);
      const indicator = this.getStatusIndicator(model.remainingPercentage ?? 0);

      if (model.isExhausted) {
        if (this.displayStyle === 'percentage') {
          parts.push(`${indicator} ${emoji} ${shortName}: 0%`);
        } else if (this.displayStyle === 'dots') {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getDotsBar(0)}`);
        } else {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getProgressBar(0)}`);
        }
      } else if (model.remainingPercentage !== undefined) {
        if (this.displayStyle === 'percentage') {
          parts.push(`${indicator} ${emoji} ${shortName}: ${model.remainingPercentage.toFixed(0)}%`);
        } else if (this.displayStyle === 'dots') {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getDotsBar(model.remainingPercentage)}`);
        } else {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getProgressBar(model.remainingPercentage)}`);
        }
      }
    }

    if (parts.length === 0) {
      this.statusBarItem.text = this.localizationService.t('status.error');
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = this.localizationService.t('tooltip.error');
    } else {
      // Use space as separator
      const displayText = parts.join('  ');
      this.statusBarItem.text = displayText;
      // ???????,????
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.color = undefined;
      this.updateTooltip(snapshot);
    }

    this.statusBarItem.show();
  }

  /**
   * ???????????????
   * ?? > warningThreshold (??50%)
   * ?? criticalThreshold < percentage <= warningThreshold (??30%-50%)
   * ?? 0 < percentage <= criticalThreshold (??<30%)
   * ? percentage <= 0
   */
  private getStatusIndicator(percentage: number): string {
    if (percentage <= 0) {
      return '$(stop)'; // Depleted
    } else if (percentage <= this.criticalThreshold) {
      return '$(error)'; // Critical
    } else if (percentage <= this.warningThreshold) {
      return '$(warning)'; // Warning
    }
    return '$(pass-filled)'; // Normal
  }

  setWarningThreshold(threshold: number): void {
    this.warningThreshold = threshold;
  }

  setCriticalThreshold(threshold: number): void {
    this.criticalThreshold = threshold;
  }

  setShowPromptCredits(value: boolean): void {
    this.showPromptCredits = value;
  }

  setShowPlanName(value: boolean): void {
    this.showPlanName = value;
  }

  setShowGeminiPro(value: boolean): void {
    this.showGeminiPro = value;
  }

  setShowGeminiFlash(value: boolean): void {
    this.showGeminiFlash = value;
  }

  setDisplayStyle(value: 'percentage' | 'progressBar' | 'dots' | 'stars'): void {
    this.displayStyle = value;
  }

  /** ????????????? */
  getLastSnapshot(): QuotaSnapshot | undefined {
    return this.lastSnapshot;
  }

  private updateTooltip(snapshot: QuotaSnapshot): void {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;
    // ??? tooltip ?,????????
    this.hasStaleWarning = false;

    const titleSuffix = snapshot.planName ? ` (${snapshot.planName})` : '';
    md.appendMarkdown(`${this.localizationService.t('tooltip.title')}${titleSuffix}\n\n`);

    // ?? Google ???? (? GOOGLE_API ??)
    if (snapshot.userEmail) {
      md.appendMarkdown(`?? ${snapshot.userEmail}\n\n`);
    }

    if (this.showPromptCredits && snapshot.promptCredits) {
      md.appendMarkdown(`${this.localizationService.t('tooltip.credits')}\n`);
      // Use a list for better alignment
      md.appendMarkdown(`- ${this.localizationService.t('tooltip.available')}: \`${snapshot.promptCredits.available} / ${snapshot.promptCredits.monthly}\`\n`);
      md.appendMarkdown(`- ${this.localizationService.t('tooltip.remaining')}: **${snapshot.promptCredits.remainingPercentage.toFixed(1)}%**\n\n`);
    }

    // ???????????,?????????
    const sortedModels = [...snapshot.models].sort((a, b) => a.label.localeCompare(b.label));

    if (sortedModels.length > 0) {
      md.appendMarkdown(`| ${this.localizationService.t('tooltip.model')} | ${this.localizationService.t('tooltip.status')} | ${this.localizationService.t('tooltip.resetTime')} |\n`);
      md.appendMarkdown(`| :--- | :--- | :--- |\n`);

      for (const model of sortedModels) {
        const emoji = this.getModelEmoji(model.label);
        const name = model.label; // Full name in tooltip

        let status = '';
        if (model.isExhausted) {
          status = this.localizationService.t('tooltip.depleted');
        } else if (model.remainingPercentage !== undefined) {
          status = `${model.remainingPercentage.toFixed(1)}%`;
        }

        md.appendMarkdown(`| ${emoji} ${name} | ${status} | ${model.timeUntilResetFormatted} |\n`);
      }
    }

    this.statusBarItem.tooltip = md;
  }

  private selectModelsToDisplay(models: ModelQuotaInfo[]): ModelQuotaInfo[] {
    const result: ModelQuotaInfo[] = [];

    // 1. Claude - ???? Thinking ??,?????? Thinking ??
    const claude = models.find(model => this.isClaudeWithoutThinking(model.label))
      || models.find(model => model.label.toLowerCase().includes('claude'));
    if (claude) {
      result.push(claude);
    }

    // 2. Gemini Pro (Low) - ??????????
    if (this.showGeminiPro) {
      const proLow = models.find(model => this.isProLow(model.label));
      if (proLow && !result.includes(proLow)) {
        result.push(proLow);
      }
    }

    // 3. Gemini Flash - ??????????
    if (this.showGeminiFlash) {
      const flash = models.find(model => this.isGemini3Flash(model.label));
      if (flash && !result.includes(flash)) {
        result.push(flash);
      }
    }

    return result;
  }

  private isProLow(label: string): boolean {
    const lower = label.toLowerCase();
    return lower.includes('pro') && lower.includes('low');
  }

  private isGemini3Flash(label: string): boolean {
    const lower = label.toLowerCase();
    return lower.includes('gemini') && lower.includes('flash');
  }

  private isClaudeWithoutThinking(label: string): boolean {
    const lower = label.toLowerCase();
    return lower.includes('claude') && !lower.includes('thinking');
  }

  private formatNumber(num: number): string {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}k`;
    }
    return num.toString();
  }

  private getModelEmoji(label: string): string {
    if (label.includes('Claude')) {
      return '$(hubot)';
    }
    if (label.includes('Gemini') && label.includes('Flash')) {
      return '$(zap)';
    }
    if (label.includes('Gemini') && label.includes('Pro')) {
      return '$(sparkle)';
    }
    if (label.includes('GPT')) {
      return '$(lightbulb)';
    }
    return '$(server)';
  }

  private getShortModelName(label: string): string {
    if (label.includes('Claude')) {
      return 'Claude';
    }
    // Gemini Flash ??? G Flash
    if (label.includes('Gemini') && label.includes('Flash')) {
      return 'G Flash';
    }
    // Gemini Pro ??? G Pro
    if (label.includes('Pro (High)') || label.includes('Pro (Low)') || label.includes('Pro')) {
      return 'G Pro';
    }
    if (label.includes('GPT')) {
      return 'GPT';
    }

    return label.split(' ')[0];
  }


  private getStarsBar(percentage: number, count: number = 5): string {
    const filled = Math.round((percentage / 100) * count);
    const empty = count - filled;
    return `${"$(star-full)".repeat(filled)}${"$(star-empty)".repeat(empty)}`;
  }

  private getProgressBar(percentage: number): string {
    const p = Math.max(0, Math.min(100, percentage));
    const totalBlocks = 8;
    const filledBlocks = Math.round((p / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    return `[${`=`.repeat(filledBlocks)}${` `.repeat(emptyBlocks)}]`;
  }

  private getDotsBar(percentage: number): string {
    const p = Math.max(0, Math.min(100, percentage));
    const totalDots = 5;
    const filledDots = Math.round((p / 100) * totalDots);
    const emptyDots = totalDots - filledDots;
    return `${"$(circle-filled)".repeat(filledDots)}${"$(circle-large-outline)".repeat(emptyDots)}`;
  }

  private formatPlanName(rawName: string): string {
    // Display as-is from API response
    return rawName;
  }

  /**
   * ???????? - ??????????????
   */
  showQuickRefreshing(): void {
    if (this.isQuickRefreshing) {
      return; // ???????
    }
    this.isQuickRefreshing = true;
    this.refreshStartTime = Date.now();

    // ????????????
    const currentText = this.statusBarItem.text;
    if (!currentText.startsWith('$(sync~spin)')) {
      this.statusBarItem.text = `${this.localizationService.t('status.refreshing')}`;
    }
    // Tooltip handling for string | MarkdownString is tricky, for simple refreshing just keep it simple or append if string
    // Simplified for robustness:
    this.statusBarItem.tooltip = this.localizationService.t('status.refreshing');
    this.statusBarItem.show();
  }

  showDetecting(): void {
    this.statusBarItem.text = this.localizationService.t('status.detecting');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = this.localizationService.t('status.detecting');
    this.statusBarItem.show();
  }

  showInitializing(): void {
    this.statusBarItem.text = this.localizationService.t('status.initializing');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = this.localizationService.t('status.initializing');
    this.statusBarItem.show();
  }

  showFetching(): void {
    this.statusBarItem.text = this.localizationService.t('status.fetching');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = this.localizationService.t('status.fetching');
    this.statusBarItem.show();
  }

  showRetrying(currentRetry: number, maxRetries: number): void {
    this.statusBarItem.text = this.localizationService.t('status.retrying', { current: currentRetry, max: maxRetries });
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.statusBarItem.tooltip = this.localizationService.t('status.retrying', { current: currentRetry, max: maxRetries });
    this.statusBarItem.show();
  }

  showError(message: string): void {
    this.statusBarItem.text = this.localizationService.t('status.error');
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    this.statusBarItem.tooltip = `${message}\n\n${this.localizationService.t('tooltip.clickToRetry')}`;
    // ?????????
    this.statusBarItem.command = 'antigravity-quota-watcher.refreshQuota';
    this.statusBarItem.show();
  }

  clearError(): void {
    this.statusBarItem.text = this.localizationService.t('status.fetching');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = this.localizationService.t('status.fetching');
    this.statusBarItem.show();
  }

  /**
   * ??????? (GOOGLE_API ??)
   */
  showNotLoggedIn(): void {
    this.statusBarItem.text = this.localizationService.t('status.notLoggedIn');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = this.localizationService.t('tooltip.clickToLogin');
    this.statusBarItem.command = 'antigravity-quota-watcher.googleLogin';
    this.statusBarItem.show();
  }

  /**
   * ??????? (GOOGLE_API ??)
   */
  showLoggingIn(): void {
    this.statusBarItem.text = this.localizationService.t('status.loggingIn');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = this.localizationService.t('status.loggingIn');
    this.statusBarItem.command = undefined;
    this.statusBarItem.show();
  }

  /**
   * ???????? (GOOGLE_API ??)
   */
  showLoginExpired(): void {
    this.statusBarItem.text = this.localizationService.t('status.loginExpired');
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.statusBarItem.tooltip = this.localizationService.t('tooltip.clickToRelogin');
    this.statusBarItem.command = 'antigravity-quota-watcher.googleLogin';
    this.statusBarItem.show();
  }

  /**
   * ???????? (???????)
   * ???????????,??????????
   */
  showStale(): void {
    // ???????,???????????
    if (this.isQuickRefreshing && this.lastSnapshot) {
      // ??????
      this.isQuickRefreshing = false;
      this.refreshStartTime = 0;
      // ??????(??? updateDisplay ?????)
      this.rebuildDisplayFromSnapshot(this.lastSnapshot);
    }

    // ??????????,???????,????�???�
    if (!this.lastSnapshot) {
      this.showError(this.localizationService.t('tooltip.error'));
      return;
    }

    const currentText = this.statusBarItem.text;
    const staleIcon = this.localizationService.t('status.stale');
    // ??????
    if (!currentText.startsWith(staleIcon)) {
      this.statusBarItem.text = `${staleIcon} ${currentText}`;
    }
    // ?? tooltip ??????
    const currentTooltip = this.statusBarItem.tooltip;
    if (currentTooltip instanceof vscode.MarkdownString) {
      if (this.hasStaleWarning) {
        this.statusBarItem.show();
        return; // ???????,????
      }
      const staleWarning = this.localizationService.t('tooltip.staleWarning');
      // ???????
      const newMd = new vscode.MarkdownString();
      newMd.isTrusted = true;
      newMd.supportHtml = true;
      newMd.appendMarkdown(`${staleWarning}\n\n`);
      newMd.appendMarkdown(currentTooltip.value);
      this.statusBarItem.tooltip = newMd;
      this.hasStaleWarning = true;
    }
    this.statusBarItem.show();
  }

  /**
   * ??????????(????,??? lastSnapshot)
   */
  private rebuildDisplayFromSnapshot(snapshot: QuotaSnapshot): void {
    this.statusBarItem.command = 'antigravity-quota-watcher.quickRefreshQuota';

    const parts: string[] = [];

    if (this.showPlanName && snapshot.planName) {
      const planNameFormatted = this.formatPlanName(snapshot.planName);
      parts.push(`Plan: ${planNameFormatted}`);
    }

    if (this.showPromptCredits && snapshot.promptCredits) {
      const { available, monthly, remainingPercentage } = snapshot.promptCredits;
      const indicator = this.getStatusIndicator(remainingPercentage);
      const creditsPart = `${indicator} ?? ${available}/${this.formatNumber(monthly)} (${remainingPercentage.toFixed(0)}%)`;
      parts.push(creditsPart);
    }

    const modelsToShow = this.selectModelsToDisplay(snapshot.models);

    for (const model of modelsToShow) {
      const emoji = this.getModelEmoji(model.label);
      const shortName = this.getShortModelName(model.label);
      const indicator = this.getStatusIndicator(model.remainingPercentage ?? 0);

      if (model.isExhausted) {
        if (this.displayStyle === 'percentage') {
          parts.push(`${indicator} ${emoji} ${shortName}: 0%`);
        } else if (this.displayStyle === 'dots') {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getDotsBar(0)}`);
        } else {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getProgressBar(0)}`);
        }
      } else if (model.remainingPercentage !== undefined) {
        if (this.displayStyle === 'percentage') {
          parts.push(`${indicator} ${emoji} ${shortName}: ${model.remainingPercentage.toFixed(0)}%`);
        } else if (this.displayStyle === 'dots') {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getDotsBar(model.remainingPercentage)}`);
        } else {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getProgressBar(model.remainingPercentage)}`);
        }
      }
    }

    if (parts.length === 0) {
      this.statusBarItem.text = this.localizationService.t('status.error');
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = this.localizationService.t('tooltip.error');
    } else {
      const displayText = parts.join('  ');
      this.statusBarItem.text = displayText;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.color = undefined;
      this.updateTooltip(snapshot);
    }
  }

  /**
   * ??????
   */
  clearStale(): void {
    const currentText = this.statusBarItem.text;
    const staleIcon = this.localizationService.t('status.stale');
    // ????? staleIcon ??,???????
    if (currentText.startsWith(staleIcon)) {
      // ?? staleIcon,??????????????
      let newText = currentText.substring(staleIcon.length);
      // ??????????,?????
      if (newText.startsWith(' ')) {
        newText = newText.substring(1);
      }
      this.statusBarItem.text = newText;
    }
    // ??????,????????
    this.hasStaleWarning = false;
  }

  show(): void {
    this.statusBarItem.show();
  }

  hide(): void {
    this.statusBarItem.hide();
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
