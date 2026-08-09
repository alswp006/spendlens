# Sprint Contract: 전역 FloatingTabBar 배치 + 활성 탭 틴트

## Deliverables
| File | Change |
|------|--------|
| `src/App.tsx` | Import FloatingTabBar, useLocation; wrap pages with top-level layout; show/hide based on pathname; pass activeTab prop |
| Layout | FloatingTabBar 배치: App.tsx 레이아웃 최상단 페이지 래퍼 → [홈, 내역, 리포트, 설정] 탭 |
| Active tab logic | useLocation().pathname로 활성 탭 계산: "/" → home, "/history" → history, "/report" → report, "/settings" → settings |
| Onboarding gate | `/onboarding` 경로에서만 탭바 숨김 (display:none or conditional render) |

## Types to Import
```typescript
// No shared types needed — FloatingTabBar는 UI 컴포넌트, activeTab prop만 전달
```

## Validation
1. `pnpm dev` → 홈/내역/리포트/설정 방문 시 해당 탭만 틴트(컬러 강조)
2. `/onboarding` 방문 → 탭바 없음
3. 탭 클릭 → pathname 변경 및 네비게이션 정상
4. `pnpm typecheck` — zero errors
5. `pnpm test` — 관련 tests pass (있으면)

## Forbidden
- NO modifications to `src/main.tsx`
- NO modifications to pages/ or other components
- NO TDS Tab 컴포넌트로 전역 네비 구현 (FloatingTabBar만 사용)
- NO Tailwind/CSS로 커스텀 탭바 구현
