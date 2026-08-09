import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { fireEvent, screen } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

/**
 * Packet 0005: Onboarding 페이지 — /onboarding
 *
 * AC-1: 두 밴드(연령대/소득대) 모두 선택 전 CTA disabled
 * AC-2: 선택 후 프로필 저장(ageBand/incomeBand/onboarded:true) + navigate('/', { replace: true })
 * AC-3: data-testid='onboarding-cta' 존재, 소스에 HEX 컬러 리터럴 0개
 * AC-4: 컴파일 통과 (default export가 함수)
 *
 * Implementation target: src/pages/Onboarding.tsx
 */

mockAll();

describe("Onboarding 페이지 — /onboarding", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==========================================================================
  // AC-1: CTA disabled until both bands selected
  // ==========================================================================

  describe("AC-1: 두 밴드 모두 선택 전 CTA disabled", () => {
    it("AC-1a[P0]: 아무것도 선택하지 않으면 CTA가 disabled다", async () => {
      const Onboarding = (await import("@/pages/Onboarding")).default;
      renderWithRouter(React.createElement(Onboarding));

      const cta = screen.getByTestId("onboarding-cta");
      expect(cta).toBeDisabled();
      expect(cta.tagName).toBe("BUTTON");
    });

    it("AC-1b[P0]: 연령대만 선택하고 소득대를 선택하지 않으면 CTA가 여전히 disabled다", async () => {
      const Onboarding = (await import("@/pages/Onboarding")).default;
      renderWithRouter(React.createElement(Onboarding));

      fireEvent.click(screen.getByText("25-30세"));

      const cta = screen.getByTestId("onboarding-cta");
      expect(cta).toBeDisabled();
      expect(cta.tagName).toBe("BUTTON");
    });
  });

  // ==========================================================================
  // AC-2: 선택 후 저장 + 홈 이동(replace)
  // ==========================================================================

  describe("AC-2: 선택 후 저장·홈 이동(replace)", () => {
    it("AC-2a[P0]: 두 밴드를 선택하고 CTA를 누르면 프로필을 저장하고 '/'로 replace 이동한다", async () => {
      const Onboarding = (await import("@/pages/Onboarding")).default;
      renderWithRouter(React.createElement(Onboarding));

      fireEvent.click(screen.getByText("25-30세"));
      fireEvent.click(screen.getByText("250-350만 원"));

      const cta = screen.getByTestId("onboarding-cta");
      expect(cta).not.toBeDisabled();

      fireEvent.click(cta);

      const { getProfile } = await import("@/lib/storage/profile");
      const saved = getProfile();
      expect(saved.ageBand).toBe("25-30");
      expect(saved.incomeBand).toBe("250-350");
      expect(saved.onboarded).toBe(true);

      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    it("AC-2b[P0]: CTA 클릭 시 success 햅틱이, Chip 선택 시 tickWeak 햅틱이 호출된다", async () => {
      const { generateHapticFeedback } = await import("@apps-in-toss/web-framework");
      const Onboarding = (await import("@/pages/Onboarding")).default;
      renderWithRouter(React.createElement(Onboarding));

      fireEvent.click(screen.getByText("25-30세"));
      expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });

      fireEvent.click(screen.getByText("250-350만 원"));
      fireEvent.click(screen.getByTestId("onboarding-cta"));

      expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
    });
  });

  // ==========================================================================
  // AC-2 (부가): AI 활용 고지 AlertDialog — aiNoticeAcknowledged=false일 때 1회 표시
  // ==========================================================================

  describe("AI 활용 고지", () => {
    it("aiNoticeAcknowledged가 false면 AlertDialog가 보이고, 확인을 누르면 ack된다", async () => {
      const Onboarding = (await import("@/pages/Onboarding")).default;
      renderWithRouter(React.createElement(Onboarding));

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();

      const confirmButtons = screen.getAllByRole("button").filter((btn) =>
        /확인/.test(btn.textContent ?? ""),
      );
      fireEvent.click(confirmButtons[0]);

      const { getProfile } = await import("@/lib/storage/profile");
      expect(getProfile().aiNoticeAcknowledged).toBe(true);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // AC-3: data-testid='onboarding-cta' 존재 + HEX 리터럴 0개
  // ==========================================================================

  describe("AC-3: testid 및 HEX 컬러 금지", () => {
    it("AC-3a[P0]: data-testid='onboarding-cta' 엘리먼트가 존재한다", async () => {
      const Onboarding = (await import("@/pages/Onboarding")).default;
      renderWithRouter(React.createElement(Onboarding));

      const cta = screen.getByTestId("onboarding-cta");
      expect(cta).toBeInTheDocument();
      expect(cta.tagName).toBe("BUTTON");
    });

    it("AC-3b[P0]: 소스 코드에 HEX 컬러 리터럴이 없다", () => {
      const filePath = path.resolve(__dirname, "../pages/Onboarding.tsx");
      const source = fs.readFileSync(filePath, "utf-8");
      const hexMatches = source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];

      expect(hexMatches).toEqual([]);
      expect(source.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // AC-4: 컴파일 통과
  // ==========================================================================

  describe("AC-4: 컴파일 통과", () => {
    it("AC-4: Onboarding의 default export는 함수 컴포넌트다", async () => {
      const Onboarding = (await import("@/pages/Onboarding")).default;
      expect(typeof Onboarding).toBe("function");
    });
  });
});
