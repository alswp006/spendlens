# Sprint Contract: 라우터 배선 + 온보딩 가드 + FloatingTabBar

## 만들 항목
- **src/App.tsx** — React Router 9개 경로(/, /onboarding, /add, /expenses, /report, /benchmark, /challenge, /premium, /settings), AppStateProvider 배선, FloatingTabBar 전역 배치
- **src/components/RouteGuard.tsx** — onboarded=false 검사 후 /onboarding으로 리다이렉트하는 가드 컴포넌트

## 사용할 타입
- `UserProfile` (onboarded: boolean) — import from @/lib/types
- 모든 페이지 컴포넌트는 RouteGuard로 감싼다 (/onboarding 제외)

## 검증 방법
- `pnpm typecheck` — 타입 에러 없음
- `pnpm build` — 빌드 성공
- 소유권: App.tsx는 이 패킷만 수정. main.tsx 건드리지 않음

## 절대 금지
- main.tsx 수정
- 라우터 외부 배선(Provider 이동 등)
- FloatingTabBar 활성탭 솔리드 파란 알약(틴트만)
