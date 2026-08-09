import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();
mockTossRewardAd();

vi.mock("@/pages/Home", () => ({ default: () => React.createElement("div", { "data-testid": "page-home" }, "홈") }));
vi.mock("@/pages/Onboarding", () => ({ default: () => React.createElement("div", { "data-testid": "page-onboarding" }, "온보딩") }));
vi.mock("@/pages/Add", () => ({ default: () => React.createElement("div", { "data-testid": "page-add" }, "추가") }));
vi.mock("@/pages/Expenses", () => ({ default: () => React.createElement("div", { "data-testid": "page-expenses" }, "내역") }));
vi.mock("@/pages/Report", () => ({ default: () => React.createElement("div", { "data-testid": "page-report" }, "리포트") }));
vi.mock("@/pages/Benchmark", () => ({ default: () => React.createElement("div", { "data-testid": "page-benchmark" }, "벤치마크") }));
vi.mock("@/pages/Challenge", () => ({ default: () => React.createElement("div", { "data-testid": "page-challenge" }, "챌린지") }));
vi.mock("@/pages/Premium", () => ({ default: () => React.createElement("div", { "data-testid": "page-premium" }, "프리미엄") }));
vi.mock("@/pages/Settings", () => ({ default: () => React.createElement("div", { "data-testid": "page-settings" }, "설정") }));

const { default: App } = await import("@/App");

it("debug nav", async () => {
  localStorage.setItem("spendlens.profile.v1", JSON.stringify({ onboarded: true }));
  render(React.createElement(MemoryRouter, { initialEntries: ["/"] }, React.createElement(App)));
  screen.getByTestId("page-home");
  fireEvent.click(screen.getByRole("tab", { name: "내역" }));
  console.log("HTML:", document.body.innerHTML);
  expect(true).toBe(true);
});
