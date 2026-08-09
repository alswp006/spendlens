import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { seedLocalStorage } from "@/__tests__/__helpers__/test-utils";

// TDS + SDK + TossRewardAd + react-router-dom(useNavigate만 목, useLocation/Navigate는 실제) 목
mockAll();

import App from "@/App";

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

describe("전역 FloatingTabBar 배치 + 활성 탭 틴트", () => {
  it("AC-1[P0]: 온보딩 완료 후 홈(/)에서 탭바가 노출되고 4개 탭(홈/내역/리포트/설정)이 렌더된다", () => {
    seedOnboardedProfile();

    render(
      React.createElement(MemoryRouter, { initialEntries: ["/"] }, React.createElement(App)),
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(["홈", "내역", "리포트", "설정"]);
  });

  it("AC-1[P0]: '내역' 탭 클릭 시 /expenses 경로로 navigate가 호출된다", () => {
    seedOnboardedProfile();

    render(
      React.createElement(MemoryRouter, { initialEntries: ["/"] }, React.createElement(App)),
    );

    fireEvent.click(screen.getByRole("tab", { name: "내역" }));

    expect(mockNavigate).toHaveBeenCalledWith("/expenses");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("AC-2[P0]: 현재 경로(/report)에 해당하는 탭에만 aria-selected=true 활성 틴트가 적용된다", () => {
    seedOnboardedProfile();

    render(
      React.createElement(MemoryRouter, { initialEntries: ["/report"] }, React.createElement(App)),
    );

    const home = screen.getByRole("tab", { name: "홈" });
    const expenses = screen.getByRole("tab", { name: "내역" });
    const report = screen.getByRole("tab", { name: "리포트" });
    const settings = screen.getByRole("tab", { name: "설정" });

    expect(report.getAttribute("aria-selected")).toBe("true");
    expect(home.getAttribute("aria-selected")).toBe("false");
    expect(expenses.getAttribute("aria-selected")).toBe("false");
    expect(settings.getAttribute("aria-selected")).toBe("false");
  });

  it("AC-2: 현재 경로(/settings)에서는 '설정' 탭만 활성 틴트가 적용된다", () => {
    seedOnboardedProfile();

    render(
      React.createElement(MemoryRouter, { initialEntries: ["/settings"] }, React.createElement(App)),
    );

    expect(screen.getByRole("tab", { name: "설정" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "홈" }).getAttribute("aria-selected")).toBe("false");
  });

  it("AC-3[P0]: /onboarding 경로에서는 탭바(role=tablist)가 렌더되지 않는다", () => {
    // onboarded=false 상태(프로필 미저장) — RouteGuard가 /onboarding에 머무른다
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/onboarding"] },
        React.createElement(App),
      ),
    );

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("AC-3: 온보딩 완료 상태(onboarded=true)로 /onboarding에 직접 진입해도 홈으로 리다이렉트되며 탭바는 노출된다", () => {
    seedOnboardedProfile();

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/onboarding"] },
        React.createElement(App),
      ),
    );

    // RouteGuard가 onboarded=true + /onboarding 재진입을 /로 리다이렉트하므로 탭바가 보여야 한다
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("AC-1: 탭바는 CP-5에 따라 자작 nav가 아닌 role=tablist인 단일 nav 요소로 렌더된다(TDS Tab 전역 네비 오용 금지)", () => {
    seedOnboardedProfile();

    render(
      React.createElement(MemoryRouter, { initialEntries: ["/"] }, React.createElement(App)),
    );

    const tablists = screen.getAllByRole("tablist");
    expect(tablists).toHaveLength(1);
    expect(tablists[0].tagName).toBe("NAV");
  });
});
