import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { patchProfile } from "@/lib/storage/profile";
import { addExpense } from "@/lib/storage/expenses";
import { saveReport } from "@/lib/storage/reports";
import { analyzeWeek } from "@/lib/api/client";
import type { WeeklyReport } from "@/lib/types";

/**
 * Packet 0009: Weekly Report 페이지 — /report
 *
 * AC-1: 지출 3건 미만 시 API 미호출·안내
 * AC-2: 3건 이상 시 리워드 광고 후 analyzeWeek 호출·요약 표시·각 카드 AI Badge
 * AC-3: 무료 사용자는 1개+잠금 카드, API 에러 시 이전 리포트 유지·Toast
 * AC-4: location.state 없이 진입해도 크래시 없음·컴파일 통과
 *
 * Implementation target: src/pages/Report.tsx (App.tsx가 이미 /report에 연결)
 *
 * 테스트가 요구하는 testid/문구 규약 (Coder가 구현 시 준수):
 *   - data-testid="report-insufficient"  : 3건 미만일 때 안내 컨테이너 ("3건" 문구 포함)
 *   - data-testid="report-summary"       : 리포트 언락 후 요약 컨테이너
 *   - data-testid="report-total-amount"  : 이번 주(또는 유지된 이전 리포트) 총지출 Amount
 *   - data-testid="report-insight"       : 잠금 해제된 인사이트 카드 (getAllByTestId)
 *   - data-testid="report-locked-insight": 무료 사용자에게 잠긴 인사이트 카드 (getAllByTestId)
 *   - 각 report-insight 카드 내부에 "AI가 생성한 결과입니다" 텍스트(Badge) 포함
 *   - 잠금 카드의 구독 유도 버튼: 텍스트 "구독하고 전체 보기" → 클릭 시 navigate("/premium", { state: { from: "report" } })
 *   - API 에러 시 Toast 문구: "리포트 분석에 실패해 이전 결과를 보여드려요"
 */

mockAll();

vi.mock("@/lib/api/client", () => ({
  analyzeWeek: vi.fn(),
  fetchBenchmark: vi.fn(),
}));

const mockedAnalyzeWeek = vi.mocked(analyzeWeek);

function seedThisWeekExpenses(amounts: number[]) {
  const now = Date.now();
  amounts.forEach((amount, i) => {
    addExpense({
      amount,
      category: "식비",
      merchant: `가맹점${i}`,
      memo: "",
      timestamp: now - i * 1000,
      source: "manual",
    });
  });
}

const mockInsights = [
  {
    type: "subscription_dup" as const,
    title: "구독 중복 결제 2건",
    description: "넷플릭스와 왓챠가 겹쳐요",
    savingPotential: 9900,
  },
  {
    type: "delivery_overspend" as const,
    title: "배달비 과다 지출",
    description: "이번 주 배달을 6번 시켰어요",
    savingPotential: 15000,
  },
];

describe("Weekly Report 페이지 — /report", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedAnalyzeWeek.mockReset();
    mockNavigate.mockReset();
  });

  // ==========================================================================
  // AC-1: 3건 미만 시 API 미호출·안내
  // ==========================================================================

  it("AC-1[P0]: 이번 주 지출이 3건 미만이면 analyzeWeek을 호출하지 않고 안내 문구를 보여준다", async () => {
    patchProfile({ onboarded: true, isPremium: false });
    seedThisWeekExpenses([5000, 3000]); // 2건 — 미달

    const Report = (await import("@/pages/Report")).default;
    expect(() => renderWithRouter(React.createElement(Report))).not.toThrow();

    expect(mockedAnalyzeWeek).not.toHaveBeenCalled();
    const guidance = screen.getByTestId("report-insufficient");
    expect(guidance.textContent ?? "").toMatch(/3건/);
    expect(screen.queryByTestId("report-summary")).toBeNull();
  });

  // ==========================================================================
  // AC-2: 정상 시 리워드 광고 후 analyzeWeek 호출·요약 표시·각 카드 AI Badge
  // ==========================================================================

  it("AC-2[P0]: 3건 이상이면 analyzeWeek을 호출해 요약과 인사이트 카드마다 AI 배지를 보여준다", async () => {
    patchProfile({ onboarded: true, isPremium: true });
    seedThisWeekExpenses([10000, 8000, 20000]); // 합계 38,000원

    mockedAnalyzeWeek.mockResolvedValueOnce({
      insights: mockInsights,
      summary: "이번 주 배달과 구독에서 새는 돈을 줄일 수 있어요",
    });

    const Report = (await import("@/pages/Report")).default;
    renderWithRouter(React.createElement(Report));

    await waitFor(() => expect(screen.getByTestId("report-summary")).toBeInTheDocument());

    expect(mockedAnalyzeWeek).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("report-total-amount").textContent ?? "").toMatch(/38,000/);

    const cards = screen.getAllByTestId("report-insight");
    expect(cards.length).toBe(2);
    expect(screen.getAllByText("AI가 생성한 결과입니다").length).toBe(2);
    expect(screen.queryByTestId("report-locked-insight")).toBeNull();
  });

  // ==========================================================================
  // AC-3: 무료 사용자는 1개+잠금 카드, API 에러 시 이전 리포트 유지·Toast
  // ==========================================================================

  it("AC-3a[P0]: 무료 사용자는 인사이트 1개만 보이고 나머지는 잠금 카드로 표시되며, 잠금 카드는 /premium으로 이동시킨다", async () => {
    patchProfile({ onboarded: true, isPremium: false });
    seedThisWeekExpenses([10000, 8000, 20000]);

    mockedAnalyzeWeek.mockResolvedValueOnce({
      insights: mockInsights,
      summary: "이번 주 배달과 구독에서 새는 돈을 줄일 수 있어요",
    });

    const Report = (await import("@/pages/Report")).default;
    renderWithRouter(React.createElement(Report));

    await waitFor(() => expect(screen.getByTestId("report-summary")).toBeInTheDocument());

    expect(screen.getAllByTestId("report-insight").length).toBe(1);
    const locked = screen.getAllByTestId("report-locked-insight");
    expect(locked.length).toBe(1);
    expect(screen.getAllByText("AI가 생성한 결과입니다").length).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "구독하고 전체 보기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/premium", { state: { from: "report" } });
  });

  it("AC-3b[P0]: API 에러 시 저장된 이전 리포트를 그대로 보여주고 Toast를 띄운다", async () => {
    patchProfile({ onboarded: true, isPremium: true });
    seedThisWeekExpenses([10000, 8000, 20000]);

    const previousReport: WeeklyReport = {
      id: "prev-1",
      weekStart: Date.now() - 14 * 24 * 60 * 60 * 1000,
      weekEnd: Date.now() - 7 * 24 * 60 * 60 * 1000,
      totalSpent: 99000,
      categoryBreakdown: [{ category: "식비", amount: 99000, ratio: 1 }],
      insights: [
        {
          type: "impulse_time",
          title: "이전 리포트 인사이트",
          description: "지난 주 심야 지출이 많았어요",
          savingPotential: 12000,
        },
      ],
      isAi: true,
      generatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    };
    saveReport(previousReport);

    mockedAnalyzeWeek.mockRejectedValueOnce({ error: "analysis failed" });

    const Report = (await import("@/pages/Report")).default;
    renderWithRouter(React.createElement(Report));

    await waitFor(() =>
      expect(screen.getByText("리포트 분석에 실패해 이전 결과를 보여드려요")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("report-total-amount").textContent ?? "").toMatch(/99,000/);
    expect(screen.getByText("이전 리포트 인사이트")).toBeInTheDocument();
  });

  // ==========================================================================
  // AC-4: location.state 없이 진입해도 크래시 없음·컴파일 통과
  // ==========================================================================

  it("AC-4a[P0]: 프로필·지출 데이터가 전혀 없어도 location.state 없이 크래시 없이 렌더된다", async () => {
    const Report = (await import("@/pages/Report")).default;

    expect(() =>
      renderWithRouter(React.createElement(Report), { initialEntries: ["/report"] }),
    ).not.toThrow();

    expect(mockedAnalyzeWeek).not.toHaveBeenCalled();
    expect(screen.getByTestId("report-insufficient")).toBeInTheDocument();
  });

  it("AC-4b[P0]: Report의 default export는 함수 컴포넌트다", async () => {
    const Report = (await import("@/pages/Report")).default;
    expect(typeof Report).toBe("function");
  });
});
