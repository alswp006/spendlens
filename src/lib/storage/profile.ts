import type { UserProfile } from "@/lib/types";
import { safeGetJSON, safeSetJSON, STORAGE_KEYS } from "./base";

const DEFAULT_PROFILE: UserProfile = {
  ageBand: "25-30",
  incomeBand: "250-350",
  isPremium: false,
  premiumUntil: null,
  aiNoticeAcknowledged: false,
  onboarded: false,
};

export function getProfile(): UserProfile {
  return safeGetJSON<UserProfile>(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
}

export function saveProfile(profile: UserProfile): boolean {
  return safeSetJSON(STORAGE_KEYS.PROFILE, profile);
}

export function patchProfile(patch: Partial<UserProfile>): UserProfile {
  const next = { ...getProfile(), ...patch };
  saveProfile(next);
  return next;
}
