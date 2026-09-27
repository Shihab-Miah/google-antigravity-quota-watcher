import * as https from 'https';
import { logger } from '../logger';
import { ProxyService } from '../proxy/proxyService';

const ANTIGRAVITY_API_BASE = 'https://daily-cloudcode-pa.sandbox.googleapis.com';
const LOAD_CODE_ASSIST_PATH = '/v1internal:loadCodeAssist';
const ONBOARD_USER_PATH = '/v1internal:onboardUser';
const API_TIMEOUT_MS = 30000;
const ONBOARD_MAX_ATTEMPTS = 5;
const ONBOARD_RETRY_DELAY_MS = 2000;

export interface AntigravityProjectInfo {
    projectId: string;
    tierId?: string;
}

export class AntigravityClient {
    private static instance: AntigravityClient;

    private constructor() { }

    public static getInstance(): AntigravityClient {
        if (!AntigravityClient.instance) {
            AntigravityClient.instance = new AntigravityClient();
        }
        return AntigravityClient.instance;
    }

    public async loadProjectInfo(accessToken: string): Promise<AntigravityProjectInfo> {
        logger.debug('AntigravityAPI', 'loadProjectInfo: sending loadCodeAssist');
        const loadResponse = await this.doRequest(
            LOAD_CODE_ASSIST_PATH,
            accessToken,
            this.buildMetadataBody()
        );

        const projectId = this.extractProjectIdFromLoad(loadResponse);
        if (projectId) {
            return {
                projectId,
                tierId: this.extractTierId(loadResponse)
            };
        }

        const tierId = this.extractDefaultTierId(loadResponse);
        if (!tierId) {
            logger.warn('AntigravityAPI', 'loadProjectInfo: default tier missing, reloading');
            const retryResponse = await this.doRequest(
                LOAD_CODE_ASSIST_PATH,
                accessToken,
                this.buildMetadataBody()
            );
            const retryTierId = this.extractDefaultTierId(retryResponse);
            if (!retryTierId) {
                throw new Error('Antigravity loadCodeAssist returned no default tier');
            }
            const onboardProjectId = await this.onboardUser(accessToken, retryTierId);
            return { projectId: onboardProjectId, tierId: retryTierId };
        }

        const onboardProjectId = await this.onboardUser(accessToken, tierId);
        return { projectId: onboardProjectId, tierId };
    }

    private buildMetadataBody(): object {
        return {
            metadata: {
                ideType: 'ANTIGRAVITY',
                platform: 'PLATFORM_UNSPECIFIED',
                pluginType: 'GEMINI'
            }
        };
    }

    private extractProjectIdFromLoad(response: any): string | undefined {
        if (!response?.currentTier) {
            return undefined;
        }
        return this.normalizeProjectId(response?.cloudaicompanionProject);
    }

    private extractTierId(response: any): string | undefined {
        const tier = response?.paidTier || response?.currentTier;
        return tier?.id || tier?.name;
    }

    private extractDefaultTierId(response: any): string | undefined {
        const allowedTiers = response?.allowedTiers || [];
        for (const tier of allowedTiers) {
            if (tier?.isDefault && tier?.id) {
                return tier.id;
            }
        }
        if (allowedTiers.length > 0) {
            return 'LEGACY';
        }
        return undefined;
    }

    private normalizeProjectId(value: any): string | undefined {
        if (!value) {
            return undefined;
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'object') {
            return value.id || value.projectId || undefined;
        }
        return undefined;
    }

    private async onboardUser(accessToken: string, tierId: string): Promise<string> {
        const body = {
            tierId,
            metadata: {
                ideType: 'ANTIGRAVITY',
                platform: 'PLATFORM_UNSPECIFIED',
                pluginType: 'GEMINI'
            }
        };

        for (let attempt = 1; attempt <= ONBOARD_MAX_ATTEMPTS; attempt++) {
            logger.debug('AntigravityAPI', `onboardUser attempt ${attempt}/${ONBOARD_MAX_ATTEMPTS}`);
            const response = await this.doRequest(ONBOARD_USER_PATH, accessToken, body);

            if (response?.done) {
                const projectId = this.normalizeProjectId(response?.response?.cloudaicompanionProject);
                if (projectId) {
                    return projectId;
                }
                throw new Error('Antigravity onboardUser completed without project id');
            }

            if (attempt < ONBOARD_MAX_ATTEMPTS) {
                await this.delay(ONBOARD_RETRY_DELAY_MS);
            }
        }

        throw new Error('Antigravity onboardUser timed out');
    }

    private doRequest(
        path: string,
        accessToken: string,
        body: object
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const url = new URL(ANTIGRAVITY_API_BASE);
            const postData = JSON.stringify(body);

            // 获取代理 Agent（如果配置了代理）
            const proxyAgent = ProxyService.getInstance().getAgentForHost(url.hostname);

            const options: https.RequestOptions = {
                hostname: url.hostname,
                port: 443,
                path: path,
                method: 'POST',
                timeout: API_TIMEOUT_MS,
                agent: proxyAgent,  // 添加代理 agent 支持
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'antigravity/1.11.3 windows/amd64'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const response = JSON.parse(data);
                            resolve(response);
                        } catch (e) {
                            reject(new Error(`Failed to parse Antigravity response: ${data}`));
                        }
                    } else {
                        let message = `HTTP ${res.statusCode}`;
                        try {
                            const errorResponse = JSON.parse(data);
                            message = errorResponse.error?.message || errorResponse.message || message;
                        } catch {
                            if (data) {
                                message = `${message}: ${data}`;
                            }
                        }
                        reject(new Error(message));
                    }
                });
            });

            req.on('error', (e) => {
                reject(new Error(`Network error: ${e.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
