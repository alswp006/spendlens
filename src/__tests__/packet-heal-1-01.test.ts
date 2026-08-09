import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { seedLocalStorage } from "@/__tests__/__helpers__/test-utils";

// TDS + SDK + TossRewardAd + react-router-dom(useNavigate만 목, useLocation/Navigate는 실제) 목
mockAll();

import { RouteGuard } from "@/components/RouteGuard";
import App from "@/App";

// RouteGuard의 onboarded prop은 로딩 상태(undefined)를 지원해야 한다(AC-4).
// 현재 타입은 boolean 전용일 수 있어(구현 전) any로 캐스팅해 런타임 동작만 검증한다.
const AnyRouteGuard = RouteGuard as unknown as React.ComponentType<{
  onboarded: boolean | undefined;
  children?: React.ReactNode;
}>;

const ALL_ROUTES = [
  "/",
  "/onboarding",
  "/add",
  "/expenses",
  "/report",
  "/benchmark",
  "/challenge",
  "/premium",
  "/settings",
] as const;

function seedOnboardedProfile() {
  seedLocalStorage({
    "spendlens.profile.v1": {
      ageBand: "25-30",
      incomeBand: "250-350",
      isPremium: false,
      premiumUntil: null,
      aiNoticeAcknowledged: false,
      onboarded: true,
    },
  });
}

describe("라우터 배선 + 온보딩 가드 무한 루프 차단 + 전역 Provider 완성", () => {
  it("AC-1[P0]: onboarded=false로 보호 경로(/report) 직접 진입 시 /onboarding으로 1회 리다이렉트되고 무한 루프 없이 렌더된다", () => {
    let renderResult: ReturnType<typeof render> | undefined;
    expect(() => {
      renderResult = render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/report"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/report",
              element: React.createElement(
                RouteGuard,
                { onboarded: false },
                React.createElement("div", null, "REPORT_PAGE"),
              ),
            }),
            React.createElement(Route, {
              path: "/onboarding",
              element: React.createElement("div", null, "ONBOARDING_PAGE"),
            }),
          ),
        ),
      );
    }).not.toThrow();

    expect(screen.getByText("ONBOARDING_PAGE")).toBeInTheDocument();
    expect(screen.queryByText("REPORT_PAGE")).not.toBeInTheDocument();
    void renderResult;
  });

  it("AC-1[P0]: onboarded=true 상태로 보호 경로(/report) 진입 시 리다이렉트 없이 페이지가 그대로 렌더된다", () => {
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/report"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: "/report",
            element: React.createElement(
              RouteGuard,
              { onboarded: true },
              React.createElement("div", null, "REPORT_PAGE"),
            ),
          }),
          React.createElement(Route, {
            path: "/onboarding",
            element: React.createElement("div", null, "ONBOARDING_PAGE"),
          }),
        ),
      ),
    );

    expect(screen.getByText("REPORT_PAGE")).toBeInTheDocument();
    expect(screen.queryByText("ONBOARDING_PAGE")).not.toBeInTheDocument();
  });

  it("AC-2[P0]: onboarded=false로 /onboarding 자체에 진입하면 가드가 자기 자신으로 재리다이렉트하지 않는다(무한 루프 없음)", () => {
    expect(() => {
      render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/onboarding"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/onboarding",
              element: React.createElement(
                RouteGuard,
                { onboarded: false },
                React.createElement("div", null, "ONBOARDING_PAGE"),
              ),
            }),
            React.createElement(Route, {
              path: "/",
              element: React.createElement("div", null, "HOME_PAGE"),
            }),
          ),
        ),
      );
    }).not.toThrow();

    expect(screen.getByText("ONBOARDING_PAGE")).toBeInTheDocument();
    expect(screen.queryByText("HOME_PAGE")).not.toBeInTheDocument();
  });

  it("AC-2: onboarded=true 상태로 /onboarding에 접근하면 /로 리다이렉트된다", () => {
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/onboarding"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: "/onboarding",
            element: React.createElement(
              RouteGuard,
              { onboarded: true },
              React.createElement("div", null, "ONBOARDING_PAGE"),
            ),
          }),
          React.createElement(Route, {
            path: "/",
            element: React.createElement("div", null, "HOME_PAGE"),
          }),
        ),
      ),
    );

    expect(screen.getByText("HOME_PAGE")).toBeInTheDocument();
    expect(screen.queryByText("ONBOARDING_PAGE")).not.toBeInTheDocument();
  });

  it("AC-4: store가 아직 로드되지 않은 초기 상태(onboarded=undefined)에서는 리다이렉트를 보류하고 크래시 없이 렌더된다", () => {
    expect(() => {
      render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/report"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/report",
              element: React.createElement(
                AnyRouteGuard,
                { onboarded: undefined },
                React.createElement("div", null, "REPORT_PAGE"),
              ),
            }),
            React.createElement(Route, {
              path: "/onboarding",
              element: React.createElement("div", null, "ONBOARDING_PAGE"),
            }),
          ),
        ),
      );
    }).not.toThrow();

    // 로딩 중에는 onboarded 여부를 아직 모르므로 섣부른 /onboarding 리다이렉트가 없어야 한다
    expect(screen.queryByText("ONBOARDING_PAGE")).not.toBeInTheDocument();
  });

  it("AC-3[P0]: App.tsx 최상위에 전역 store Provider(AppStoreProvider)가 배선되어 있다", () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf-8");
    expect(appSource).toMatch(/AppStoreProvider/);
    // Provider는 Routes 전체를 감싸는 최상위 래퍼여야 한다
    expect(appSource.indexOf("AppStoreProvider")).toBeLessThan(appSource.indexOf("<Routes"));
  });

  it("AC-3/AC-4[P0]: onboarded=true 상태로 9개 경로 어디에서 새로고침(직접 진입) 해도 App이 크래시 없이 렌더된다", () => {
    seedOnboardedProfile();

    for (const routePath of ALL_ROUTES) {
      const { unmount } = render(
        React.createElement(
          MemoryRouter,
          { initialEntries: [routePath] },
          React.createElement(App),
        ),
      );
      expect(document.body.textContent).not.toBe("");
      unmount();
    }

    expect(ALL_ROUTES.length).toBe(9);
  });

  it("AC-5: 알 수 없는 경로(*)는 크래시나 타임아웃 없이 홈으로 폴백 렌더된다", () => {
    seedOnboardedProfile();

    expect(() => {
      render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/does-not-exist"] },
          React.createElement(App),
        ),
      );
    }).not.toThrow();

    expect(document.body.textContent).not.toBe("");
  });
});
