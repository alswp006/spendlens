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
