import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/storage/base";
import { getThisWeek, getThisMonth } from "@/lib/domain/aggregate";
import type { Expense } from "@/lib/types";

/**
 * Packet 0008: Expenses List 페이지 — /expenses
 *
 * AC-1: 삭제 확인 후 목록·합계 갱신
 * AC-2: 탭 전환 시 해당 기간만 필터·합계 반영
 * AC-3: 300건 초과 시 윈도잉, state 없이 직접 진입해도 크래시 없음
 * AC-4: data-testid='expenses-list' · 컴파일 통과
 *
 * Implementation target: src/pages/Expenses.tsx (App.tsx가 이미 이 파일을 /expenses에 연결)
 *
 * 테스트가 요구하는 testid/문구 규약 (Coder가 구현 시 준수):
 *   - data-testid="expenses-list"                 : 리스트 컨테이너(항목 1건 이상일 때)
 *   - data-testid="expenses-empty"                : 빈 상태(EmptyState) 컨테이너
 *   - data-testid="period-total-amount"           : 현재 선택된 기간의 합계 Amount
 *   - data-testid={`expense-row-${expense.id}`}   : 각 지출 ListRow
 *   - Tab.Item 텍스트: "이번 주" / "이번 달" / "전체" (role="tab")
 *   - 삭제 확인 AlertDialog: title="삭제할까요?" (role="alertdialog")
 *   - 다이얼로그 내 삭제 확정 버튼: 텍스트 "삭제"
 */

mockAll();

const DAY_MS = 24 * 60 * 60 * 1000;

function makeExpense(overrides: Partial<Expense> & Pick<Expense, "id" | "timestamp" | "amount">): Expense {
  return {
    category: "식비",
    merchant: "테스트가맹점",
    memo: "",
    source: "manual",
    createdAt: overrides.timestamp,
    ...overrides,
  };
}

/** 이번 달에는 속하지만 이번 주에는 속하지 않는 타임스탬프를 동적으로 계산한다(고정 날짜 하드코딩 금지). */
function timestampInMonthButNotWeek(): number {
  const { start: monthStart, end: monthEnd } = getThisMonth();
  const { start: weekStart, end: weekEnd } = getThisWeek();
  for (let t = monthStart; t <= monthEnd; t += DAY_MS) {
    if (t < weekStart || t > weekEnd) return t + 3600 * 1000;
  }
  return monthStart;
}

function seedExpenses(expenses: Expense[]) {
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
}

describe("Expenses List 페이지 — /expenses", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==========================================================================
  // AC-1: 삭제 확인 후 목록·합계 갱신
  // ==========================================================================

  describe("AC-1: 삭제 확인 후 목록·합계 갱신", () => {
    it("AC-1a[P0]: 삭제 확인 다이얼로그에서 확정하면 목록에서 사라지고 합계가 갱신되며 저장소에서도 제거된다", async () => {
      const now = Date.now();
      seedExpenses([
        makeExpense({ id: "e1", amount: 5000, merchant: "카페A", timestamp: now }),
        makeExpense({ id: "e2", amount: 3000, merchant: "카페B", timestamp: now }),
      ]);

      const Expenses = (await import("@/pages/Expenses")).default;
      renderWithRouter(React.createElement(Expenses));

      expect(screen.getByTestId("period-total-amount").textContent ?? "").toMatch(/8,000/);

      fireEvent.click(screen.getByTestId("expense-row-e1"));

      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByText("삭제할까요?")).toBeInTheDocument();

      fireEvent.click(within(dialog).getByText("삭제"));

      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(screen.queryByTestId("expense-row-e1")).toBeNull();
      expect(screen.getByTestId("period-total-amount").textContent ?? "").toMatch(/3,000/);

      const { getExpenses } = await import("@/lib/storage/expenses");
      const remaining = getExpenses();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe("e2");
    });

    it("AC-1b[P0]: 다이얼로그를 닫기(취소)하면 삭제되지 않고 목록·합계가 그대로 유지된다", async () => {
      const now = Date.now();
      seedExpenses([
        makeExpense({ id: "e1", amount: 5000, merchant: "카페A", timestamp: now }),
        makeExpense({ id: "e2", amount: 3000, merchant: "카페B", timestamp: now }),
      ]);

      const Expenses = (await import("@/pages/Expenses")).default;
      renderWithRouter(React.createElement(Expenses));

      fireEvent.click(screen.getByTestId("expense-row-e1"));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByLabelText("닫기"));

      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(screen.getByTestId("expense-row-e1")).toBeInTheDocument();
      expect(screen.getByTestId("period-total-amount").textContent ?? "").toMatch(/8,000/);

      const { getExpenses } = await import("@/lib/storage/expenses");
      expect(getExpenses().length).toBe(2);
    });
  });

  // ==========================================================================
  // AC-2: 탭 전환 시 해당 기간만 필터·합계 반영
  // ==========================================================================

  describe("AC-2: 탭 전환 시 기간 필터·합계 반영", () => {
    it("AC-2a[P0]: '이번 주' 탭은 이번 주 항목만 노출하고 합계도 해당 항목만 반영한다", async () => {
      const weekTimestamp = Date.now();
      const monthOnlyTimestamp = timestampInMonthButNotWeek();
      const outsideTimestamp = getThisMonth().start - 10 * DAY_MS;

      seedExpenses([
        makeExpense({ id: "w1", amount: 5000, merchant: "스타벅스", timestamp: weekTimestamp }),
        makeExpense({ id: "m1", amount: 3000, merchant: "이마트", timestamp: monthOnlyTimestamp }),
        makeExpense({ id: "o1", amount: 7000, merchant: "옛날거래", timestamp: outsideTimestamp }),
      ]);

      const Expenses = (await import("@/pages/Expenses")).default;
      renderWithRouter(React.createElement(Expenses));

      fireEvent.click(screen.getByRole("tab", { name: "이번 주" }));

      expect(screen.getByText("스타벅스")).toBeInTheDocument();
      expect(screen.queryByText("이마트")).toBeNull();
      expect(screen.queryByText("옛날거래")).toBeNull();
      expect(screen.getByTestId("period-total-amount").textContent ?? "").toMatch(/5,000/);
    });

    it("AC-2b[P0]: '전체' 탭은 지난달 항목까지 모두 노출하고 합계도 전부 반영한다", async () => {
      const weekTimestamp = Date.now();
      const monthOnlyTimestamp = timestampInMonthButNotWeek();
      const outsideTimestamp = getThisMonth().start - 10 * DAY_MS;

      seedExpenses([
        makeExpense({ id: "w1", amount: 5000, merchant: "스타벅스", timestamp: weekTimestamp }),
        makeExpense({ id: "m1", amount: 3000, merchant: "이마트", timestamp: monthOnlyTimestamp }),
        makeExpense({ id: "o1", amount: 7000, merchant: "옛날거래", timestamp: outsideTimestamp }),
      ]);

      const Expenses = (await import("@/pages/Expenses")).default;
      renderWithRouter(React.createElement(Expenses));

      fireEvent.click(screen.getByRole("tab", { name: "전체" }));

      expect(screen.getByText("스타벅스")).toBeInTheDocument();
      expect(screen.getByText("이마트")).toBeInTheDocument();
      expect(screen.getByText("옛날거래")).toBeInTheDocument();
      expect(screen.getByTestId("period-total-amount").textContent ?? "").toMatch(/15,000/);
    });
  });

  // ==========================================================================
  // AC-3: 300건 초과 시 윈도잉, state 없이 직접 진입해도 크래시 없음
  // ==========================================================================

  describe("AC-3: 대량 데이터 윈도잉 및 안전한 직접 진입", () => {
    it("AC-3a[P0]: 300건 초과 데이터는 한 번에 모두 렌더되지 않고 윈도잉된다", async () => {
      const now = Date.now();
      const many: Expense[] = Array.from({ length: 350 }, (_, i) =>
        makeExpense({ id: `bulk-${i}`, amount: 1000, timestamp: now - i * 1000 }),
      );
      seedExpenses(many);

      const Expenses = (await import("@/pages/Expenses")).default;
      expect(() => renderWithRouter(React.createElement(Expenses))).not.toThrow();

      fireEvent.click(screen.getByRole("tab", { name: "전체" }));

      const rows = screen.getAllByRole("listitem");
      expect(rows.length).toBeLessThan(350);
      expect(rows.length).toBeLessThanOrEqual(300);
    });

    it("AC-3b[P0]: location.state 없이 직접 진입해도 크래시 없이 빈 상태를 렌더한다", async () => {
      const Expenses = (await import("@/pages/Expenses")).default;

      expect(() =>
        renderWithRouter(React.createElement(Expenses), { initialEntries: ["/expenses"] }),
      ).not.toThrow();

      expect(screen.getByTestId("expenses-empty")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // AC-4: data-testid='expenses-list' · 컴파일 통과
  // ==========================================================================

  describe("AC-4: testid 및 컴파일 통과", () => {
    it("AC-4a[P0]: 지출이 있을 때 data-testid='expenses-list' 컨테이너가 렌더된다", async () => {
      seedExpenses([makeExpense({ id: "e1", amount: 5000, timestamp: Date.now() })]);

      const Expenses = (await import("@/pages/Expenses")).default;
      renderWithRouter(React.createElement(Expenses));

      const list = screen.getByTestId("expenses-list");
      expect(list).toBeInTheDocument();
      expect(screen.getByTestId("expense-row-e1")).toBeInTheDocument();
    });

    it("AC-4b[P0]: Expenses의 default export는 함수 컴포넌트다", async () => {
      const Expenses = (await import("@/pages/Expenses")).default;
      expect(typeof Expenses).toBe("function");
    });
  });
});
