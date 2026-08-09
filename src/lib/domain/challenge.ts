import type { Category, Expense, SavingChallenge } from "@/lib/types";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface ChallengeProgress {
  percent: number;
  remaining: number;
}

export function computeProgress(challenge: SavingChallenge): ChallengeProgress {
  const percent =
    challenge.targetAmount === 0
      ? 0
      : Math.round((challenge.currentSpent / challenge.targetAmount) * 100);
  const remaining = Math.max(0, challenge.targetAmount - challenge.currentSpent);

  return { percent, remaining };
}

function getMonthEnd(monthStart: number): number {
  return monthStart + THIRTY_DAYS_MS;
}

export function recomputeChallenge(
  challenge: SavingChallenge,
  expenses: Expense[]
): SavingChallenge {
  if (challenge.status === "failed" || challenge.status === "completed") {
    return challenge;
  }

  const monthEnd = getMonthEnd(challenge.monthStart);

  const currentSpent = expenses
    .filter(
      (e) =>
        e.category === challenge.category &&
        e.timestamp >= challenge.monthStart &&
        e.timestamp < monthEnd
    )
    .reduce((sum, e) => sum + e.amount, 0);

  let status: SavingChallenge["status"] = challenge.status;
  if (currentSpent > challenge.targetAmount) {
    status = "failed";
  } else if (Date.now() >= monthEnd) {
    status = "completed";
  }

  return { ...challenge, currentSpent, status };
}

export function baselineAmount(
  expenses: Expense[],
  category: Category,
  now: number = Date.now()
): number {
  const thirtyDaysAgo = now - THIRTY_DAYS_MS;
  const categoryExpenses = expenses.filter(
    (e) =>
      e.category === category && e.timestamp >= thirtyDaysAgo && e.timestamp <= now
  );

  if (categoryExpenses.length === 0) return 0;

  const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
  return Math.round(total / categoryExpenses.length);
}
