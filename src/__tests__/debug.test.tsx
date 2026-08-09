import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { FloatingTabBar } from "@/components/FloatingTabBar";

vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
}));

function Probe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

describe("debug tabbar", () => {
  it("navigates on click", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Probe />
        <FloatingTabBar items={[{ label: "홈", path: "/" }, { label: "내역", path: "/expenses" }]} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "내역" }));
    console.log("LOC:", screen.getByTestId("loc").textContent);
    expect(screen.getByTestId("loc").textContent).toBe("/expenses");
  });
});
