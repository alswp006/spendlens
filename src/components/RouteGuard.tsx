import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';

export function RouteGuard({ onboarded, children }: PropsWithChildren<{ onboarded: boolean }>) {
  if (!onboarded) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
