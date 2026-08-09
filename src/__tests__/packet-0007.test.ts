import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

/**
 * Packet 0007: Add Expense 페이지 — /add
 *
 * AC-1: 예시 SMS 붙여넣기·분석 시 폼 프리필
 * AC-2: 금액 0 저장 차단 + 에러 문구
 * AC-3: 저장 성공 토스트·이동, state 없이 직접 진입해도 크래시 없이 빈 폼
 * AC-4: data-testid='save-expense-btn' · 컴파일 통과
 *
 * Implementation target: src/pages/Add.tsx (App.tsx가 이미 이 파일을 /add에 연결)
 *
 * 폼 필드 testid 규약 (Coder가 구현 시 준수):
 *   - data-testid="sms-textarea"   : SMS 붙여넣기 textarea
 *   - '분석' 텍스트를 가진 button   : 붙여넣은 텍스트를 parseSmsText로 분석
 *   - data-testid="amount-input"   : 금액 입력 (inputMode numeric)
 *   - data-testid="merchant-input" : 가맹점 입력
 *   - data-testid="memo-input"     : 메모 입력
 *   - 카테고리는 Chip 텍스트로 노출(예: "카페/간식") — 선택된 Chip은 aria-pressed="true"
 *   - data-testid="save-expense-btn" : 저장 CTA(SubmitFooter)
 */

mockAll();

const SMS_TEXT = "신한카드 승인 스타벅스강남점 8/10 09:15\n12,000원 일시불";
const UNPARSABLE_SMS_TEXT = "안녕하세요 반갑습니다";

describe("Add Expense 페이지 — /add", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==========================================================================
  // AC-1: 예시 SMS 붙여넣기·분석 시 폼 프리필
  // ==========================================================================

  describe("AC-1: SMS 붙여넣기·분석 시 폼 프리필", () => {
    it("AC-1a[P0]: 카드 승인 문자를 붙여넣고 분석하면 금액/가맹점/카테고리가 프리필된다", async () => {
      const Add = (await import("@/pages/Add")).default;
      renderWithRouter(React.createElement(Add));

      const textarea = screen.getByTestId("sms-textarea");
      fireEvent.change(textarea, { target: { value: SMS_TEXT } });
      fireEvent.click(screen.getByRole("button", { name: /분석/ }));

      const amountInput = screen.getByTestId("amount-input") as HTMLInputElement;
      const merchantInput = screen.getByTestId("merchant-input") as HTMLInputElement;
      expect(amountInput.value).toBe("12000");
      expect(merchantInput.value).toBe("스타벅스강남점");

      const cafeChip = screen.getByText("카페/간식");
      expect(cafeChip.closest("[aria-pressed]")?.getAttribute("aria-pressed")).toBe("true");
    });

    it("AC-1b[P0]: 분석에 실패하는 텍스트는 Toast를 띄우고 수동 입력 폼을 그대로 유지한다", async () => {
      const Add = (await import("@/pages/Add")).default;
      renderWithRouter(React.createElement(Add));

      const textarea = screen.getByTestId("sms-textarea");
      fireEvent.change(textarea, { target: { value: UNPARSABLE_SMS_TEXT } });
      fireEvent.click(screen.getByRole("button", { name: /분석/ }));

      const toast = screen.getByRole("status");
      expect(toast).toBeInTheDocument();
      expect(toast.textContent ?? "").toMatch(/인식|실패|찾을 수 없/);

      const amountInput = screen.getByTestId("amount-input") as HTMLInputElement;
      expect(amountInput.disabled).toBe(false);
      expect(amountInput.value === "" || amountInput.value === "0").toBe(true);
    });
  });

  // ==========================================================================
  // AC-2: 금액 0 저장 차단 + 에러 문구
  // ==========================================================================

  describe("AC-2: 금액 0 저장 차단", () => {
    it("AC-2a[P0]: 금액이 0이면 저장이 차단되고 에러 문구가 표시된다", async () => {
      const Add = (await import("@/pages/Add")).default;
      renderWithRouter(React.createElement(Add));

      const amountInput = screen.getByTestId("amount-input") as HTMLInputElement;
      fireEvent.change(amountInput, { target: { value: "0" } });
      fireEvent.change(screen.getByTestId("merchant-input"), { target: { value: "김밥천국" } });

      fireEvent.click(screen.getByTestId("save-expense-btn"));

      expect(screen.getByText("금액을 1원 이상 입력해주세요")).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();

      const { getExpenses } = await import("@/lib/storage/expenses");
      expect(getExpenses().length).toBe(0);
    });

    it("AC-2b[P0]: 금액을 입력하지 않고 저장하면(빈 값=0) 동일한 에러 문구가 표시된다", async () => {
      const Add = (await import("@/pages/Add")).default;
      renderWithRouter(React.createElement(Add));

      fireEvent.change(screen.getByTestId("merchant-input"), { target: { value: "김밥천국" } });
      fireEvent.click(screen.getByTestId("save-expense-btn"));

      expect(screen.getByText("금액을 1원 이상 입력해주세요")).toBeInTheDocument();
      const { getExpenses } = await import("@/lib/storage/expenses");
      expect(getExpenses().length).toBe(0);
    });
  });

  // ==========================================================================
  // AC-3: 저장 성공 토스트·이동, state 없이 직접 진입해도 크래시 없이 빈 폼
  // ==========================================================================

  describe("AC-3: 저장 성공 및 직접 진입 안전성", () => {
    it("AC-3a[P0]: 유효한 값으로 저장하면 지출이 추가되고 토스트 후 /expenses로 이동한다", async () => {
      const Add = (await import("@/pages/Add")).default;
      renderWithRouter(React.createElement(Add));

      fireEvent.change(screen.getByTestId("amount-input"), { target: { value: "5000" } });
      fireEvent.change(screen.getByTestId("merchant-input"), { target: { value: "김밥천국" } });
      fireEvent.change(screen.getByTestId("memo-input"), { target: { value: "점심" } });

      fireEvent.click(screen.getByTestId("save-expense-btn"));

      const toast = screen.getByRole("status");
      expect(toast.textContent ?? "").toMatch(/지출이 추가되었어요/);
      expect(mockNavigate).toHaveBeenCalledWith("/expenses", { state: { added: true } });

      const { getExpenses } = await import("@/lib/storage/expenses");
      const saved = getExpenses();
      expect(saved.length).toBe(1);
      expect(saved[0].amount).toBe(5000);
      expect(saved[0].merchant).toBe("김밥천국");
    });

    it("AC-3b[P0]: location.state 없이 직접 진입해도 크래시 없이 빈 폼을 렌더한다", async () => {
      const Add = (await import("@/pages/Add")).default;

      expect(() =>
        renderWithRouter(React.createElement(Add), { initialEntries: ["/add"] }),
      ).not.toThrow();

      const amountInput = screen.getByTestId("amount-input") as HTMLInputElement;
      const merchantInput = screen.getByTestId("merchant-input") as HTMLInputElement;
      expect(amountInput.value === "" || amountInput.value === "0").toBe(true);
      expect(merchantInput.value).toBe("");
    });
  });

  // ==========================================================================
  // AC-4: data-testid='save-expense-btn' · 컴파일 통과
  // ==========================================================================

  describe("AC-4: testid 및 컴파일 통과", () => {
    it("AC-4a[P0]: data-testid='save-expense-btn' 엘리먼트가 존재하고 버튼이다", async () => {
      const Add = (await import("@/pages/Add")).default;
      renderWithRouter(React.createElement(Add));

      const saveBtn = screen.getByTestId("save-expense-btn");
      expect(saveBtn).toBeInTheDocument();
      expect(saveBtn.tagName).toBe("BUTTON");
    });

    it("AC-4b[P0]: Add의 default export는 함수 컴포넌트다", async () => {
      const Add = (await import("@/pages/Add")).default;
      expect(typeof Add).toBe("function");
    });
  });
});
