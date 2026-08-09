import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, within, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { patchProfile } from "@/lib/storage/profile";
import { saveReport } from "@/lib/storage/reports";
import type { WeeklyReport } from "@/lib/types";

/**
 * Packet 0013: Settings 페이지 — /settings
 *
 * AC-1: 리포트 없을 때 PDF 시도 시 Toast·인쇄 미실행
 * AC-2: 프리미엄+리포트 존재 시 window.print 호출·인쇄 뷰 AI 라벨 포함
 * AC-3: window.open/외부 href 사용 금지 (CP-7)
 * AC-4: 컴파일 통과 (프로필/프리미엄/AI 고지 항목이 크래시 없이 렌더)
 *
 * Implementation target: src/pages/Settings.tsx (App.tsx가 이미 /settings에 연결)
 *
 * 테스트가 요구하는 testid/문구 규약 (Coder가 구현 시 준수):
 *   - data-testid="settings-export-pdf" : PDF 내보내기 액션(버튼을 감싼 컨테이너)
 *   - data-testid="settings-print-view" : 인쇄용 뷰(리포트 존재 + 프리미엄일 때만 렌더)
 *   - 리포트 없음 Toast 문구: "내보낼 리포트가 없어요"
 *   - 인쇄 뷰 AI 라벨 문구: "AI가 생성한 결과입니다" (Report.tsx와 동일 문구 재사용)
 */

mockAll();

function makeReport(overrides: Partial<WeeklyReport> = {}): WeeklyReport {
  const now = 1_700_000_000_000;
  return {
    id: "report-1",
    weekStart: now - 7 * 24 * 60 * 60 * 1000,
    weekEnd: now,
    totalSpent: 320_000,
    categoryBreakdown: [{ category: "식비", amount: 320_000, ratio: 1 }],
    insights: [],
    isAi: true,
    generatedAt: now,
    ...overrides,
  };
}

describe("Settings 페이지 — /settings", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
    window.print = vi.fn();
    window.open = vi.fn();
  });

  // ==========================================================================
  // AC-1: 리포트 없을 때 PDF 미실행
  // ==========================================================================

  it("AC-1[P0]: 리포트가 없으면 PDF 내보내기 클릭 시 Toast를 띄우고 window.print를 호출하지 않는다", async () => {
    patchProfile({ onboarded: true, isPremium: true, premiumUntil: Date.now() + 1000 });

    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings), { initialEntries: ["/settings"] });

    const exportControl = screen.getByTestId("settings-export-pdf");
    fireEvent.click(within(exportControl).getByRole("button"));

    expect(screen.getByText("내보낼 리포트가 없어요")).toBeInTheDocument();
    expect(window.print).not.toHaveBeenCalled();
  });

  it("AC-1b: 리포트가 없으면 인쇄 뷰(settings-print-view)가 렌더되지 않는다", async () => {
    patchProfile({ onboarded: true, isPremium: true, premiumUntil: Date.now() + 1000 });

    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings), { initialEntries: ["/settings"] });

    expect(screen.queryByTestId("settings-print-view")).not.toBeInTheDocument();
    expect(window.print).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // AC-2: 프리미엄+리포트 존재 시 인쇄 실행
  // ==========================================================================

  it("AC-2[P0]: 프리미엄이고 리포트가 있으면 PDF 내보내기 클릭 시 window.print를 정확히 1번 호출한다", async () => {
    patchProfile({ onboarded: true, isPremium: true, premiumUntil: Date.now() + 1000 });
    saveReport(makeReport());

    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings), { initialEntries: ["/settings"] });

    const exportControl = screen.getByTestId("settings-export-pdf");
    fireEvent.click(within(exportControl).getByRole("button"));

    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it("AC-2b: 프리미엄이고 리포트가 있으면 인쇄 뷰에 'AI가 생성한 결과입니다' 라벨이 포함된다", async () => {
    patchProfile({ onboarded: true, isPremium: true, premiumUntil: Date.now() + 1000 });
    saveReport(makeReport({ totalSpent: 450_000 }));

    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings), { initialEntries: ["/settings"] });

    const printView = screen.getByTestId("settings-print-view");
    expect(within(printView).getByText("AI가 생성한 결과입니다")).toBeInTheDocument();
    expect(printView).toBeInTheDocument();
  });

  it("AC-2c: 프리미엄이 아니면 리포트가 있어도 window.print를 호출하지 않는다", async () => {
    patchProfile({ onboarded: true, isPremium: false, premiumUntil: null });
    saveReport(makeReport());

    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings), { initialEntries: ["/settings"] });

    const exportControl = screen.getByTestId("settings-export-pdf");
    fireEvent.click(within(exportControl).getByRole("button"));

    expect(window.print).not.toHaveBeenCalled();
    expect(screen.queryByTestId("settings-print-view")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // AC-3: 외부 이탈 금지 (CP-7)
  // ==========================================================================

  it("AC-3: window.open을 호출하지 않고 외부 도메인으로 향하는 href가 없다", async () => {
    patchProfile({ onboarded: true, isPremium: true, premiumUntil: Date.now() + 1000 });
    saveReport(makeReport());

    const Settings = (await import("@/pages/Settings")).default;
    const { container } = renderWithRouter(React.createElement(Settings), {
      initialEntries: ["/settings"],
    });

    const exportControl = screen.getByTestId("settings-export-pdf");
    fireEvent.click(within(exportControl).getByRole("button"));

    expect(window.open).not.toHaveBeenCalled();
    const externalLinks = Array.from(container.querySelectorAll("a[href]")).filter((a) =>
      /^https?:\/\//.test(a.getAttribute("href") ?? ""),
    );
    expect(externalLinks).toHaveLength(0);
  });

  // ==========================================================================
  // AC-4: 컴파일 통과 — 프로필/프리미엄/AI 고지 항목이 크래시 없이 렌더
  // ==========================================================================

  it("AC-4[P0]: 프로필 정보(연령대/소득대)와 AI 고지 재확인 항목이 크래시 없이 렌더된다", async () => {
    patchProfile({
      onboarded: true,
      ageBand: "31-34",
      incomeBand: "350-450",
      isPremium: false,
      premiumUntil: null,
    });

    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings), { initialEntries: ["/settings"] });

    expect(screen.getByText(/31-34/)).toBeInTheDocument();
    expect(screen.getByText(/350-450|350-450만/)).toBeInTheDocument();
  });

  it("AC-4b: 프리미엄 사용자는 설정 화면에서 프리미엄 상태 문구를 볼 수 있다", async () => {
    patchProfile({
      onboarded: true,
      isPremium: true,
      premiumUntil: Date.now() + 10 * 24 * 60 * 60 * 1000,
    });

    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings), { initialEntries: ["/settings"] });

    expect(screen.getByText(/프리미엄/)).toBeInTheDocument();
    expect(screen.getByTestId("settings-export-pdf")).toBeInTheDocument();
  });
});
