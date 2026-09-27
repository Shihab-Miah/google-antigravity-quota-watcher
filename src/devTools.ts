/**
 * 开发工具 - 用于预览和测试 UI 元素
 * 仅在开发模式下使用
 */

import * as vscode from 'vscode';
import { LocalizationService } from './i18n/localizationService';
import { TranslationKey } from './i18n/types';
import { logger } from './logger';

/**
 * 注册开发预览命令
 * 仅在开发/测试模式下注册，生产环境跳过
 */
export function registerDevCommands(context: vscode.ExtensionContext) {
    // 生产环境不注册开发命令
    if (context.extensionMode === vscode.ExtensionMode.Production) {
        return;
    }

    logger.info('DevTools', 'Registering dev commands (non-production mode)');
    const locService = LocalizationService.getInstance();

    // 命令：预览所有通知弹窗
    const previewNotificationsCommand = vscode.commands.registerCommand(
        'antigravity-quota-watcher.dev.previewNotifications',
        async () => {
            const notifyKeys: { key: TranslationKey; type: 'info' | 'warning' | 'error' }[] = [
                { key: 'notify.unableToDetectProcess', type: 'warning' },
                { key: 'notify.refreshingQuota', type: 'info' },
                { key: 'notify.detectionSuccess', type: 'info' },
                { key: 'notify.unableToDetectPort', type: 'error' },
                { key: 'notify.portDetectionFailed', type: 'error' },
                { key: 'notify.configUpdated', type: 'info' },
                { key: 'notify.portCommandRequired', type: 'error' },
            ];

            // 构建 QuickPick 选项
            const items: vscode.QuickPickItem[] = [
                { label: '$(play-all) 播放全部通知', description: '依次显示所有通知' },
                { label: '', kind: vscode.QuickPickItemKind.Separator },
                ...notifyKeys.map(n => ({
                    label: getTypeIcon(n.type) + ' ' + n.key,
                    description: locService.t(n.key, { port: '12345', error: '示例错误' }).substring(0, 50)
                }))
            ];

            const selected = await vscode.window.showQuickPick(items, {
                title: '🔧 开发工具：预览通知弹窗',
                placeHolder: '选择要预览的通知，或播放全部'
            });

            if (!selected) return;

            if (selected.label.includes('播放全部')) {
                // 依次显示所有通知
                for (const n of notifyKeys) {
                    const msg = locService.t(n.key, { port: '12345', error: '示例错误' });
                    const choice = await showNotification(n.type, `[${n.key}]\n${msg}`, ['下一个', locService.t('devTools.stop')]);
                    if (choice === locService.t('devTools.stop')) break;
                }
                vscode.window.showInformationMessage(locService.t('devTools.previewComplete'));
            } else {
                // 显示单个通知
                const keyMatch = selected.label.match(/notify\.\w+/);
                if (keyMatch) {
                    const key = keyMatch[0] as TranslationKey;
                    const notifyItem = notifyKeys.find(n => n.key === key);
                    if (notifyItem) {
                        const msg = locService.t(notifyItem.key, { port: '12345', error: '示例错误' });
                        await showNotification(notifyItem.type, `[${key}]\n${msg}`);
                    }
                }
            }
        }
    );

    // 命令：预览状态栏文本
    const previewStatusBarCommand = vscode.commands.registerCommand(
        'antigravity-quota-watcher.dev.previewStatusBar',
        async () => {
            const statusKeys: TranslationKey[] = [
                'status.initializing',
                'status.detecting',
                'status.fetching',
                'status.retrying',
                'status.error',
                'status.refreshing',
            ];

            const items: vscode.QuickPickItem[] = statusKeys.map(key => ({
                label: key,
                description: locService.t(key, { current: '1', max: '3' })
            }));

            await vscode.window.showQuickPick(items, {
                title: '🔧 开发工具：状态栏文本预览',
                placeHolder: '查看状态栏文本（仅预览，不会修改实际状态栏）'
            });
        }
    );

    // 命令：预览 Tooltip 内容
    const previewTooltipCommand = vscode.commands.registerCommand(
        'antigravity-quota-watcher.dev.previewTooltip',
        async () => {
            const tooltipKeys: TranslationKey[] = [
                'tooltip.title',
                'tooltip.credits',
                'tooltip.available',
                'tooltip.remaining',
                'tooltip.depleted',
                'tooltip.resetTime',
                'tooltip.model',
                'tooltip.status',
                'tooltip.error',
                'tooltip.clickToRetry',
            ];

            // 构建完整的 tooltip 预览
            let tooltipPreview = '=== Tooltip 内容预览 ===\n\n';
            for (const key of tooltipKeys) {
                tooltipPreview += `${key}:\n  ${locService.t(key)}\n\n`;
            }

            // 用 OutputChannel 显示完整预览
            const channel = vscode.window.createOutputChannel('Antigravity Dev Preview');
            channel.clear();
            channel.appendLine(tooltipPreview);
            channel.show();
        }
    );

    context.subscriptions.push(
        previewNotificationsCommand,
        previewStatusBarCommand,
        previewTooltipCommand
    );
}

function getTypeIcon(type: 'info' | 'warning' | 'error'): string {
    switch (type) {
        case 'info': return '$(info)';
        case 'warning': return '$(warning)';
        case 'error': return '$(error)';
    }
}

async function showNotification(
    type: 'info' | 'warning' | 'error',
    message: string,
    buttons?: string[]
): Promise<string | undefined> {
    switch (type) {
        case 'info':
            return vscode.window.showInformationMessage(message, ...(buttons || []));
        case 'warning':
            return vscode.window.showWarningMessage(message, ...(buttons || []));
        case 'error':
            return vscode.window.showErrorMessage(message, ...(buttons || []));
    }
}
