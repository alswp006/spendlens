import React, { createContext, useContext } from "react";
import type { Expense, UserProfile } from "@/lib/types";

export interface AppStoreState {
  profile: UserProfile;
  expenses: Expense[];
  isLoading: boolean;
}

export const AppStoreContext = createContext<AppStoreState | null>(null);

// TDD red phase stub — implemented by the Coder against src/__tests__/packet-0004.test.ts
export function AppStoreProvider({
  children: _children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  throw new Error("AppStoreProvider: not implemented");
}

export function useAppStore(): AppStoreState {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore: not implemented");
  return ctx;
}
