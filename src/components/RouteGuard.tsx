import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from './StateView';

const ONBOARDING_PATH = '/onboarding';

/**
 * 온보딩 가드.
 * - onboarded === undefined: store 로드 전 — 리다이렉트 보류(Skeleton 표시). 새로고침 시 섣부른 리다이렉트/크래시 방지.
 * - onboarded === false: 보호 경로면 /onboarding으로. 이미 /onboarding이면 그대로 렌더(자기 자신 재리다이렉트 = 무한 루프 방지).
 * - onboarded === true: /onboarding 재진입은 /로. 그 외 경로는 그대로 렌더.
 */
export function RouteGuard({
  onboarded,
  children,
}: PropsWithChildren<{ onboarded: boolean | undefined }>) {
  const { pathname } = useLocation();
  const isOnboardingRoute = pathname === ONBOARDING_PATH;

  if (onboarded === undefined) {
    return <LoadingState rows={4} />;
  }

  if (!onboarded && !isOnboardingRoute) {
    return <Navigate to={ONBOARDING_PATH} replace />;
  }

  if (onboarded && isOnboardingRoute) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
