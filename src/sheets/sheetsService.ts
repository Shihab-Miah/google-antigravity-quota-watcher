import * as https from 'https';
import { logger } from '../logger';
import { QuotaSnapshot } from '../types';
import { GoogleAuthService, AuthState } from '../auth';

export class GoogleSheetsService {
  private static instance: GoogleSheetsService;
  private readonly sheetName = 'Antigravity Quota History';
  private spreadsheetId: string | null = null;
  
  private constructor() {}

  public static getInstance(): GoogleSheetsService {
    if (!GoogleSheetsService.instance) {
      GoogleSheetsService.instance = new GoogleSheetsService();
    }
    return GoogleSheetsService.instance;
  }

  /**
   * Helper to make authorized API requests
   */
  private async makeApiRequest(method: string, path: string, body?: any): Promise<any> {
    const authService = GoogleAuthService.getInstance();
    const authState = authService.getAuthState();
    
    if (authState.state !== AuthState.AUTHENTICATED) {
      throw new Error('User is not authenticated');
    }
    
    const token = await authService.getValidAccessToken();
    if (!token) {
      throw new Error('Failed to get valid access token');
    }

    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: 'sheets.googleapis.com',
        path,
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (path.startsWith('https://')) {
        const url = new URL(path);
        options.hostname = url.hostname;
        options.path = url.pathname + url.search;
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : null);
            } catch (e) {
              resolve(data);
            }
          } else {
            logger.error('GoogleSheetsService', `API Error: ${res.statusCode} ${data}`);
            reject(new Error(`API Error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (e) => {
        logger.error('GoogleSheetsService', `Request Error: ${e.message}`);
        reject(e);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  private async searchForDriveFile(): Promise<string | null> {
    try {
      const query = encodeURIComponent(`name='${this.sheetName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
      const response = await this.makeApiRequest('GET', `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`);
      if (response && response.files && response.files.length > 0) {
        return response.files[0].id;
      }
    } catch (e) {
      logger.error('GoogleSheetsService', 'Failed to search for drive file', e);
    }
    return null;
  }

  private async createSpreadsheet(): Promise<string | null> {
    try {
      const body = {
        properties: {
          title: this.sheetName
        }
      };
      const response = await this.makeApiRequest('POST', '/v4/spreadsheets', body);
      
      const spreadsheetId = response.spreadsheetId;
      
      // Initialize headers
      if (spreadsheetId) {
        await this.makeApiRequest('PUT', `/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:D1?valueInputOption=USER_ENTERED`, {
          values: [
            ['Timestamp', 'Model', 'Remaining %', 'Plan']
          ]
        });
      }
      return spreadsheetId;
    } catch (e) {
      logger.error('GoogleSheetsService', 'Failed to create spreadsheet', e);
      return null;
    }
  }

  public async getSpreadsheetId(): Promise<string | null> {
    if (this.spreadsheetId) return this.spreadsheetId;

    this.spreadsheetId = await this.searchForDriveFile();
    if (!this.spreadsheetId) {
      this.spreadsheetId = await this.createSpreadsheet();
    }
    
    return this.spreadsheetId;
  }

  public async appendSnapshot(snapshot: QuotaSnapshot): Promise<void> {
    if (snapshot.isStale) {
      return; // Do not append estimated data to the true historical record
    }

    const spreadsheetId = await this.getSpreadsheetId();
    if (!spreadsheetId) {
      logger.error('GoogleSheetsService', 'Cannot append: No spreadsheet ID found or created');
      return;
    }

    const timestamp = snapshot.timestamp.toISOString();
    const planName = snapshot.planName || 'Unknown';

    const values = snapshot.models.map(m => [
      timestamp,
      m.label,
      m.remainingPercentage?.toFixed(2) || '0',
      planName
    ]);

    try {
      await this.makeApiRequest('POST', `/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A:append?valueInputOption=USER_ENTERED`, {
        values
      });
      logger.info('GoogleSheetsService', 'Successfully appended quota data to Google Sheets');
    } catch (e) {
      logger.error('GoogleSheetsService', 'Failed to append to Google Sheets', e);
    }
  }
}
