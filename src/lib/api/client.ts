import type {
  AnalyzeWeekRequest,
  AnalyzeWeekResponse,
  BenchmarkRequest,
  BenchmarkResponse,
  ErrorResponse,
} from "@/lib/types";

const TIMEOUT_MS = 10_000;

function isErrorResponse(x: unknown): x is ErrorResponse {
  return (
    typeof x === "object" &&
    x !== null &&
    "error" in x &&
    typeof (x as { error: unknown }).error === "string"
  );
}

async function postJson<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const parsed: unknown = await res.json().catch(() => null);
      throw isErrorResponse(parsed) ? parsed : { error: `요청이 실패했습니다 (${res.status})` };
    }

    return (await res.json()) as TRes;
  } catch (err) {
    if (isErrorResponse(err)) throw err;
    throw { error: "네트워크 오류가 발생했습니다" } satisfies ErrorResponse;
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeWeek(
  req: AnalyzeWeekRequest,
): Promise<AnalyzeWeekResponse> {
  return postJson<AnalyzeWeekRequest, AnalyzeWeekResponse>("/api/analyze-week", req);
}

export async function fetchBenchmark(
  req: BenchmarkRequest,
): Promise<BenchmarkResponse> {
  return postJson<BenchmarkRequest, BenchmarkResponse>("/api/benchmark", req);
}
