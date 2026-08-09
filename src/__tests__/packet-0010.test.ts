import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { patchProfile, saveProfile, getProfile } from "@/lib/storage/profile";
import { addExpense } from "@/lib/storage/expenses";
import { saveBenchmark, getBenchmark } from "@/lib/storage/benchmark";
import { fetchBenchmark } from "@/lib/api/client";
import type { BenchmarkResult } from "@/lib/types";

/**
 * Packet 0010: Benchmark 페이지 — /benchmark
 *
 * AC-1: 무료 사용자는 잠금 화면 + 구독 유도, fetchBenchmark 미호출
 * AC-2: 프로필 밴드(ageBand/incomeBand) 미설정 시 안내, fetchBenchmark 미호출
 * AC-3: 프리미엄 + 밴드 설정 시 fetchBenchmark 호출 → saveBenchmark 저장(ageBand는 리터럴 유니온 값) →
 *       카테고리별 myAmount vs peerAvg 시각화, 에러 시 마지막 저장 결과 유지 + Toast
 * AC-4: location.state 없이 진입해도 크래시 없음 · 컴파일 통과
 *
 * Implementation target: src/pages/Benchmark.tsx (App.tsx가 이미 /benchmark에 연결)
 *
 * 테스트가 요구하는 testid/문구 규약 (Coder가 구현 시 준수):
 *   - data-testid="benchmark-locked"        : 무료 사용자 잠금 컨테이너
 *   - data-testid="benchmark-band-required" : 프로필 밴드 미설정 안내 컨테이너
 *   - data-testid="benchmark-summary"       : 벤치마크 결과 컨테이너
 *   - data-testid="benchmark-category"      : 카테고리별 비교 행 (getAllByTestId)
 *   - 잠금 화면 CTA 버튼 텍스트: "구독하고 비교하기" → navigate("/premium", { state: { from: "benchmark" } })
 *   - 결과 컨테이너 내부에 "AI가 생성한 결과입니다" 텍스트(Badge) 포함
 *   - API 에러 시 Toast 문구: "벤치마크 조회에 실패해 이전 결과를 보여드려요"
 */

mockAll();

vi.mock("@/lib/api/client", () => ({
  analyzeWeek: vi.fn(),
  fetchBenchmark: vi.fn(),
}));

const mockedFetchBenchmark = vi.mocked(fetchBenchmark);

describe("Benchmark 페이지 — /benchmark", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedFetchBenchmark.mockReset();
    mockNavigate.mockReset();
  });

  // ==========================================================================
  // AC-1: 무료 시 잠금 + API 미호출
  // ==========================================================================

  it("AC-1[P0]: 무료 사용자는 잠금 화면을 보고 fetchBenchmark를 호출하지 않는다", async () => {
    patchProfile({ onboarded: true, isPremium: false, ageBand: "31-34", incomeBand: "350-450" });
    addExpense({ amount: 30000, category: "식비", merchant: "김밥천국", memo: "", timestamp: Date.now(), source: "manual" });

    const Benchmark = (await import("@/pages/Benchmark")).default;
    expect(() => renderWithRouter(React.createElement(Benchmark))).not.toThrow();

    expect(mockedFetchBenchmark).not.toHaveBeenCalled();
    expect(screen.getByTestId("benchmark-locked")).toBeInTheDocument();
    expect(screen.queryByTestId("benchmark-summary")).toBeNull();
  });

  it("AC-1b[P0]: 잠금 화면의 구독 유도 버튼은 /premium으로 이동시킨다", async () => {
    patchProfile({ onboarded: true, isPremium: false, ageBand: "31-34", incomeBand: "350-450" });

    const Benchmark = (await import("@/pages/Benchmark")).default;
    renderWithRouter(React.createElement(Benchmark));

    fireEvent.click(screen.getByRole("button", { name: "구독하고 비교하기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/premium", { state: { from: "benchmark" } });
    expect(mockedFetchBenchmark).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // AC-2: 프로필 밴드 미설정 시 안내 + API 미호출
  // ==========================================================================

  it("AC-2[P0]: 프리미엄이어도 ageBand/incomeBand가 없으면 안내를 보여주고 fetchBenchmark를 호출하지 않는다", async () => {
    const incompleteProfile = {
      ...getProfile(),
      onboarded: true,
      isPremium: true,
      ageBand: undefined,
      incomeBand: undefined,
    };
    // 저장소 손상/미설정 시나리오를 시뮬레이션 (타입은 항상 세팅되지만 방어 코드 검증 목적)
    saveProfile(incompleteProfile as unknown as ReturnType<typeof getProfile>);

    const Benchmark = (await import("@/pages/Benchmark")).default;
    expect(() => renderWithRouter(React.createElement(Benchmark))).not.toThrow();

    expect(mockedFetchBenchmark).not.toHaveBeenCalled();
    expect(screen.getByTestId("benchmark-band-required")).toBeInTheDocument();
    expect(screen.queryByTestId("benchmark-summary")).toBeNull();
    expect(screen.queryByTestId("benchmark-locked")).toBeNull();
  });

  // ==========================================================================
  // AC-3: 프리미엄 + 밴드 설정 시 fetch·저장·시각화, 에러 시 마지막 결과 유지
  // ==========================================================================

  it("AC-3a[P0]: fetchBenchmark를 호출해 결과를 저장하고 카테고리별 비교를 시각화한다", async () => {
    patchProfile({ onboarded: true, isPremium: true, ageBand: "31-34", incomeBand: "350-450" });
    addExpense({ amount: 90000, category: "식비", merchant: "김밥천국", memo: "", timestamp: Date.now(), source: "manual" });
    addExpense({ amount: 40000, category: "카페/간식", merchant: "스타벅스", memo: "", timestamp: Date.now(), source: "manual" });

    mockedFetchBenchmark.mockResolvedValueOnce({
      categories: [
        { category: "식비", peerAvg: 120000, diffRatio: -0.25 },
        { category: "카페/간식", peerAvg: 30000, diffRatio: 0.33 },
      ],
    });

    const Benchmark = (await import("@/pages/Benchmark")).default;
    renderWithRouter(React.createElement(Benchmark));

    await waitFor(() => expect(screen.getByTestId("benchmark-summary")).toBeInTheDocument());

    expect(mockedFetchBenchmark).toHaveBeenCalledTimes(1);
    expect(mockedFetchBenchmark).toHaveBeenCalledWith(
      expect.objectContaining({
        ageBand: "31-34",
        incomeBand: "350-450",
        categories: expect.arrayContaining([
          expect.objectContaining({ category: "식비", amount: 90000 }),
          expect.objectContaining({ category: "카페/간식", amount: 40000 }),
        ]),
      }),
    );

    const rows = screen.getAllByTestId("benchmark-category");
    expect(rows.length).toBe(2);
    expect(screen.getByText("AI가 생성한 결과입니다")).toBeInTheDocument();

    const saved = getBenchmark();
    expect(saved).not.toBeNull();
    expect(saved?.ageBand).toBe("31-34");
    expect(saved?.incomeBand).toBe("350-450");
    const 식비 = saved?.categories.find((c) => c.category === "식비");
    expect(식비?.myAmount).toBe(90000);
    expect(식비?.peerAvg).toBe(120000);
  });

  it("AC-3b[P0]: fetchBenchmark가 실패하면 마지막 저장 결과를 그대로 보여주고 Toast를 띄운다", async () => {
    patchProfile({ onboarded: true, isPremium: true, ageBand: "35-38", incomeBand: "250-350" });
    addExpense({ amount: 50000, category: "교통", merchant: "택시", memo: "", timestamp: Date.now(), source: "manual" });

    const previousResult: BenchmarkResult = {
      ageBand: "35-38",
      incomeBand: "250-350",
      categories: [{ category: "교통", myAmount: 999000, peerAvg: 80000, diffRatio: 11.5 }],
      generatedAt: Date.now() - 1000,
    };
    saveBenchmark(previousResult);

    mockedFetchBenchmark.mockRejectedValueOnce({ error: "benchmark fetch failed" });

    const Benchmark = (await import("@/pages/Benchmark")).default;
    renderWithRouter(React.createElement(Benchmark));

    await waitFor(() =>
      expect(screen.getByText("벤치마크 조회에 실패해 이전 결과를 보여드려요")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("benchmark-summary")).toBeInTheDocument();
    const rows = screen.getAllByTestId("benchmark-category");
    expect(rows.length).toBe(1);
    expect(getBenchmark()?.categories[0]?.myAmount).toBe(999000);
  });

  // ==========================================================================
  // AC-4: location.state 없이 진입해도 크래시 없음 · 컴파일 통과
  // ==========================================================================

  it("AC-4a[P0]: 프로필·지출 데이터가 전혀 없어도 location.state 없이 크래시 없이 렌더된다", async () => {
    const Benchmark = (await import("@/pages/Benchmark")).default;

    expect(() =>
      renderWithRouter(React.createElement(Benchmark), { initialEntries: ["/benchmark"] }),
    ).not.toThrow();

    expect(mockedFetchBenchmark).not.toHaveBeenCalled();
    // 기본 프로필은 무료(isPremium: false)이므로 잠금 화면이 보여야 한다
    expect(screen.getByTestId("benchmark-locked")).toBeInTheDocument();
  });

  it("AC-4b[P0]: Benchmark의 default export는 함수 컴포넌트다", async () => {
    const Benchmark = (await import("@/pages/Benchmark")).default;
    expect(typeof Benchmark).toBe("function");
  });
});
