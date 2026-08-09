# Sprint Contract — AI Notice Gate + Global Compliance Sweep

## Deliverables
| File | Change |
|------|--------|
| `src/components/AINoticeGate.tsx` | AlertDialog wrapper: accept → patchProfile(aiNoticeAcknowledged:true), dismiss/back → no-op |
| `src/hooks/useAiNotice.ts` | `useAiNotice()` hook: returns `{ show: boolean, acknowledge: () => Promise<void> }` |
| `src/pages/report.tsx`, `src/pages/benchmark.tsx` | Wrap AI result render with `<AINoticeGate onAcknowledge={...}>` |
| Codebase audit | Remove all `#[0-9a-fA-F]{6}` HEX literals, external URLs, "설치" prompts, external logging (GA/Amplitude) |
| Verify build | `vite build` → zero `console.error`, zero CORS errors in dist/ |

## Types to Import
```typescript
import type { UserProfile } from "@/lib/types"; // aiNoticeAcknowledged: boolean
```

## Validation
1. `pnpm typecheck` — zero errors
2. `pnpm test` — tests pass
3. `vite build` && `npm run preview` — NO console.error, NO external domains
4. `rg "#[0-9a-f]{6}|http:|https:|GA_ID|amplitude|설치" src/` — 0 results

## Forbidden
- NO modifications to `main.tsx` or `App.tsx`
- NO custom CSS margins/padding on TDS components
- NO mock UI when SDK unavailable (guard + graceful degrade only)
