import { useNavigate, useLocation, UNSAFE_NavigationContext } from "react-router-dom";
import { useContext } from "react";

export function ZProbe() {
  const navigate = useNavigate();
  const location = useLocation();
  const navCtxVal = useContext(UNSAFE_NavigationContext);
  (globalThis as any).__zprobeNavCtx = UNSAFE_NavigationContext;
  (globalThis as any).__zprobeNavigator = navCtxVal.navigator;
  return (
    <button
      role="tab"
      aria-label="zprobe"
      onClick={() => {
        console.log("DIAG zprobe onClick, current path:", location.pathname);
        navigate("/expenses");
        console.log("DIAG zprobe navigate() called");
      }}
    >
      zprobe
    </button>
  );
}
