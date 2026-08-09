import { describe, it, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();
mockTossRewardAd();

vi.mock("@/pages/Home", () => ({ default: () => <div data-testid="page-home">home</div> }));
vi.mock("@/pages/Expenses", () => ({ default: () => <div data-testid="page-expenses">expenses</div> }));

const { default: App } = await import("@/App");

describe("failing scenario", () => {
  it("App tab click navigates", () => {
    localStorage.setItem(
      "spendlens.profile.v1",
      JSON.stringify({ ageBand: "25-30", incomeBand: "250-350", isPremium: false, premiumUntil: null, aiNoticeAcknowledged: false, onboarded: true }),
    );
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "내역" }));
    console.log("APP has expenses:", !!screen.queryByTestId("page-expenses"));
  });
});
