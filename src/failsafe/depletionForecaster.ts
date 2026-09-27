import { QuotaHistoryEntry } from './quotaHistory';

export interface DepletionForecast {
  ratePerHour: number;       // percentage points per hour (e.g., 5.2)
  timeUntilDepletion: number | null; // ms from now, null if rate is 0 or positive
}

export class DepletionForecaster {
  /**
   * Calculates the depletion rate (percentage points per hour) for a specific model
   * using linear regression over the historical data points.
   */
  public static calculateForecast(
    modelId: string, 
    currentRemainingFraction: number, 
    history: QuotaHistoryEntry[]
  ): DepletionForecast {
    // We need at least 2 points to calculate a rate
    if (history.length < 2) {
      return { ratePerHour: 0, timeUntilDepletion: null };
    }

    // Extract valid points for this model
    const points: { x: number, y: number }[] = [];
    for (const entry of history) {
      const modelData = entry.models.find(m => m.modelId === modelId);
      if (modelData) {
        // x = timestamp in hours, y = remaining percentage (0-100)
        points.push({
          x: entry.timestamp / (1000 * 60 * 60),
          y: modelData.remainingFraction * 100
        });
      }
    }

    if (points.length < 2) {
      return { ratePerHour: 0, timeUntilDepletion: null };
    }

    // Linear regression: y = mx + b
    // We want 'm' (slope). If quota is dropping, 'm' will be negative.
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = points.length;

    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
    }

    const denominator = (n * sumXX) - (sumX * sumX);
    if (denominator === 0) {
      return { ratePerHour: 0, timeUntilDepletion: null };
    }

    const slope = ((n * sumXY) - (sumX * sumY)) / denominator;
    
    // We express rate as a positive number (points lost per hour)
    const ratePerHour = slope < 0 ? Math.abs(slope) : 0;

    // Calculate time until depletion (when y = 0)
    let timeUntilDepletion: number | null = null;
    if (ratePerHour > 0) {
      const remainingPercentage = currentRemainingFraction * 100;
      const hoursUntilDepletion = remainingPercentage / ratePerHour;
      timeUntilDepletion = hoursUntilDepletion * 60 * 60 * 1000;
    }

    return { ratePerHour, timeUntilDepletion };
  }
}
