import { it } from "vitest";
import { UNSAFE_NavigationContext } from "react-router-dom";
import { srcNavCtx } from "@/components/__whichctx";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
mockTds(); mockAppsInToss(); mockTossRewardAd();

it("same nav context object?", () => {
  console.log("SAME_NAV_CTX:", UNSAFE_NavigationContext === srcNavCtx);
});
