import { it, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useNavigate, useLocation } from "react-router-dom";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { FloatingTabBar } from "@/components/FloatingTabBar";
mockTds(); mockAppsInToss(); mockTossRewardAd();

function Probe() { const l = useLocation(); return React.createElement("div", { "data-testid": "path" }, l.pathname); }

function InlineTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === "/report";
  return React.createElement("button", {
    role: "tab", "aria-label": "inline-report",
    onClick: () => { if (active) return; try { Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {}); } catch {} navigate("/report"); },
  }, "inline-report");
}

it("both under same router", () => {
  render(React.createElement(MemoryRouter, { initialEntries: ["/"] },
    React.createElement(Probe),
    React.createElement(InlineTabBar),
    React.createElement(FloatingTabBar, { items: [{ label: "홈", path: "/" }, { label: "내역", path: "/expenses" }] }),
  ));
  fireEvent.click(screen.getByRole("tab", { name: "inline-report" }));
  console.log("AFTER_INLINE:", screen.getByTestId("path").textContent);
  fireEvent.click(screen.getByRole("tab", { name: "내역" }));
  console.log("AFTER_FTB:", screen.getByTestId("path").textContent);
});
