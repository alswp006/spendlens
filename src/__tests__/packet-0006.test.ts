import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

/**
 * Packet 0006: Home Dashboard 페이지 — /
 *
 * AC-1: 이번 달 총지출 SummaryHero(CountUp) — data-testid='month-total-hero'
 * AC-2: 카테고리 비중 MiniBar 리스트(내림차순 top3) — data-testid='category-breakdown'
 * AC-3: 0건 시 EmptyState, 터치타깃 44px 이상
 * AC-4: 컴파일 통과
 *
 * Implementation target: src/pages/Home.tsx
 */

mockAll();

const DAY_MS = 24 * 60 * 60 * 1000;

function thisMonthTimestamp(): number {
  return Date.now();
}

function lastMonthTimestamp(): number {
  return Date.now() - 40 * DAY_MS;
}

describe("Home Dashboard 페이지 — /", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==========================================================================
  // AC-1: 이번 달 총지출 SummaryHero
  // ==========================================================================

  describe("AC-1: 이번 달 총지출 합산", () => {
    it("AC-1a[P0]: 식비 12,000원 + 배달 20,000원 지출 시 month-total-hero가 32,000원을 표시한다", async () => {
      const { addExpense } = await import("@/lib/storage/expenses");
      addExpense({
        amount: 12000,
        category: "식비",
        merchant: "김밥천국",
        memo: "",
        timestamp: thisMonthTimestamp(),
        source: "manual",
      });
      addExpense({
        amount: 20000,
        category: "배달",
        merchant: "배달의민족",
        memo: "",
        timestamp: thisMonthTimestamp(),
        source: "manual",
      });

      const Home = (await import("@/pages/Home")).default;
      renderWithRouter(React.createElement(Home));

      const hero = screen.getByTestId("month-total-hero");
      expect(hero).toBeInTheDocument();
      expect(hero.textContent).toMatch(/32,000/);
      expect(hero.textContent).toMatch(/원/);
    });

    it("AC-1b[P0]: 지난달 지출은 이번 달 합계에서 제외된다", async () => {
      const { addExpense } = await import("@/lib/storage/expenses");
      addExpense({
        amount: 12000,
        category: "식비",
        merchant: "김밥천국",
        memo: "",
        timestamp: thisMonthTimestamp(),
        source: "manual",
      });
      addExpense({
        amount: 999000,
        category: "쇼핑",
        merchant: "지난달백화점",
        memo: "",
        timestamp: lastMonthTimestamp(),
        source: "manual",
      });

      const Home = (await import("@/pages/Home")).default;
      renderWithRouter(React.createElement(Home));

      const hero = screen.getByTestId("month-total-hero");
      expect(hero.textContent).toMatch(/12,000/);
      expect(hero.textContent).not.toMatch(/999,000/);
    });
  });

  // ==========================================================================
  // AC-2: 카테고리 비중 MiniBar 리스트(내림차순 top3)
  // ==========================================================================

  describe("AC-2: 카테고리 비중 내림차순 top3", () => {
    it("AC-2a[P0]: 카테고리별 지출이 금액 내림차순으로 렌더된다", async () => {
      const { addExpense } = await import("@/lib/storage/expenses");
      addExpense({ amount: 10000, category: "교통", merchant: "지하철", memo: "", timestamp: thisMonthTimestamp(), source: "manual" });
      addExpense({ amount: 50000, category: "식비", merchant: "맛집", memo: "", timestamp: thisMonthTimestamp(), source: "manual" });
      addExpense({ amount: 30000, category: "쇼핑", merchant: "마켓", memo: "", timestamp: thisMonthTimestamp(), source: "manual" });

      const Home = (await import("@/pages/Home")).default;
      renderWithRouter(React.createElement(Home));

      const breakdown = screen.getByTestId("category-breakdown");
      expect(breakdown).toBeInTheDocument();
      const text = breakdown.textContent ?? "";
      const foodIdx = text.indexOf("식비");
      const shoppingIdx = text.indexOf("쇼핑");
      const transitIdx = text.indexOf("교통");
      expect(foodIdx).toBeGreaterThanOrEqual(0);
      expect(foodIdx).toBeLessThan(shoppingIdx);
      expect(shoppingIdx).toBeLessThan(transitIdx);
    });

    it("AC-2b[P0]: 카테고리가 4개 이상이어도 상위 3개까지만 렌더된다", async () => {
      const { addExpense } = await import("@/lib/storage/expenses");
      addExpense({ amount: 50000, category: "식비", merchant: "맛집", memo: "", timestamp: thisMonthTimestamp(), source: "manual" });
      addExpense({ amount: 40000, category: "쇼핑", merchant: "마켓", memo: "", timestamp: thisMonthTimestamp(), source: "manual" });
      addExpense({ amount: 30000, category: "교통", merchant: "지하철", memo: "", timestamp: thisMonthTimestamp(), source: "manual" });
      addExpense({ amount: 20000, category: "구독", merchant: "넷플릭스", memo: "", timestamp: thisMonthTimestamp(), source: "manual" });
      addExpense({ amount: 10000, category: "기타", merchant: "잡화", memo: "", timestamp: thisMonthTimestamp(), source: "manual" });

      const Home = (await import("@/pages/Home")).default;
      renderWithRouter(React.createElement(Home));

      const breakdown = screen.getByTestId("category-breakdown");
      const bars = within(breakdown).getAllByRole("progressbar");
      expect(bars.length).toBe(3);
      const text = breakdown.textContent ?? "";
      expect(text).not.toMatch(/기타/);
    });
  });

  // ==========================================================================
  // AC-3: 0건 시 EmptyState, 터치타깃 44px 이상
  // ==========================================================================

  describe("AC-3: 0건 시 EmptyState", () => {
    it("AC-3a[P0]: 지출이 0건이면 EmptyState와 지출 추가 CTA가 렌더된다", async () => {
      const Home = (await import("@/pages/Home")).default;
      renderWithRouter(React.createElement(Home));

      expect(screen.queryByTestId("category-breakdown")).not.toBeInTheDocument();
      const cta = screen.getByTestId("home-add-expense-cta");
      expect(cta).toBeInTheDocument();
      expect(cta.tagName).toBe("BUTTON");
    });

    it("AC-3b[P0]: 지출 추가 CTA의 터치 타깃이 44px 이상이다", async () => {
      const Home = (await import("@/pages/Home")).default;
      renderWithRouter(React.createElement(Home));

      const cta = screen.getByTestId("home-add-expense-cta");
      const minHeight = parseFloat(getComputedStyle(cta).minHeight || "0");
      const height = parseFloat(getComputedStyle(cta).height || "0");
      expect(Math.max(minHeight, height)).toBeGreaterThanOrEqual(44);
      expect(cta.tagName).toBe("BUTTON");
    });
  });

  // ==========================================================================
  // 추가: 내비게이션 — 카테고리/항목 탭→/expenses, 지출 추가→/add, 리포트 보기→/report
  // ==========================================================================

  describe("내비게이션", () => {
    it("지출 추가 CTA를 누르면 /add로 이동한다", async () => {
      const Home = (await import("@/pages/Home")).default;
      renderWithRouter(React.createElement(Home));

      fireEvent.click(screen.getByTestId("home-add-expense-cta"));
      expect(mockNavigate).toHaveBeenCalledWith("/add");
    });

    it("카테고리 비중 영역을 누르면 /expenses로 이동한다", async () => {
      const { addExpense } = await import("@/lib/storage/expenses");
      addExpense({ amount: 12000, category: "식비", merchant: "김밥천국", memo: "", timestamp: thisMonthTimestamp(), source: "manual" });

      const Home = (await import("@/pages/Home")).default;
      renderWithRouter(React.createElement(Home));

      fireEvent.click(screen.getByTestId("category-breakdown"));
      expect(mockNavigate).toHaveBeenCalledWith("/expenses");
    });
  });

  // ==========================================================================
  // AC-4: 컴파일 통과
  // ==========================================================================

  describe("AC-4: 컴파일 통과", () => {
    it("AC-4: Home의 default export는 함수 컴포넌트다", async () => {
      const Home = (await import("@/pages/Home")).default;
      expect(typeof Home).toBe("function");
    });
  });
});
