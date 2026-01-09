/**
 * Whoop integration for Jibot
 * 
 * Fetches health data from Supabase (shared with health-tracker app)
 * to answer questions like "how's Joi doing today?"
 */

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (uses same DB as health-tracker)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

export function isWhoopConfigured(): boolean {
  return !!(supabaseUrl && supabaseKey);
}

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
 * Get the latest Whoop recovery data
 */
// Type definitions for Supabase data
interface RecoveryRow {
  recovery_score: number | null;
  hrv_rmssd_milli: number | null;
  resting_heart_rate: number | null;
  recorded_at: string;
}

interface SleepRow {
  end_time: string;
  score_sleep_performance_percentage: number | null;
  stage_summary_total_in_bed_milli: number | null;
}

interface CycleRow {
  end_time: string;
  strain: number | null;
}

export async function getLatestRecovery(): Promise<WhoopStatus | null> {
  const client = getSupabase();
  if (!client) {
    console.error("Supabase not configured for Whoop data");
    return null;
  }

  try {
    // Get latest recovery score
    const { data: recovery, error: recoveryError } = await client
      .from("whoop_recovery")
      .select("recovery_score, hrv_rmssd_milli, resting_heart_rate, recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single<RecoveryRow>();

    if (recoveryError && recoveryError.code !== "PGRST116") {
      console.error("Error fetching recovery:", recoveryError);
    }

    // Get latest sleep data
    const { data: sleep, error: sleepError } = await client
      .from("whoop_sleep")
      .select("end_time, score_sleep_performance_percentage, stage_summary_total_in_bed_milli")
      .order("end_time", { ascending: false })
      .limit(1)
      .single<SleepRow>();

    if (sleepError && sleepError.code !== "PGRST116") {
      console.error("Error fetching sleep:", sleepError);
    }

    // Get latest cycle/strain data
    const { data: cycle, error: cycleError } = await client
      .from("whoop_cycles")
      .select("end_time, strain")
      .order("end_time", { ascending: false })
      .limit(1)
      .single<CycleRow>();

    if (cycleError && cycleError.code !== "PGRST116") {
      console.error("Error fetching cycle:", cycleError);
    }

    // Calculate days since last update
    const recordedAt = recovery?.recorded_at || sleep?.end_time || cycle?.end_time || null;
    let daysSinceUpdate = 999;
    if (recordedAt) {
      const lastUpdate = new Date(recordedAt);
      const now = new Date();
      daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Calculate sleep hours from milliseconds
    let sleepHours: number | null = null;
    if (sleep?.stage_summary_total_in_bed_milli) {
      sleepHours = Math.round((sleep.stage_summary_total_in_bed_milli / (1000 * 60 * 60)) * 10) / 10;
    }

    return {
      recoveryScore: recovery?.recovery_score ?? null,
      hrvRmssd: recovery?.hrv_rmssd_milli ?? null,
      restingHeartRate: recovery?.resting_heart_rate ?? null,
      sleepPerformance: sleep?.score_sleep_performance_percentage ?? null,
      sleepHours,
      strain: cycle?.strain ?? null,
      recordedAt,
      daysSinceUpdate,
    };
  } catch (error) {
    console.error("Error fetching Whoop data:", error);
    return null;
  }
}

/**
 * Format Whoop status as a human-readable message
 */
export function formatWhoopStatus(status: WhoopStatus): string {
  const parts: string[] = [];

  // Recovery score is the main metric
  if (status.recoveryScore !== null) {
    const emoji = getRecoveryEmoji(status.recoveryScore);
    const descriptor = getRecoveryDescriptor(status.recoveryScore);
    parts.push(`${emoji} *Recovery: ${status.recoveryScore}%* (${descriptor})`);
  } else {
    parts.push("⚠️ No recovery data available");
  }

  // Sleep info
  if (status.sleepPerformance !== null || status.sleepHours !== null) {
    const sleepParts: string[] = [];
    if (status.sleepHours !== null) {
      sleepParts.push(`${status.sleepHours}h sleep`);
    }
    if (status.sleepPerformance !== null) {
      sleepParts.push(`${status.sleepPerformance}% performance`);
    }
    parts.push(`😴 Sleep: ${sleepParts.join(", ")}`);
  }

  // HRV and RHR
  if (status.hrvRmssd !== null || status.restingHeartRate !== null) {
    const hrvParts: string[] = [];
    if (status.hrvRmssd !== null) {
      hrvParts.push(`HRV ${Math.round(status.hrvRmssd)}ms`);
    }
    if (status.restingHeartRate !== null) {
      hrvParts.push(`RHR ${status.restingHeartRate}bpm`);
    }
    parts.push(`💓 ${hrvParts.join(", ")}`);
  }

  // Yesterday's strain if available
  if (status.strain !== null) {
    parts.push(`🏋️ Yesterday's strain: ${status.strain.toFixed(1)}`);
  }

  // Data freshness warning
  if (status.daysSinceUpdate > 1) {
    parts.push(`\n_⚠️ Data is ${status.daysSinceUpdate} days old_`);
  }

  return parts.join("\n");
}

function getRecoveryEmoji(score: number): string {
  if (score >= 67) return "🟢";
  if (score >= 34) return "🟡";
  return "🔴";
}

function getRecoveryDescriptor(score: number): string {
  if (score >= 90) return "excellent - peak performance ready";
  if (score >= 67) return "good - ready for strain";
  if (score >= 50) return "moderate - light activity recommended";
  if (score >= 34) return "low - consider recovery focus";
  return "very low - rest recommended";
}

/**
 * Check if text is asking about Joi's status/health
 */
export function isStatusQuery(text: string): boolean {
  const lower = text.toLowerCase();
  
  // Patterns for "how's Joi doing"
  const patterns = [
    /how'?s?\s+joi\s+(doing|feeling|today)/i,
    /how\s+is\s+joi\s+(doing|feeling|today)/i,
    /joi'?s?\s+(status|health|recovery|whoop)/i,
    /whoop\s+(status|score|recovery)/i,
    /recovery\s+score/i,
    /how\s+did\s+joi\s+sleep/i,
  ];

  return patterns.some(p => p.test(lower));
}
