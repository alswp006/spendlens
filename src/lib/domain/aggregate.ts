import type { Category, Expense } from "@/lib/types";

export interface CategoryAggregate {
  category: Category;
  amount: number;
  ratio: number;
}

export function aggregateByCategory(expenses: Expense[]): CategoryAggregate[] {
  const totals = new Map<Category, number>();
  for (const e of expenses) {
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return Array.from(totals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      ratio: total > 0 ? amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface Period {
  start: number;
  end: number;
}

export function getThisWeek(): Period {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday.getTime(), end: sunday.getTime() };
}

export function getLastWeek(): Period {
  const { start: thisWeekStart } = getThisWeek();
  const end = thisWeekStart - 1;
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);

  return { start: startDate.getTime(), end: endDate.getTime() };
}

export function getThisMonth(): Period {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start: start.getTime(), end: end.getTime() };
}

export function getLast30Days(): Period {
  const end = Date.now();
  const start = end - 30 * 24 * 60 * 60 * 1000;
  return { start, end };
}
