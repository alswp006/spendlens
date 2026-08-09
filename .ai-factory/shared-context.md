# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

export type Profile = { id: string; name: string; currency: string; monthlyBudget: number };

export type Expense = { id: string; date: string; category: string; amountKrw: number; description: string };

export type Report = { id: string; period: string; totalExpense: number; byCategory: Record<string, number> };

export type Benchmark = { id: string; date: string; score: number; metadata: Record<string, any> };

export type Challenge = { id: string; name: string; status: 'active' | 'completed' | 'failed'; target: number; progress: number };

export type RouteState = { current: string; previous?: string };

export type loadProfileFn = () => Promise<Profile | null>;

export type saveProfileFn = (profile: Profile) => Promise<void>;

export type loadExpensesFn = (startDate?: string, endDate?: string) => Promise<Expense[]>;

export type addExpenseFn = (expense: Omit<Expense, 'id'>) => Promise<Expense>;

export type removeExpenseFn = (id: string) => Promise<void>;

export type updateExpenseFn = (id: string, changes: Partial<Expense>) => Promise<Expense>;

export type loadChallengesFn = () => Promise<Challenge[]>;

export type updateChallengeFn = (id: string, progress: number) => Promise<Challenge>;

export type useProfileFn = () => { data: Profile | null; loading: boolean; error?: Error };

export type useExpensesFn = () => { data: Expense[]; loading: boolean; error?: Error };

export type useReportsFn = () => { data: Report[]; loading: boolean; error?: Error };

export type useChallengesFn = () => { data: Challenge[]; loading: boolean; error?: Error };

export type formatCurrencyFn = (amount: number, currency?: string) => string;

export type formatDateFn = (date: string | Date) => string;

```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
// Domain types — SpendLens

// ============================================================================
// 공유 밴드 alias (단일 출처) — UserProfile/BenchmarkResult/API 타입이 모두 참조
// ============================================================================
export type AgeBand = "25-30" | "31-34" | "35-38";
export type IncomeBand = "250-350" | "350-450";

export type Category =
  | "식비"
  | "카페/간식"
  | "배달"
  | "교통"
  | "쇼핑"
  | "구독"
  | "문화/여가"
  | "기타";

export interface UserProfile {
  ageBand: AgeBand;
  incomeBand: IncomeBand;
  isPremium: boolean;
  premiumUntil: number | null;
  aiNoticeAcknowledged: boolean;
  onboarded: boolean;
}

export interface Expense {
  id: string;
  amount: number;
  category: Category;
  merchant: string;
  memo: string;
  timestamp: number;
  source: "sms" | "manual";
  createdAt: number;
}

export interface WasteInsight {
  type: "subscription_dup" | "delivery_overspend" | "impulse_time";
  title: string;
  description: string;
  savingPotential: number;
}

export interface WeeklyReport {
  id: string;
  weekStart: number;
  weekEnd: number;
  totalSpent: number;
  categoryBreakdown: { category: Category; amount: number; ratio: number }[];
  insights: WasteInsight[];
  isAi: true;
  generatedAt: number;
}

export interface BenchmarkResult {
  ageBand: AgeBand;
  incomeBand: IncomeBand;
  categories: {
    category: Category;
    myAmount: number;
    peerAvg: number;
    diffRatio: number;
  }[];
  generatedAt: number;
}

export interface SavingChallenge {
  id: string;
  category: Category;
  baselineAmount: number;
  targetAmount: number;
  monthStart: number;
  currentSpent: number;
  status: "active" | "completed" | "failed";
}

// ============================================================================
// API request/response types
// ============================================================================

export interface AnalyzeWeekRequest {
  expenses: {
    amount: number;
    category: Category;
    merchant: string;
    timestamp: number;
  }[];
  profile: { ageBand: AgeBand; incomeBand: IncomeBand };
}

export interface AnalyzeWeekResponse {
  insights: {
    type: "subscription_dup" | "delivery_overspend" | "impulse_time";
    title: string;
    description: string;
    savingPotential: number;
  }[];
  summary: string;
}

export interface BenchmarkRequest {
  ageBand: AgeBand;
  incomeBand: IncomeBand;
  categories: { category: Category; amount: number }[];
}

export interface BenchmarkResponse {
  categories: {
    category: Category;
    peerAvg: number;
    diffRatio: number;
  }[];
}

export interface ErrorResponse {
  error: string;
}

// ============================================================================
// RouteState — location.state 타입 맵 (9개 경로)
// ============================================================================

export interface RouteState {
  "/onboarding": undefined;
  "/": undefined;
  "/add": { prefillText?: string } | undefined;
  "/expenses": { added?: b
// ...truncated
```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    RouteGuard.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    __rrid.ts
    contract.ts
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Add.tsx
    Benchmark.tsx
    Challenge.tsx
    Expenses.tsx
    Home.tsx
    Onboarding.tsx
    Premium.tsx
    Report.tsx
    Settings.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
    jest-dom.d.ts
  vite-env.d.ts

### Exports (src/lib/)
- __rrid.ts: export const rrMarker = RR
- contract.ts: export type Profile =; export type Expense =; export type Report =; export type Benchmark =; export type Challenge =; export type RouteState =; export type loadProfileFn = () => Promise<Profile | null>; export type saveProfileFn = (profile: Profile) => Promise<void>
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type AgeBand = "25-30" | "31-34" | "35-38"; export type IncomeBand = "250-350" | "350-450"; export type Category = | "식비" | "카페/간식" | "배달" | "교통" | "쇼핑" | "구독" | "문화/여가" | "기타"; export interface UserProfile; export interface Expense; export interface WasteInsight; export interface WeeklyReport; export interface BenchmarkResult
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- RouteGuard.tsx: RouteGuard
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 도메인 타입 + 공유 밴드 alias + RouteState + API 타입 (files: src/lib/types.ts)