import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { UserProfile } from "@/lib/types";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";

/**
 * Packet 0014: 라우터 배선 + 온보딩 가드 + FloatingTabBar
 *
 * Contract this test file establishes for the Coder:
 * - src/components/RouteGuard.tsx exports `RouteGuard({ onboarded, children })`.
 *   If `onboarded` is false it renders `<Navigate to="/onboarding" replace />`,
 *   otherwise it renders `children` as-is.
 * - src/App.tsx reads `UserProfile` from localStorage key "spendlens.profile.v1"
 *   (missing/corrupt -> treated as `onboarded:false`), wraps every protected route
 *   (everything except "/onboarding") in <RouteGuard>, and renders the shared
 *   FloatingTabBar (홈/내역/리포트/설정 -> "/", "/expenses", "/report", "/settings").
 * - Page components live at src/pages/{Home,Onboarding,Add,Expenses,Report,
 *   Benchmark,Challenge,Premium,Settings}.tsx (PascalCase, no "Page" suffix,
 *   default export) and are wired one-to-one to the 9 RouteState paths.
 *
 * AC-1: onboarded:false로 /report 직접 진입 시 /onboarding 리다이렉트
 * AC-2: 온보딩 완료 후 탭 네비 정상
 * AC-3: 새로고침·직접 링크 진입 시 어느 경로도 크래시 없음
 * AC-4: 컴파일 통과 (tsc --noEmit — 별도 빌드 단계에서 검증, 여기서는 런타임 동작만 검증)
 */

mockTds();
mockAppsInToss();
mockTossRewardAd();

// Page components are mocked so App.tsx routing is tested in isolation from
// individual page content/implementation (owned by other packets).
vi.mock("@/pages/Home", () => ({
  default: () => React.createElement("div", { "data-testid": "page-home" }, "홈 화면"),
}));
vi.mock("@/pages/Onboarding", () => ({
  default: () => React.createElement("div", { "data-testid": "page-onboarding" }, "온보딩 화면"),
}));
vi.mock("@/pages/Add", () => ({
  default: () => React.createElement("div", { "data-testid": "page-add" }, "기록 추가 화면"),
}));
vi.mock("@/pages/Expenses", () => ({
  default: () => React.createElement("div", { "data-testid": "page-expenses" }, "내역 화면"),
}));
vi.mock("@/pages/Report", () => ({
  default: () => React.createElement("div", { "data-testid": "page-report" }, "리포트 화면"),
}));
vi.mock("@/pages/Benchmark", () => ({
  default: () => React.createElement("div", { "data-testid": "page-benchmark" }, "벤치마크 화면"),
}));
vi.mock("@/pages/Challenge", () => ({
  default: () => React.createElement("div", { "data-testid": "page-challenge" }, "챌린지 화면"),
}));
vi.mock("@/pages/Premium", () => ({
  default: () => React.createElement("div", { "data-testid": "page-premium" }, "프리미엄 화면"),
}));
vi.mock("@/pages/Settings", () => ({
  default: () => React.createElement("div", { "data-testid": "page-settings" }, "설정 화면"),
}));

const { default: App } = await import("@/App");
const { RouteGuard } = await import("@/components/RouteGuard");

const PROFILE_KEY = "spendlens.profile.v1";

function seedProfile(onboarded: boolean) {
  const profile: UserProfile = {
    ageBand: "25-30",
    incomeBand: "250-350",
    isPremium: false,
    premiumUntil: null,
    aiNoticeAcknowledged: false,
    onboarded,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

const PROTECTED_ROUTES = [
  ["/", "page-home"],
  ["/add", "page-add"],
  ["/expenses", "page-expenses"],
  ["/report", "page-report"],
  ["/benchmark", "page-benchmark"],
  ["/challenge", "page-challenge"],
  ["/premium", "page-premium"],
  ["/settings", "page-settings"],
] as const;

const ALL_ROUTES = ["/", "/onboarding", ...PROTECTED_ROUTES.map(([path]) => path)];

function renderApp(initialEntry: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [initialEntry] }, React.createElement(App)),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("라우터 배선 + 온보딩 가드 + FloatingTabBar", () => {
  // ============================================================================
  // AC-1: onboarded:false로 보호 경로 직접 진입 시 /onboarding 리다이렉트
  // ============================================================================
  describe("AC-1[P0]: 온보딩 가드", () => {
    it("RouteGuard(onboarded=false)는 children 대신 /onboarding으로 리다이렉트한다", () => {
      render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/report"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/onboarding",
              element: React.createElement("div", null, "온보딩 라우트"),
            }),
            React.createElement(Route, {
              path: "/report",
              element: React.createElement(
                RouteGuard,
                { onboarded: false },
                React.createElement("div", null, "리포트 라우트"),
              ),
            }),
          ),
        ),
      );

      expect(screen.getByText("온보딩 라우트")).toBeInTheDocument();
      expect(screen.queryByText("리포트 라우트")).not.toBeInTheDocument();
    });

    it("RouteGuard(onboarded=true)는 children을 그대로 렌더한다", () => {
      render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/report"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/onboarding",
              element: React.createElement("div", null, "온보딩 라우트"),
            }),
            React.createElement(Route, {
              path: "/report",
              element: React.createElement(
                RouteGuard,
                { onboarded: true },
                React.createElement("div", null, "리포트 라우트"),
              ),
            }),
          ),
        ),
      );

      expect(screen.getByText("리포트 라우트")).toBeInTheDocument();
      expect(screen.queryByText("온보딩 라우트")).not.toBeInTheDocument();
    });

    it("App: localStorage onboarded:false 상태에서 /report 직접 진입 시 /onboarding 화면이 렌더된다", () => {
      seedProfile(false);
      renderApp("/report");

      expect(screen.getByTestId("page-onboarding")).toBeInTheDocument();
      expect(screen.queryByTestId("page-report")).not.toBeInTheDocument();
    });

    it("App: localStorage에 프로필이 없어도(getItem null) 기본값 onboarded:false로 취급해 /onboarding으로 보낸다", () => {
      // no seedProfile() call — key is absent
      renderApp("/settings");

      expect(screen.getByTestId("page-onboarding")).toBeInTheDocument();
      expect(screen.queryByTestId("page-settings")).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // AC-2: 온보딩 완료 후 탭 네비 정상
  // ============================================================================
  describe("AC-2[P0]: FloatingTabBar", () => {
    it("onboarded:true면 홈 화면에서 4개 탭(홈/내역/리포트/설정)이 렌더된다", () => {
      seedProfile(true);
      renderApp("/");

      expect(screen.getByTestId("page-home")).toBeInTheDocument();
      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(4);
      expect(screen.getByRole("tab", { name: "홈" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "내역" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "리포트" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "설정" })).toBeInTheDocument();
    });

    it("탭 클릭 시 해당 경로 화면으로 전환된다 (내역 탭 -> /expenses)", () => {
      seedProfile(true);
      renderApp("/");

      fireEvent.click(screen.getByRole("tab", { name: "내역" }));

      expect(screen.getByTestId("page-expenses")).toBeInTheDocument();
      expect(screen.queryByTestId("page-home")).not.toBeInTheDocument();
    });

    it("onboarding 화면에서는 FloatingTabBar가 노출되지 않는다", () => {
      seedProfile(false);
      renderApp("/add");

      expect(screen.getByTestId("page-onboarding")).toBeInTheDocument();
      expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // AC-3: 새로고침·직접 링크 진입 시 어느 경로도 크래시 없음
  // ============================================================================
  describe("AC-3[P0]: 크래시 없는 직접 진입", () => {
    it.each(ALL_ROUTES)("onboarded:true로 %s 직접 진입 시 크래시 없이 렌더된다", (path) => {
      seedProfile(true);
      expect(() => renderApp(path)).not.toThrow();
      expect(document.body.textContent).not.toBe("");
    });

    it.each(PROTECTED_ROUTES.map(([path]) => path))(
      "onboarded:false로 %s 직접 진입 시 크래시 없이 /onboarding으로 리다이렉트된다",
      (path) => {
        seedProfile(false);
        expect(() => renderApp(path)).not.toThrow();
        expect(screen.getByTestId("page-onboarding")).toBeInTheDocument();
      },
    );

    it("정의되지 않은 경로로 진입해도 크래시 없이 렌더된다", () => {
      seedProfile(true);
      expect(() => renderApp("/unknown-path-xyz")).not.toThrow();
      expect(document.body.textContent).not.toBe("");
    });
  });

  // ============================================================================
  // Integration: 모든 Route path에 대응하는 페이지가 존재하고, 탭 이동 대상에
  // 대응하는 Route가 존재하는지
  // ============================================================================
  describe("통합: Route <-> 페이지 매핑", () => {
    it("PROTECTED_ROUTES의 모든 경로가 App에서 각자의 페이지 컴포넌트를 렌더한다", () => {
      seedProfile(true);
      for (const [path, testId] of PROTECTED_ROUTES) {
        const { unmount } = renderApp(path);
        expect(screen.getByTestId(testId)).toBeInTheDocument();
        unmount();
      }
    });

    it("FloatingTabBar의 모든 tab이 이동하는 경로가 App의 Route로 존재한다 (홈/내역/리포트/설정)", () => {
      seedProfile(true);
      renderApp("/");

      const tabTargets: Array<[string, string]> = [
        ["내역", "page-expenses"],
        ["리포트", "page-report"],
        ["설정", "page-settings"],
      ];

      for (const [label, testId] of tabTargets) {
        fireEvent.click(screen.getByRole("tab", { name: label }));
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      }
    });
  });
});
