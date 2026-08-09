import { describe, it, expect } from "vitest";
import type {
  AgeBand,
  IncomeBand,
  Category,
  UserProfile,
  Expense,
  WasteInsight,
  WeeklyReport,
  SavingChallenge,
  BenchmarkResult,
  AnalyzeWeekRequest,
  AnalyzeWeekResponse,
  BenchmarkRequest,
  BenchmarkResponse,
  ErrorResponse,
  RouteState,
} from "@/lib/types";

/**
 * Packet 0001: 도메인 타입 + 공유 밴드 alias + RouteState + API 타입
 *
 * AC-1: AgeBand/IncomeBand literal unions 정의 — 타입 안전성
 * AC-2: 공유 alias를 UserProfile, BenchmarkResult, API 타입이 참조
 * AC-3: RouteState 맵 export (9개 경로)
 * AC-4: tsc --noEmit 통과
 *
 * Tests verify:
 * - Type contracts (compile-time assertions via expect)
 * - All entity types and aliases exist and match spec
 * - RouteState has proper keys for all routes
 */

describe("Packet 0001: Domain Types + Shared Band Alias + RouteState + API Types", () => {
  // ============================================================================
  // AC-1: AgeBand/IncomeBand literal unions — prevent string widening
  // ============================================================================

  it("AC-1a: AgeBand is defined as literal union ('25-30' | '31-34' | '35-38')", () => {
    // @ts-expect-error — string literal check: wider type should error
    const invalid: AgeBand = "invalid-band";
    expect(invalid).toBeDefined(); // This line never runs; test is compile-time only
  });

  it("AC-1b: AgeBand accepts valid literal values", () => {
    // These should compile without error
    const bands: Array<AgeBand> = ["25-30", "31-34", "35-38"];
    expect(bands).toHaveLength(3);
  });

  it("AC-1c: IncomeBand is defined as literal union ('250-350' | '350-450')", () => {
    // @ts-expect-error — string literal check: wider type should error
    const invalid: IncomeBand = "invalid-income";
    expect(invalid).toBeDefined(); // Compile-time only
  });

  it("AC-1d: IncomeBand accepts valid literal values", () => {
    const bands: Array<IncomeBand> = ["250-350", "350-450"];
    expect(bands).toHaveLength(2);
  });

  // ============================================================================
  // AC-2: UserProfile uses AgeBand/IncomeBand — type narrowing
  // ============================================================================

  it("AC-2a: UserProfile.ageBand is typed as AgeBand (not string)", () => {
    // Type check: UserProfile.ageBand should be AgeBand, not string
    const profile: UserProfile = {
      ageBand: "25-30" as const,
      incomeBand: "250-350" as const,
      isPremium: false,
      premiumUntil: null,
      aiNoticeAcknowledged: false,
      onboarded: false,
    };

    expect(profile.ageBand).toBe("25-30");
    // @ts-expect-error — string assignment should error
    profile.ageBand = "invalid";
  });

  it("AC-2b: UserProfile.incomeBand is typed as IncomeBand (not string)", () => {
    const profile: UserProfile = {
      ageBand: "31-34" as const,
      incomeBand: "350-450" as const,
      isPremium: false,
      premiumUntil: null,
      aiNoticeAcknowledged: false,
      onboarded: false,
    };

    expect(profile.incomeBand).toBe("350-450");
    // @ts-expect-error
    profile.incomeBand = "invalid";
  });

  it("AC-2c: BenchmarkResult.ageBand uses AgeBand alias (matches UserProfile)", () => {
    const result: BenchmarkResult = {
      ageBand: "25-30" as const, // Must be AgeBand, not string
      incomeBand: "250-350" as const,
      categories: [],
      generatedAt: Date.now(),
    };

    expect(result.ageBand).toBe("25-30");
    const invalid: BenchmarkResult = {
      // @ts-expect-error — string widening should error
      ageBand: "invalid",
      incomeBand: "250-350",
      categories: [],
      generatedAt: Date.now(),
    };
    expect(invalid).toBeDefined();
  });

  it("AC-2d: BenchmarkResult.incomeBand uses IncomeBand alias (matches UserProfile)", () => {
    const result: BenchmarkResult = {
      ageBand: "31-34" as const,
      incomeBand: "350-450" as const,
      categories: [],
      generatedAt: Date.now(),
    };

    expect(result.incomeBand).toBe("350-450");
  });

  // ============================================================================
  // AC-2 (continued): API request/response types use same aliases
  // ============================================================================

  it("AC-2e: AnalyzeWeekRequest.profile uses AgeBand/IncomeBand", () => {
    const req: AnalyzeWeekRequest = {
      expenses: [],
      profile: {
        ageBand: "25-30" as const,
        incomeBand: "250-350" as const,
      },
    };

    expect(req.profile.ageBand).toBe("25-30");
    expect(req.profile.incomeBand).toBe("250-350");

    const invalid: AnalyzeWeekRequest = {
      expenses: [],
      // @ts-expect-error — wider string type should error
      profile: { ageBand: "invalid", incomeBand: "invalid" },
    };
    expect(invalid).toBeDefined();
  });

  it("AC-2f: BenchmarkRequest uses AgeBand/IncomeBand", () => {
    const req: BenchmarkRequest = {
      ageBand: "31-34" as const,
      incomeBand: "350-450" as const,
      categories: [],
    };

    expect(req.ageBand).toBe("31-34");
    expect(req.incomeBand).toBe("350-450");

    const invalid: BenchmarkRequest = {
      // @ts-expect-error
      ageBand: "invalid",
      // @ts-expect-error
      incomeBand: "invalid",
      categories: [],
    };
    expect(invalid).toBeDefined();
  });

  // ============================================================================
  // Category, Expense, WasteInsight, WeeklyReport, SavingChallenge
  // ============================================================================

  it("AC-1e: Category literal union defined (8 categories per spec)", () => {
    const categories: Array<Category> = [
      "식비",
      "카페/간식",
      "배달",
      "교통",
      "쇼핑",
      "구독",
      "문화/여가",
      "기타",
    ];
    expect(categories).toHaveLength(8);
  });

  it("AC-1f: Expense entity has all required fields", () => {
    const expense: Expense = {
      id: "uuid-123",
      amount: 12000,
      category: "식비",
      merchant: "김밥천국",
      memo: "점심",
      timestamp: 1754784000000,
      source: "manual",
      createdAt: 1754784000000,
    };

    expect(expense).toHaveProperty("id");
    expect(expense).toHaveProperty("amount");
    expect(expense).toHaveProperty("category");
    expect(expense).toHaveProperty("merchant");
    expect(expense).toHaveProperty("memo");
    expect(expense).toHaveProperty("timestamp");
    expect(expense).toHaveProperty("source");
    expect(expense).toHaveProperty("createdAt");
    expect(expense.amount).toBeGreaterThan(0);
  });

  it("AC-1g: WasteInsight has all required fields", () => {
    const insight: WasteInsight = {
      type: "subscription_dup",
      title: "구독료 중복",
      description: "스트리밍 구독이 2개 이상 활성됨",
      savingPotential: 15000,
    };

    expect(insight).toHaveProperty("type");
    expect(insight).toHaveProperty("title");
    expect(insight).toHaveProperty("description");
    expect(insight).toHaveProperty("savingPotential");
    expect(insight.savingPotential).toBeGreaterThanOrEqual(0);
  });

  it("AC-1h: WeeklyReport has all required fields", () => {
    const report: WeeklyReport = {
      id: "report-uuid",
      weekStart: 1754784000000,
      weekEnd: 1755388800000,
      totalSpent: 150000,
      categoryBreakdown: [
        { category: "식비", amount: 50000, ratio: 0.333 },
      ],
      insights: [],
      isAi: true,
      generatedAt: 1754784000000,
    };

    expect(report).toHaveProperty("id");
    expect(report).toHaveProperty("weekStart");
    expect(report).toHaveProperty("weekEnd");
    expect(report).toHaveProperty("totalSpent");
    expect(report).toHaveProperty("categoryBreakdown");
    expect(report).toHaveProperty("insights");
    expect(report).toHaveProperty("isAi");
    expect(report).toHaveProperty("generatedAt");
  });

  it("AC-1i: SavingChallenge has all required fields", () => {
    const challenge: SavingChallenge = {
      id: "challenge-uuid",
      category: "배달",
      baselineAmount: 200000,
      targetAmount: 120000,
      monthStart: 1754784000000,
      currentSpent: 0,
      status: "active",
    };

    expect(challenge).toHaveProperty("id");
    expect(challenge).toHaveProperty("category");
    expect(challenge).toHaveProperty("baselineAmount");
    expect(challenge).toHaveProperty("targetAmount");
    expect(challenge).toHaveProperty("monthStart");
    expect(challenge).toHaveProperty("currentSpent");
    expect(challenge).toHaveProperty("status");
    expect(["active", "completed", "failed"]).toContain(challenge.status);
  });

  // ============================================================================
  // AC-3: RouteState type mapping for all 9 routes
  // ============================================================================

  it("AC-3a: RouteState export exists with /onboarding path", () => {
    // Type check: onboarding has no state
    const onboardingState: RouteState["/onboarding"] = undefined;
    expect(onboardingState).toBeUndefined();
  });

  it("AC-3b: RouteState has / (home) path with undefined state", () => {
    const homeState: RouteState["/"] = undefined;
    expect(homeState).toBeUndefined();
  });

  it("AC-3c: RouteState has /add path with optional prefillText", () => {
    // Valid: with prefillText
    const addWithPrefill: RouteState["/add"] = {
      prefillText: "[Web발신] 신한카드...",
    };
    expect(addWithPrefill).toHaveProperty("prefillText");

    // Valid: undefined
    const addUndefined: RouteState["/add"] = undefined;
    expect(addUndefined).toBeUndefined();
  });

  it("AC-3d: RouteState has /expenses path with optional added boolean", () => {
    // Valid: with added flag
    const expensesWithAdded: RouteState["/expenses"] = { added: true };
    expect(expensesWithAdded).toHaveProperty("added");
    expect(expensesWithAdded.added).toBe(true);

    // Valid: undefined
    const expensesUndefined: RouteState["/expenses"] = undefined;
    expect(expensesUndefined).toBeUndefined();
  });

  it("AC-3e: RouteState has /report path with undefined state", () => {
    const reportState: RouteState["/report"] = undefined;
    expect(reportState).toBeUndefined();
  });

  it("AC-3f: RouteState has /benchmark path with undefined state", () => {
    const benchmarkState: RouteState["/benchmark"] = undefined;
    expect(benchmarkState).toBeUndefined();
  });

  it("AC-3g: RouteState has /challenge path with undefined state", () => {
    const challengeState: RouteState["/challenge"] = undefined;
    expect(challengeState).toBeUndefined();
  });

  it("AC-3h: RouteState has /premium path with optional from string", () => {
    // Valid: with from
    const premiumWithFrom: RouteState["/premium"] = { from: "/report" };
    expect(premiumWithFrom).toHaveProperty("from");
    expect(premiumWithFrom.from).toBe("/report");

    // Valid: undefined
    const premiumUndefined: RouteState["/premium"] = undefined;
    expect(premiumUndefined).toBeUndefined();
  });

  it("AC-3i: RouteState has /settings path with undefined state", () => {
    const settingsState: RouteState["/settings"] = undefined;
    expect(settingsState).toBeUndefined();
  });

  // ============================================================================
  // AC-4: Type safety roundtrip — verify narrow types flow correctly
  // ============================================================================

  it("AC-4a: AgeBand narrowing prevents accidental string widening", () => {
    // Simulate storing and retrieving from localStorage as string
    const stored: string = "25-30";

    // When cast to AgeBand, it's narrowed and type-safe downstream
    const ageBand = stored as AgeBand;
    expect(ageBand).toBe("25-30");

    // But direct string assignment to AgeBand field should error at compile-time
    const profile: UserProfile = {
      // @ts-expect-error
      ageBand: Math.random().toString(), // Wider type — error
      incomeBand: "250-350",
      isPremium: false,
      premiumUntil: null,
      aiNoticeAcknowledged: false,
      onboarded: false,
    };
    expect(profile).toBeDefined();
  });

  it("AC-4b: IncomeBand narrowing in API payloads", () => {
    const req: BenchmarkRequest = {
      ageBand: "31-34",
      incomeBand: "350-450",
      categories: [],
    };

    // Verify exact type — not string, but IncomeBand literal
    expect(typeof req.incomeBand).toBe("string");
    expect(req.incomeBand).toMatch(/250-350|350-450/);
  });

  // ============================================================================
  // Common error shape
  // ============================================================================

  it("AC-1j: API error response has standard shape { error: string }", () => {
    // Verify error contract for API failures
    const error: ErrorResponse = {
      error: "analysis failed",
    };

    expect(error).toHaveProperty("error");
    expect(typeof error.error).toBe("string");
  });

  // ============================================================================
  // Integration: All types compose correctly
  // ============================================================================

  it("AC-4c: Complete workflow—profile→API request→response→storage", () => {
    // 1. UserProfile with proper band types
    const profile: UserProfile = {
      ageBand: "25-30",
      incomeBand: "250-350",
      isPremium: true,
      premiumUntil: 1757462400000,
      aiNoticeAcknowledged: true,
      onboarded: true,
    };

    // 2. Expense list
    const expenses: Expense[] = [
      {
        id: "exp1",
        amount: 12000,
        category: "식비",
        merchant: "김밥천국",
        memo: "",
        timestamp: 1754784000000,
        source: "manual",
        createdAt: 1754784000000,
      },
    ];

    // 3. API request uses same band types from profile
    const req: AnalyzeWeekRequest = {
      expenses: expenses.map((e) => ({
        amount: e.amount,
        category: e.category,
        merchant: e.merchant,
        timestamp: e.timestamp,
      })),
      profile: {
        ageBand: profile.ageBand,
        incomeBand: profile.incomeBand,
      },
    };

    expect(req.profile.ageBand).toBe("25-30");
    expect(req.profile.incomeBand).toBe("250-350");

    // 4. API response
    const resp: AnalyzeWeekResponse = {
      insights: [
        {
          type: "subscription_dup",
          title: "구독료",
          description: "중복",
          savingPotential: 10000,
        },
      ],
      summary: "summary text",
    };

    // 5. Store in WeeklyReport
    const report: WeeklyReport = {
      id: "report1",
      weekStart: 1754784000000,
      weekEnd: 1755388800000,
      totalSpent: 12000,
      categoryBreakdown: [
        { category: "식비", amount: 12000, ratio: 1.0 },
      ],
      insights: resp.insights,
      isAi: true,
      generatedAt: Date.now(),
    };

    expect(report.insights).toHaveLength(1);
    expect(report.insights[0].savingPotential).toBe(10000);

    // 6. Benchmark uses same band types
    const bench: BenchmarkResult = {
      ageBand: profile.ageBand, // Matches profile
      incomeBand: profile.incomeBand, // Matches profile
      categories: [],
      generatedAt: Date.now(),
    };

    expect(bench.ageBand).toBe(profile.ageBand);
    expect(bench.incomeBand).toBe(profile.incomeBand);
  });
});
