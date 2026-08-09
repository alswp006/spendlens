import { useState } from "react";
import { getProfile, patchProfile } from "@/lib/storage/profile";

export function useAiNotice() {
  const [show, setShow] = useState(() => !getProfile().aiNoticeAcknowledged);

  async function acknowledge() {
    patchProfile({ aiNoticeAcknowledged: true });
    setShow(false);
  }

  return { show, acknowledge };
}
