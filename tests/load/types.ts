/**
 * tests/load/types.ts
 *
 * Types for Phase 8 Concurrency, Capacity & Breaking-Point Testing.
 */

export type WorkloadType = "A_light" | "B_normal" | "C_heavy";

export interface UserSessionProfile {
  userId: string;
  email: string;
  token: string;
  projectId?: string;
  workload: WorkloadType;
}

export interface RequestMetric {
  endpoint: string;
  method: string;
  status: number;
  durationMs: number;
  timestamp: number;
  success: boolean;
  error?: string | undefined;
}

export interface StageResult {
  concurrency: number;
  workloadDistribution: {
    light: number;
    normal: number;
    heavy: number;
  };
  durationSeconds: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rps: number;
  errorRatePercent: number;
  latencies: {
    min: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    mean: number;
  };
  errorDistribution: Record<string, number>;
  dataIntegrityFailures: number;
  degradationLevel: "LEVEL_0_HEALTHY" | "LEVEL_1_DEGRADED" | "LEVEL_2_UNSTABLE" | "LEVEL_3_BROKEN" | "LEVEL_4_SAFETY_BOUNDARY";
  notes?: string;
}

export interface IsolationTestResult {
  passed: boolean;
  usersTested: number;
  crossUserReadsBlocked: number;
  crossUserWritesBlocked: number;
  dataMatchesExpected: boolean;
  errors: string[];
}

export interface MultiTabTestResult {
  userTested: string;
  tabCount: number;
  finalCloudState: string;
  lastWriter: string;
  conflictsDetected: number;
  dataCorruption: boolean;
}
