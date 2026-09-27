import * as vscode from 'vscode';
import { ModelQuotaInfo, QuotaSnapshot } from '../types';

export interface QuotaHistoryEntry {
  timestamp: number;
  models: { modelId: string; remainingFraction: number }[];
}

export interface PersistedQuotaData {
  schemaVersion: number;
  lastFetch: {
    timestamp: number;
    source: 'GOOGLE_API' | 'GET_USER_STATUS' | 'ESTIMATED';
    models: { modelId: string; remainingFraction: number; resetTime: number }[];
  } | null;
  history: QuotaHistoryEntry[];
}

export class QuotaHistory {
  private readonly storageKey = 'aqw.quotaHistory';
  private data: PersistedQuotaData;
  private readonly maxHistoryLength = 24; // Keep last 24 entries

  constructor(private context: vscode.ExtensionContext) {
    const stored = this.context.globalState.get<PersistedQuotaData>(this.storageKey);
    if (stored && stored.schemaVersion === 1) {
      this.data = stored;
    } else {
      this.data = {
        schemaVersion: 1,
        lastFetch: null,
        history: []
      };
    }
  }

  public recordSnapshot(snapshot: QuotaSnapshot, source: 'GOOGLE_API' | 'GET_USER_STATUS' | 'ESTIMATED') {
    if (source === 'ESTIMATED') {
      if (this.data.lastFetch) {
        this.data.lastFetch.timestamp = snapshot.timestamp.getTime();
      }
      this.save();
      return;
    }

    const timestamp = snapshot.timestamp.getTime();
    
    this.data.lastFetch = {
      timestamp,
      source,
      models: snapshot.models.map(m => ({
        modelId: m.modelId,
        remainingFraction: m.remainingFraction || 0,
        resetTime: m.resetTime.getTime()
      }))
    };

    this.data.history.push({
      timestamp,
      models: snapshot.models.map(m => ({
        modelId: m.modelId,
        remainingFraction: m.remainingFraction || 0
      }))
    });

    if (this.data.history.length > this.maxHistoryLength) {
      this.data.history = this.data.history.slice(-this.maxHistoryLength);
    }

    this.save();
  }

  public getLastFetch() {
    return this.data.lastFetch;
  }

  public getHistory(): QuotaHistoryEntry[] {
    return this.data.history;
  }

  private save() {
    this.context.globalState.update(this.storageKey, this.data);
  }
}
