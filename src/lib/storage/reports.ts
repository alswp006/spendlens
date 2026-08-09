import type { WeeklyReport } from "@/lib/types";
import { safeGetJSON, safeSetJSON, STORAGE_KEYS } from "./base";

const MAX_REPORTS = 24;

export function getReports(): WeeklyReport[] {
  return safeGetJSON<WeeklyReport[]>(STORAGE_KEYS.REPORTS, []);
}

export function saveReport(report: WeeklyReport): WeeklyReport[] {
  let next = [...getReports(), report];

  if (next.length > MAX_REPORTS) {
    next = next
      .sort((a, b) => a.weekStart - b.weekStart)
      .slice(next.length - MAX_REPORTS);
  }

  safeSetJSON(STORAGE_KEYS.REPORTS, next);
  return next;
}
