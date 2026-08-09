import { it } from "vitest";
import * as TestReact from "react";
import { useContext } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation, UNSAFE_NavigationContext } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { TabProbe } from "@/components/__tabprobe";
mockTds(); mockAppsInToss(); mockTossRewardAd();

function Probe() {
  const l = useLocation();
  const nav = useContext(UNSAFE_NavigationContext);
  (globalThis as any).__testReact = TestReact;
  (globalThis as any).__testNavCtx = UNSAFE_NavigationContext;
  (globalThis as any).__testNavigator = nav.navigator;
  return <div data-testid="path">{l.pathname}</div>;
}

it("clean compare", () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Probe />
      <TabProbe />
    </MemoryRouter>,
  );
  const g = globalThis as any;
  console.log("RESULT",
    "React=", g.__testReact === g.__probeReact,
    "NavCtx=", g.__testNavCtx === g.__probeNavCtx,
    "Navigator=", g.__testNavigator === g.__probeNavigator);
  fireEvent.click(screen.getByRole("tab", { name: "probe-report" }));
  console.log("PATH:", screen.getByTestId("path").textContent);
});
