import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { mockFetchOnce } from "@/__tests__/__helpers__/test-utils";
import type { UserProfile } from "@/lib/types";

/**
 * Packet 0004: SMS 파서 + API client + State store + 통화 포맷
 *
 * AC-1: 신한카드 SMS 예시 파싱 성공 / 무의미 문자 null
 * AC-2: API 500·네트워크 오류 시 throw하되 console.error 미호출·10s timeout 동작
 * AC-3: premiumUntil 과거 부팅 시 isPremium===false / formatKRW(12000)==='12,000원'
 * AC-4: 컴파일 통과 (모든 export가 함수로 존재)
 *
 * Implementation targets:
 * - src/lib/domain/smsParser.ts: parseSmsText(text): Partial<Expense> | null
 * - src/lib/api/client.ts: analyzeWeek(req), fetchBenchmark(req) — VITE_API_BASE, 10s AbortController timeout,
 *   try/catch, 실패 시 파싱된 { error } 객체를 그대로 throw, console.error 미호출
 * - src/lib/store.tsx: AppStoreProvider, useAppStore() → { profile, expenses, isLoading }
 *   부팅 시 getProfile()/getExpenses() 로드, premiumUntil이 존재하고 now보다 과거면 patchProfile({ isPremium: false })
 * - src/lib/format.ts: formatKRW(n) — Intl.NumberFormat('ko-KR') 기반, "12,000원" 형태
 */

describe("Packet 0004: SMS 파서 + API client + State store + 통화 포맷", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // AC-1: parseSmsText
  // ==========================================================================

  describe("AC-1: parseSmsText", () => {
    it("AC-1a[P0]: 신한카드 승인 문자를 금액/가맹점/카테고리/시각으로 파싱한다", async () => {
      const { parseSmsText } = await import("@/lib/domain/smsParser");

      const result = parseSmsText(
        "[Web발신] 신한카드 12,000원 승인 스타벅스 08/10 12:30",
      );

      const now = new Date();
      const expectedTimestamp = new Date(
        now.getFullYear(),
        7, // August (0-indexed)
        10,
        12,
        30,
        0,
        0,
      ).getTime();

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        amount: 12000,
        merchant: "스타벅스",
        category: "카페/간식",
        timestamp: expectedTimestamp,
      });
    });

    it("AC-1b[P0]: 금액을 찾을 수 없는 문자열은 null을 반환한다", async () => {
      const { parseSmsText } = await import("@/lib/domain/smsParser");

      const result = parseSmsText("안녕하세요 반갑습니다");

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // AC-2: API client (analyzeWeek / fetchBenchmark)
  // ==========================================================================

  describe("AC-2: analyzeWeek / fetchBenchmark", () => {
    const analyzeReq = {
      expenses: [
        {
          amount: 12000,
          category: "카페/간식" as const,
          merchant: "스타벅스",
          timestamp: 1_700_000_000_000,
        },
      ],
      profile: { ageBand: "25-30" as const, incomeBand: "250-350" as const },
    };

    it("AC-2a[P0]: 500 응답 시 파싱된 {error}를 throw하고 console.error를 호출하지 않는다", async () => {
      const { analyzeWeek } = await import("@/lib/api/client");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFetchOnce({ error: "analysis failed" }, { status: 500, ok: false });

      await expect(analyzeWeek(analyzeReq)).rejects.toEqual({
        error: "analysis failed",
      });
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("AC-2b[P0]: 네트워크 오류 시 {error}를 throw하고 console.error를 호출하지 않는다", async () => {
      const { analyzeWeek } = await import("@/lib/api/client");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;

      await expect(analyzeWeek(analyzeReq)).rejects.toMatchObject({
        error: expect.any(String),
      });
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("AC-2c[P0]: 10초가 지나면 AbortController로 요청을 중단한다", async () => {
      vi.useFakeTimers();
      const { analyzeWeek } = await import("@/lib/api/client");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      let capturedSignal: AbortSignal | undefined;
      globalThis.fetch = vi.fn((_url: unknown, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          capturedSignal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        });
      }) as unknown as typeof fetch;

      const pending = analyzeWeek(analyzeReq);
      const expectation = expect(pending).rejects.toBeTruthy();

      await vi.advanceTimersByTimeAsync(10_000);
      await expectation;

      expect(capturedSignal?.aborted).toBe(true);
      expect(consoleSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("AC-2d[P0]: fetchBenchmark는 VITE_API_BASE/api/benchmark로 요청 그대로만 전송하고 응답을 반환한다", async () => {
      const { fetchBenchmark } = await import("@/lib/api/client");
      const req = {
        ageBand: "25-30" as const,
        incomeBand: "250-350" as const,
        categories: [{ category: "카페/간식" as const, amount: 68000 }],
      };
      const response = {
        categories: [
          { category: "카페/간식" as const, peerAvg: 49600, diffRatio: 0.37 },
        ],
      };
      const fetchMock = mockFetchOnce(response);

      const result = await fetchBenchmark(req);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/benchmark"),
        expect.objectContaining({ method: "POST" }),
      );
      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse((init as RequestInit).body as string)).toEqual(req);
      expect(result).toEqual(response);
    });
  });

  // ==========================================================================
  // AC-3: useAppStore 부팅 로직 + formatKRW
  // ==========================================================================

  describe("AC-3: useAppStore boot + formatKRW", () => {
    it("AC-3a[P0]: premiumUntil이 과거면 부팅 시 isPremium을 false로 패치하고 지출을 로드한다", async () => {
      const { saveProfile, getProfile } = await import("@/lib/storage/profile");
      const { addExpense } = await import("@/lib/storage/expenses");
      const { AppStoreProvider, useAppStore } = await import("@/lib/store");

      const expiredProfile: UserProfile = {
        ageBand: "25-30",
        incomeBand: "250-350",
        isPremium: true,
        premiumUntil: Date.now() - 1000,
        aiNoticeAcknowledged: true,
        onboarded: true,
      };
      saveProfile(expiredProfile);
      addExpense({
        amount: 5000,
        category: "식비",
        merchant: "김밥천국",
        memo: "",
        timestamp: Date.now(),
        source: "manual",
      });

      function Probe() {
        const { profile, expenses } = useAppStore();
        return React.createElement(
          "div",
          null,
          React.createElement("span", { "data-testid": "premium" }, String(profile.isPremium)),
          React.createElement("span", { "data-testid": "count" }, expenses.length),
        );
      }

      render(React.createElement(AppStoreProvider, null, React.createElement(Probe)));

      await waitFor(() => {
        expect(screen.getByTestId("premium").textContent).toBe("false");
      });
      expect(screen.getByTestId("count").textContent).toBe("1");
      expect(getProfile().isPremium).toBe(false);
    });

    it("AC-3b[P0]: formatKRW는 Intl.NumberFormat('ko-KR') 기반으로 '12,000원' 형태를 반환한다", async () => {
      const { formatKRW } = await import("@/lib/format");

      expect(formatKRW(12000)).toBe("12,000원");
      expect(formatKRW(0)).toBe("0원");
    });
  });

  // ==========================================================================
  // AC-4: 컴파일 통과
  // ==========================================================================

  describe("AC-4: 컴파일 통과", () => {
    it("AC-4: 모든 모듈이 타입 에러 없이 함수를 export한다", async () => {
      const { parseSmsText } = await import("@/lib/domain/smsParser");
      const { analyzeWeek, fetchBenchmark } = await import("@/lib/api/client");
      const { AppStoreProvider, useAppStore } = await import("@/lib/store");
      const { formatKRW } = await import("@/lib/format");

      expect(typeof parseSmsText).toBe("function");
      expect(typeof analyzeWeek).toBe("function");
      expect(typeof fetchBenchmark).toBe("function");
      expect(typeof AppStoreProvider).toBe("function");
      expect(typeof useAppStore).toBe("function");
      expect(typeof formatKRW).toBe("function");
    });
  });
});
