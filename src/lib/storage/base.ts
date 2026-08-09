export const STORAGE_KEYS = {
  PROFILE: "spendlens.profile.v1",
  EXPENSES: "spendlens.expenses.v1",
  REPORTS: "spendlens.reports.v1",
  CHALLENGES: "spendlens.challenges.v1",
} as const;

export function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeSetJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
