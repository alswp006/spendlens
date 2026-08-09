import { it, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useNavigate, useLocation } from "react-router-dom";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
mockTds(); mockAppsInToss(); mockTossRewardAd();

function Probe() { const l = useLocation(); return React.createElement("div", { "data-testid": "path" }, l.pathname); }

// Inline copy of FloatingTabBar onClick logic
function InlineTabBar({ items }: { items: { label: string; path: string }[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  return React.createElement("nav", { role: "tablist" }, items.map((item) => {
    const active = location.pathname === item.path;
    return React.createElement("button", {
      key: item.path, role: "tab", "aria-label": item.label,
      onClick: () => {
        if (active) return;
        try { Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {}); } catch {}
        navigate(item.path);
      },
    }, item.label);
  }));
}

it("inline copy navigate works", () => {
  render(React.createElement(MemoryRouter, { initialEntries: ["/"] },
    React.createElement(Probe),
    React.createElement(InlineTabBar, { items: [{ label: "홈", path: "/" }, { label: "내역", path: "/expenses" }] }),
  ));
  fireEvent.click(screen.getByRole("tab", { name: "내역" }));
  console.log("INLINE_PATH:", screen.getByTestId("path").textContent);
});
