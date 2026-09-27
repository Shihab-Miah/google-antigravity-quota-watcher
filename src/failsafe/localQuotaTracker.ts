import { QuotaHistory, QuotaHistoryEntry } from './quotaHistory';
import { DepletionForecaster, DepletionForecast } from './depletionForecaster';
import { ModelQuotaInfo, QuotaSnapshot } from '../types';

export class LocalQuotaTracker {
  constructor(private history: QuotaHistory) {}

  public recordSnapshot(snapshot: QuotaSnapshot, source: 'GOOGLE_API' | 'GET_USER_STATUS' | 'ESTIMATED') {
    this.history.recordSnapshot(snapshot, source);
  }

  public addForecastToSnapshot(snapshot: QuotaSnapshot) {
    const historyData = this.history.getHistory();
    for (const model of snapshot.models) {
      if (model.remainingFraction !== undefined) {
        const forecast = DepletionForecaster.calculateForecast(model.modelId, model.remainingFraction, historyData);
        model.ratePerHour = forecast.ratePerHour;
        model.estimatedDepletionTimeMs = forecast.timeUntilDepletion;
      }
    }
  }

  public estimateCurrentQuota(): QuotaSnapshot | null {
    const lastFetch = this.history.getLastFetch();
    
    // We have absolutely no data to base an estimate on
    if (!lastFetch || lastFetch.models.length === 0) {
      return null;
    }

    const now = Date.now();
    const elapsedSinceFetchMs = now - lastFetch.timestamp;
    const historyData = this.history.getHistory();

    const estimatedModels: ModelQuotaInfo[] = lastFetch.models.map(model => {
      const resetTimeMs = model.resetTime;
      const resetTime = new Date(resetTimeMs);
      
      // If we've passed the reset time, we cannot estimate reliably.
      // Quota could be 100%, or partially used. 
      // We flag it by leaving remainingFraction as the old value but marking it stale.
      let estimatedFraction = model.remainingFraction;
      
      if (now < resetTimeMs) {
        // We are within the same reset window. We can estimate.
        const forecast = DepletionForecaster.calculateForecast(model.modelId, model.remainingFraction, historyData);
        
        if (forecast.ratePerHour > 0) {
          // rate is % per hour. Convert to fraction per ms.
          const fractionLossPerMs = (forecast.ratePerHour / 100) / (60 * 60 * 1000);
          const estimatedLoss = fractionLossPerMs * elapsedSinceFetchMs;
          estimatedFraction = Math.max(0, model.remainingFraction - estimatedLoss);
        }
      }

      const timeUntilReset = Math.max(0, resetTimeMs - now);
      
      return {
        modelId: model.modelId,
        label: this.getFallbackLabel(model.modelId), // We don't store labels in history to save space
        remainingFraction: estimatedFraction,
        remainingPercentage: estimatedFraction * 100,
        isExhausted: estimatedFraction <= 0,
        resetTime,
        timeUntilReset,
        timeUntilResetFormatted: this.formatTimeUntilReset(timeUntilReset)
      };
    });

    return {
      timestamp: new Date(lastFetch.timestamp), // The original timestamp of the data
      models: estimatedModels,
      isStale: true // Explicitly flag this as an estimated snapshot
    };
  }

  private getFallbackLabel(modelId: string): string {
    if (modelId.includes('gemini')) return modelId.replace(/-/g, ' ').toUpperCase();
    if (modelId.includes('claude')) return modelId.replace(/-/g, ' ').toUpperCase();
    return modelId;
  }

  private formatTimeUntilReset(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }
}
