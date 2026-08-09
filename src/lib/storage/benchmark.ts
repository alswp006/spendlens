import type { AgeBand, BenchmarkResult, IncomeBand } from "@/lib/types";
import { safeGetJSON, safeSetJSON, STORAGE_KEYS } from "./base";

export function getBenchmark(): BenchmarkResult | null {
  return safeGetJSON<BenchmarkResult | null>(STORAGE_KEYS.BENCHMARK, null);
}

export function saveBenchmark(benchmark: BenchmarkResult): void {
  safeSetJSON(STORAGE_KEYS.BENCHMARK, benchmark);
}

export function clearBenchmark(): void {
  safeSetJSON(STORAGE_KEYS.BENCHMARK, null);
}

export function hasBenchmark(): boolean {
  return getBenchmark() !== null;
}

// 프로필의 연령대/소득대가 바뀌면 저장된 벤치마크는 옛 스냅샷이라 더 이상 유효하지 않다.
export function isBenchmarkStale(
  benchmark: BenchmarkResult | null,
  profile: { ageBand: AgeBand; incomeBand: IncomeBand }
): boolean {
  if (!benchmark) return true;
  return (
    benchmark.ageBand !== profile.ageBand ||
    benchmark.incomeBand !== profile.incomeBand
  );
}
