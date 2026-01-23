/**
 * Whoop integration for Jibot
 * 
 * Fetches health data from the local health-api service
 * which in turn reads from Supabase (shared with health-tracker app).
 */

const HEALTH_API_URL = process.env.HEALTH_API_URL || "http://127.0.0.1:3033";

export interface WhoopStatus {
  recoveryScore: number | null;
  hrvRmssd: number | null;
  restingHeartRate: number | null;
  sleepPerformance: number | null;
  sleepHours: number | null;
  strain: number | null;
  recordedAt: string | null;
  daysSinceUpdate: number;
}

/**
 * Check if health API is reachable
 */
export function isWhoopConfigured(): boolean {
  // Always return true - we'll handle errors when fetching
  return true;
}

/**
 * Check if a message is asking about health/status
 */
export function isStatusQuery(text: string): boolean {
  const statusPatterns = [
    /how('s|s| is) (joi|he|she) (doing|feeling)/i,
    /how('s|s| is) joi today/i,
    /joi('s|s)? (health|status|recovery|whoop)/i,
    /whoop (status|score|recovery)/i,
    /recovery score/i,
  ];
  return statusPatterns.some((pattern) => pattern.test(text));
}

/**
 * Get the latest Whoop recovery data from health-api
 */
export async function getLatestRecovery(): Promise<WhoopStatus | null> {
  try {
    const response = await fetch(`${HEALTH_API_URL}/whoop/status`);
    
    if (!response.ok) {
      console.error("Health API error:", response.status);
      return null;
    }
    
    const data = await response.json() as WhoopStatus & { error?: string };
    
    if (data.error) {
      console.error("Health API returned error:", data.error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Failed to fetch from health-api:", error);
    return null;
  }
}

/**
 * Format Whoop status for display (compact single line with labels)
 */
export function formatWhoopStatus(status: WhoopStatus): string {
  const parts: string[] = [];
  
  // Recovery score with emoji indicator
  if (status.recoveryScore !== null) {
    let emoji = "🟢";
    if (status.recoveryScore < 34) emoji = "🔴";
    else if (status.recoveryScore < 67) emoji = "🟡";
    parts.push(`${emoji} Recovery ${status.recoveryScore}%`);
  }
  
  // Sleep
  if (status.sleepHours !== null) {
    parts.push(`😴 Sleep ${status.sleepHours}h`);
  }
  
  // HRV
  if (status.hrvRmssd !== null) {
    const hrv = typeof status.hrvRmssd === "number" ? Math.round(status.hrvRmssd) : status.hrvRmssd;
    parts.push(`💓 HRV ${hrv}ms`);
  }
  
  // Resting HR
  if (status.restingHeartRate !== null) {
    parts.push(`❤️ RHR ${status.restingHeartRate}bpm`);
  }
  
  // Data freshness warning
  if (status.daysSinceUpdate > 1) {
    parts.push(`⚠️ ${status.daysSinceUpdate}d old`);
  }
  
  return parts.join(" · ");
}
