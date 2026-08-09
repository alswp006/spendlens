import { describe, it } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate as testUseNavigate, UNSAFE_NavigationContext } from "react-router-dom";
import { mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { FloatingTabBar } from "@/components/FloatingTabBar";

mockAppsInToss();

function LocProbe() {
  const loc = useLocation();
  return React.createElement("div", { "data-testid": "diag-loc" }, loc.pathname);
}

describe("zdiag4", () => {
  it("FloatingTabBar alone triggers navigate", () => {
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/"] },
        React.createElement(LocProbe),
        React.createElement(FloatingTabBar, {
          items: [
            { label: "홈", path: "/" },
            { label: "내역", path: "/expenses" },
          ],
        }),
      ),
    );
    console.log("DIAG before:", screen.getByTestId("diag-loc").textContent);
    fireEvent.click(screen.getByRole("tab", { name: "내역" }));
    console.log("DIAG after:", screen.getByTestId("diag-loc").textContent);
    console.log("DIAG ftb self loc attr:", screen.getByTestId("ftb-self-loc").getAttribute("data-loc"));
    console.log("DIAG NavCtx test===ftb:", UNSAFE_NavigationContext === (globalThis as any).__ftbNavCtx);
    console.log("DIAG useNavigate test===ftb:", testUseNavigate === (globalThis as any).__ftbUseNavigate);
  });
});
