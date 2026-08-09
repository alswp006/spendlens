import React, { createContext, useContext, useEffect, useState } from "react";
import type { Expense, UserProfile } from "@/lib/types";
import { getProfile, patchProfile } from "@/lib/storage/profile";
import { getExpenses } from "@/lib/storage/expenses";

export interface AppStoreState {
  profile: UserProfile;
  expenses: Expense[];
  isLoading: boolean;
}

export const AppStoreContext = createContext<AppStoreState | null>(null);

export function AppStoreProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [state, setState] = useState<AppStoreState>(() => ({
    profile: getProfile(),
    expenses: getExpenses(),
    isLoading: true,
  }));

  useEffect(() => {
    let profile = getProfile();
    if (profile.premiumUntil !== null && profile.premiumUntil < Date.now()) {
      profile = patchProfile({ isPremium: false });
    }
    setState({ profile, expenses: getExpenses(), isLoading: false });
  }, []);

  return (
    <AppStoreContext.Provider value={state}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStoreState {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error("useAppStore: AppStoreProvider 내부에서만 사용할 수 있습니다");
  }
  return ctx;
}
