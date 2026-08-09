import { it, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { UserProfile } from "@/lib/types";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
mockTds(); mockAppsInToss(); mockTossRewardAd();
vi.mock("@/pages/Home", () => ({ default: () => React.createElement("div", { "data-testid": "page-home" }, "홈") }));
vi.mock("@/pages/Expenses", () => ({ default: () => React.createElement("div", { "data-testid": "page-expenses" }, "내역") }));
vi.mock("@/pages/Onboarding", () => ({ default: () => React.createElement("div", { "data-testid": "page-onboarding" }, "온보딩") }));
vi.mock("@/pages/Add", () => ({ default: () => React.createElement("div", null, "add") }));
vi.mock("@/pages/Report", () => ({ default: () => React.createElement("div", null, "report") }));
vi.mock("@/pages/Benchmark", () => ({ default: () => React.createElement("div", null, "b") }));
vi.mock("@/pages/Challenge", () => ({ default: () => React.createElement("div", null, "c") }));
vi.mock("@/pages/Premium", () => ({ default: () => React.createElement("div", null, "p") }));
vi.mock("@/pages/Settings", () => ({ default: () => React.createElement("div", null, "s") }));
const { default: App } = await import("@/App");
beforeEach(() => localStorage.clear());
it("repro", async () => {
  const p: UserProfile = { ageBand: "25-30", incomeBand: "250-350", isPremium: false, premiumUntil: null, aiNoticeAcknowledged: false, onboarded: true };
  localStorage.setItem("spendlens.profile.v1", JSON.stringify(p));
  const { useLocation } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  function Probe() { const l = (useLocation as any)(); console.log("PROBE_PATH:", l.pathname); return null; }
  render(React.createElement(MemoryRouter, { initialEntries: ["/"] }, React.createElement(App), React.createElement(Probe)));
  console.log("BEFORE_CLICK_BODY:", document.body.textContent);
  fireEvent.click(screen.getByRole("tab", { name: "내역" }));
  console.log("AFTER_CLICK_BODY:", document.body.textContent);
});
