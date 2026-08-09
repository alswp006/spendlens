import { it, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { FloatingTabBar } from "@/components/FloatingTabBar";
mockTds(); mockAppsInToss(); mockTossRewardAd();

function Probe() { const l = useLocation(); return React.createElement("div", { "data-testid": "path" }, l.pathname); }
function Btn() { const n = useNavigate(); return React.createElement("button", { onClick: () => n("/expenses"), "data-testid": "raw" }, "raw"); }

it("raw navigate works", () => {
  render(React.createElement(MemoryRouter, { initialEntries: ["/"] },
    React.createElement(Routes, null,
      React.createElement(Route, { path: "/", element: React.createElement("div", null, "home") }),
      React.createElement(Route, { path: "/expenses", element: React.createElement("div", null, "exp") }),
    ),
    React.createElement(Probe),
    React.createElement(Btn),
  ));
  fireEvent.click(screen.getByTestId("raw"));
  console.log("RAW_PATH:", screen.getByTestId("path").textContent);
});

it("FloatingTabBar navigate works", () => {
  render(React.createElement(MemoryRouter, { initialEntries: ["/"] },
    React.createElement(Probe),
    React.createElement(FloatingTabBar, { items: [{ label: "홈", path: "/" }, { label: "내역", path: "/expenses" }] }),
  ));
  fireEvent.click(screen.getByRole("tab", { name: "내역" }));
  console.log("FTB_PATH:", screen.getByTestId("path").textContent);
});
