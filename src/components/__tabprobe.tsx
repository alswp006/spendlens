import * as ProbeReact from "react";
import { useContext } from "react";
import { useNavigate, useLocation, UNSAFE_NavigationContext } from "react-router-dom";

export function TabProbe() {
  const navigate = useNavigate();
  const location = useLocation();
  const nav = useContext(UNSAFE_NavigationContext);
  (globalThis as any).__probeReact = ProbeReact;
  (globalThis as any).__probeNavCtx = UNSAFE_NavigationContext;
  (globalThis as any).__probeNavigator = nav.navigator;
  const active = location.pathname === "/report";
  return (
    <button role="tab" aria-label="probe-report" onClick={() => { if (active) return; navigate("/report"); }}>
      probe-report
    </button>
  );
}
