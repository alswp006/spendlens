import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();
mockTossRewardAd();

const { default: App } = await import("@/App");

describe("debug", () => {
  it("click nav", () => {
    localStorage.setItem("spendlens.profile.v1", JSON.stringify({ onboarded: true }));
    render(React.createElement(MemoryRouter, { initialEntries: ["/"] }, React.createElement(App)));
    const btn = screen.getByRole("tab", { name: "내역" });
    console.log("before click, location:", window.location.href);
    fireEvent.click(btn);
    console.log("after click");
  });
});
