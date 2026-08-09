import type {
  AnalyzeWeekRequest,
  AnalyzeWeekResponse,
  BenchmarkRequest,
  BenchmarkResponse,
} from "@/lib/types";

// TDD red phase stub — implemented by the Coder against src/__tests__/packet-0004.test.ts
export async function analyzeWeek(
  _req: AnalyzeWeekRequest,
): Promise<AnalyzeWeekResponse> {
  throw new Error("analyzeWeek: not implemented");
}

export async function fetchBenchmark(
  _req: BenchmarkRequest,
): Promise<BenchmarkResponse> {
  throw new Error("fetchBenchmark: not implemented");
}
