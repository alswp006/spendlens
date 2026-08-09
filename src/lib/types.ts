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
  "/expenses": { added?: boolean } | undefined;
  "/report": undefined;
  "/benchmark": undefined;
  "/challenge": undefined;
  "/premium": { from?: string } | undefined;
  "/settings": undefined;
}
