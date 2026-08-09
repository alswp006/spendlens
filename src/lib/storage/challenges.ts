import type { SavingChallenge } from "@/lib/types";
import { safeGetJSON, safeSetJSON, STORAGE_KEYS } from "./base";

const MAX_CHALLENGES = 12;

export function getChallenges(): SavingChallenge[] {
  return safeGetJSON<SavingChallenge[]>(STORAGE_KEYS.CHALLENGES, []);
}

export function saveChallenge(challenge: SavingChallenge): SavingChallenge[] {
  let next = [...getChallenges(), challenge];

  if (next.length > MAX_CHALLENGES) {
    next = next
      .sort((a, b) => a.monthStart - b.monthStart)
      .slice(next.length - MAX_CHALLENGES);
  }

  safeSetJSON(STORAGE_KEYS.CHALLENGES, next);
  return next;
}

export function updateChallenge(
  id: string,
  patch: Partial<SavingChallenge>
): SavingChallenge[] {
  const next = getChallenges().map((c) =>
    c.id === id ? { ...c, ...patch } : c
  );
  safeSetJSON(STORAGE_KEYS.CHALLENGES, next);
  return next;
}
