import type { Category, Expense } from "@/lib/types";
import { safeGetJSON, safeSetJSON, STORAGE_KEYS } from "./base";

const MAX_EXPENSES = 2000;

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getExpenses(): Expense[] {
  return safeGetJSON<Expense[]>(STORAGE_KEYS.EXPENSES, []);
}

export type AddExpenseInput = {
  amount: number;
  category: Category;
  merchant: string;
  memo: string;
  timestamp: number;
  source: "sms" | "manual";
};

export function addExpense(input: AddExpenseInput): Expense {
  const expense: Expense = {
    ...input,
    id: generateId(),
    createdAt: Date.now(),
  };

  let next = [...getExpenses(), expense];
  if (next.length > MAX_EXPENSES) {
    next = next
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(next.length - MAX_EXPENSES);
  }

  safeSetJSON(STORAGE_KEYS.EXPENSES, next);
  return expense;
}

export function deleteExpense(id: string): void {
  const next = getExpenses().filter((e) => e.id !== id);
  safeSetJSON(STORAGE_KEYS.EXPENSES, next);
}
