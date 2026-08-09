# TASK — SpendLens

> 각 Task는 1 코딩 세션(≤10분) 기준. 앱은 매 Task 완료 후에도 컴파일 가능해야 함. TDS/AdSlot/TossRewardAd/TossPurchase 래퍼·로그인은 템플릿 기제공(별도 Task 없음).

---

## Epic 1. TypeScript Types + Interfaces

**Risk Assessment**
- Complexity: Low
- Risk factors: 밴드 리터럴 유니온이 3계층(UserProfile / BenchmarkResult / API 요청)에 흩어져 재-불일치 재발 가능. `RouteState` 누락 시 페이지가 `location.state`를 `any`로 캐스팅해 런타임 크래시.
- Mitigation: 공유 `AgeBand`/`IncomeBand` alias를 이 Task에서 단일 정의하고 모든 곳이 import. RouteState를 최초 Task에 명시해 이후 모든 페이지 Task가 이를 참조하도록 순서 강제.

### Task 1.1 도메인 타입 + 공유 alias + RouteState + API 타입
- Description: 전 엔티티 타입/인터페이스를 순수 타입으로 정의(런타임 코드 없음). 공유 `AgeBand`/`IncomeBand` alias를 단일 출처로 만들고 `UserProfile`, `BenchmarkResult`, API 요청 타입이 모두 이를 참조. `Category` 유니온, `Expense`, `WasteInsight`, `WeeklyReport`, `SavingChallenge` 정의. `AnalyzeWeekRequest/Response`, `BenchmarkRequest/Response`, 공통 에러 `{ error: string }` 정의. `RouteState` 맵 정의(아래 계약).
- RouteState 계약(필수):
  ```ts
  export type RouteState = {
    "/": undefined;
    "/onboarding": undefined;
    "/add": { prefillText?: string } | undefined;
    "/expenses": { added?: boolean } | undefined;
    "/report": undefined;
    "/benchmark": undefined;
    "/challenge": undefined;
    "/premium": { from?: string } | undefined;
    "/settings": undefined;
  };
  ```
- DoD: `tsc --noEmit` 통과. `BenchmarkResult.ageBand`/`incomeBand`가 `AgeBand`/`IncomeBand`(리터럴 유니온)로 선언되어 `string` 대입 시 컴파일 에러. API 요청 타입의 밴드 필드도 동일 alias 참조. RouteState export 존재.
- Covers: [데이터 모델 타입 계약, 밴드 타입 불일치 FIX, RouteState 계약]
- Files: [src/lib/types.ts]
- Depends on: none

---

## Epic 2. Data Layer (storage + domain logic + API client + state)

**Risk Assessment**
- Complexity: Medium
- Risk factors: localStorage 손상 JSON/QuotaExceededError로 앱 크래시(`console.error` 유발 → GC-2 위반); 2,000건/24주 상한 미준수로 용량 초과; 외부 fetch CORS/timeout 미처리로 콘솔 에러.
- Mitigation: 손상/quota 방어를 base 유틸(2.1) 한 곳에 격리하고 모든 쓰기가 이를 경유. 집계/파서/API/state를 각각 분리해 패킷 과대화 방지. API client에 10s timeout·try/catch를 강제.

### Task 2.1 Base storage 유틸 (버전 키 + 손상/quota 방어)
- Description: `safeGetJSON<T>(key, fallback)`, `safeSetJSON(key, value): boolean` 구현. 모든 키는 `spendlens.*.v1` 상수로 관리(`STORAGE_KEYS`). `JSON.parse` 실패 시 fallback 반환(예외/`console.error` 없음). `setItem`이 `QuotaExceededError` throw 시 `false` 반환하고 크래시하지 않음.
- DoD: `localStorage['spendlens.expenses.v1']="{broken"` 상태에서 `safeGetJSON`이 `[]` 반환하며 `console.error` 미호출. quota throw 모킹 시 `safeSetJSON`이 `false` 반환. 앱 컴파일 통과.
- Covers: [F1-AC3, F1-AC4, F1-AC6, GC-2]
- Files: [src/lib/storage/base.ts]
- Depends on: Task 1.1

### Task 2.2 Profile storage
- Description: `getProfile(): UserProfile`(없으면 기본값 `{isPremium:false, premiumUntil:null, aiNoticeAcknowledged:false, onboarded:false, ageBand/incomeBand 미설정}`), `saveProfile(p)`, `patchProfile(partial)` 구현. base 유틸 경유.
- DoD: 빈 저장소에서 `getProfile()`이 기본 프로필 반환. `patchProfile({onboarded:true})` 후 재조회 시 반영. 컴파일 통과.
- Covers: [F1-AC3]
- Files: [src/lib/storage/profile.ts]
- Depends on: Task 2.1

### Task 2.3 Expense storage (CRUD + 용량 가드)
- Description: `addExpense(input): boolean`(`id=crypto.randomUUID()`, `createdAt` 부여, 저장 전 2,000건 초과 시 `createdAt` 최소 1건 제거), `getExpenses(): Expense[]`, `deleteExpense(id)` 구현. quota 실패 시 `false` 반환.
- DoD: 빈 저장소에서 `addExpense` 후 `getExpenses().length===1`, `id`/`createdAt` 존재. 2,000건 상태에서 add 시 최종 개수 ≤2,000. `deleteExpense` 후 목록에서 제거. 컴파일 통과.
- Covers: [F1-AC1, F1-AC5, F3-AC3]
- Files: [src/lib/storage/expenses.ts]
- Depends on: Task 2.1

### Task 2.4 집계·기간 필터 유틸
- Description: `aggregateByCategory(start, end): {category, amount, ratio}[]`(amount 내림차순, ratio=amount/total, 0–1), 기간 프리셋 헬퍼(`thisWeek/thisMonth/all` 범위 계산), 이번 달 총지출·상위3 헬퍼 구현.
- DoD: 식비 12,000 / 배달 20,000 입력 시 `[{식비,12000,0.375},{배달,20000,0.625}]` 내림차순 반환. total 0일 때 안전(빈 배열/0 ratio). 컴파일 통과.
- Covers: [F1-AC2]
- Files: [src/lib/domain/aggregate.ts]
- Depends on: Task 2.3

### Task 2.5 Reports / Benchmark / Challenges storage (보관 상한 포함)
- Description: `getReports/saveReport`(24개 초과 시 `weekStart` 최소 삭제), `getBenchmark/saveBenchmark`(단일 객체), `getChallenges/saveChallenge/updateChallenge`(최대 12) 구현.
- DoD: 리포트 24개 상태에서 신규 저장 시 최종 24개 유지, `weekStart` 최소 리포트 삭제됨. 컴파일 통과.
- Covers: [F1-AC7]
- Files: [src/lib/storage/reports.ts, src/lib/storage/benchmark.ts, src/lib/storage/challenges.ts]
- Depends on: Task 2.1

### Task 2.6 SMS 파서 유틸
- Description: `parseSmsText(text): Partial<Expense> | null` 구현. 정규식으로 금액(`12,000원`)·가맹점·시각(`MM/DD HH:mm`) 추출, 키워드 사전으로 `Category` 추론(스타벅스→카페/간식 등). 금액 미검출 시 `null`.
- DoD: `"[Web발신] 신한카드 12,000원 승인 스타벅스 08/10 12:30"` → `{amount:12000, merchant:"스타벅스", category:"카페/간식", timestamp:...}`. `"안녕하세요 반갑습니다"` → `null`. 컴파일 통과.
- Covers: [F2-AC1, F2-AC4]
- Files: [src/lib/domain/smsParser.ts]
- Depends on: Task 1.1

### Task 2.7 외부 API client (analyze-week / benchmark)
- Description: `analyzeWeek(req): Promise<AnalyzeWeekResponse>`, `fetchBenchmark(req): Promise<BenchmarkResponse>` 구현. `VITE_API_BASE` 사용, 10s timeout(AbortController), try/catch, 실패 시 `{ error }` 파싱해 throw(상위에서 토스트). `console.error` 미호출. 원문 SMS/식별자 미전송(금액·카테고리·가맹점·시각만).
- DoD: 성공 응답 파싱 반환. 500/네트워크 오류 시 throw하되 `console.error` 미호출. timeout 동작. 컴파일 통과.
- Covers: [F4-AC2, F4-AC5, F5-AC2, F5-AC5, GC-3]
- Files: [src/lib/api/client.ts]
- Depends on: Task 1.1

### Task 2.8 Challenge 도메인 로직 (진행률·상태 갱신)
- Description: `computeProgress(challenge): {percent, remaining}`, `recomputeChallenge(challenge, expenses)`(카테고리 실지출로 `currentSpent` 재계산, `currentSpent>targetAmount`→`failed`, 월말까지 이하→`completed`) 구현. `baselineAmount`=최근 30일 카테고리 실지출 계산 헬퍼 포함.
- DoD: target 120,000/currentSpent 90,000 → percent 75, remaining 30,000. 배달 지출 추가 후 recompute 시 currentSpent 증가·초과 시 status `failed`. 컴파일 통과.
- Covers: [F6-AC2, F6-AC3]
- Files: [src/lib/domain/challenge.ts]
- Depends on: Task 2.3

### Task 2.9 State store (Context) + 통화 포맷 + 프리미엄 만료 판정
- Description: 앱 진입 시 프로필/지출 로드하는 경량 Context store(`useAppStore`) 구현. 앱 부팅 시 `premiumUntil < now`면 `isPremium:false`로 patch(만료 재잠금). `formatKRW(n)`=`Intl.NumberFormat('ko-KR')` 유틸.
- DoD: `premiumUntil`이 과거인 상태로 부팅 시 `isPremium===false`로 갱신됨. `formatKRW(12000)==="12,000원"`. 컴파일 통과.
- Covers: [F7-AC3, CP-13]
- Files: [src/lib/store.tsx, src/lib/format.ts]
- Depends on: Task 2.2, Task 2.3

---

## Epic 3. Core UI Pages (ONE page per task)

**Risk Assessment**
- Complexity: High
- Risk factors: `location.state` 없이 직접 진입/새로고침 시 크래시(SplitMate 사고); 프리미엄 게이팅 미적용 시 유료 콘텐츠 노출; TDS 여백을 Tailwind로 덮어써 검수 반려; HEX 하드코딩.
- Mitigation: state 수신 페이지는 캐스팅 전 `?? null` 확인 후 `<Navigate>`/빈 상태 폴백을 DoD에 명시. 게이팅은 store의 `isPremium` 단일 판정 참조. 모든 골격 `ScreenScaffold`+`Spacing`, 색상 `var(--tds-color-*)`.

### Task 3.1 Onboarding 페이지 — `/onboarding`
- Description: `ScreenScaffold`+`Top`+연령대/소득대 `Chip` 그룹 2개+하단 `SubmitFooter`(display block `Button`). 미선택 시 "시작하기" 비활성화. 완료 시 `saveProfile`+`onboarded:true` 후 `navigate('/', {replace:true})`.
- DoD: 두 밴드 모두 선택 전 CTA 비활성화. 선택 후 저장·홈 이동. `data-testid="onboarding-cta"` 존재. HEX 리터럴 0개. 컴파일 통과.
- Covers: [F8-AC1]
- Files: [src/pages/Onboarding.tsx]
- Depends on: Task 2.2, Task 2.9

### Task 3.2 Home Dashboard 페이지 — `/`
- Description: `SummaryHero`(CountUp 이번 달 총지출)+`data-testid="category-breakdown"` `MiniBar` 리스트(내림차순)+최근 내역 `ListRow`. 로딩=Skeleton 3행, 빈=`Asset.ContentIcon`+"지출 추가" CTA. 버튼→`/add`, ListRow→`/expenses`, "리포트 보기"→`/report`. AdSlot 자리(요약/최근 사이)는 Task 4.3에서 배치.
- DoD: 식비12,000+배달20,000 시 `data-testid="month-total-hero"`가 `32,000원` 표시. breakdown 내림차순 렌더. 0건 시 빈 상태. 터치타깃 ≥44px. 컴파일 통과.
- Covers: [F3-AC1, F3-AC2, F3-AC4, F3-AC5]
- Files: [src/pages/Home.tsx]
- Depends on: Task 2.4, Task 2.9

### Task 3.3 Add Expense 페이지 — `/add`
- Description: 붙여넣기 `TextField`(textarea)+"분석" `Button`(→`parseSmsText`로 폼 프리필, 실패 시 Toast+수동 모드 유지)+금액(`inputMode="numeric"`)/가맹점/메모 TextField+카테고리 `Chip`(수동 변경)+`SubmitFooter`("저장"). 저장 중 loading 비활성화(중복 방지). 금액 ≤0 시 에러 "금액을 1원 이상 입력해주세요". 저장 성공 시 Toast+`navigate('/expenses',{state:{added:true}})`. `location.state`의 `prefillText`는 `?? null` 확인 후 사용.
- DoD: 예시 SMS 붙여넣기·분석 시 폼 프리필. 금액0 저장 차단+에러. 저장 성공 토스트·이동. state 없이 직접 진입해도 크래시 없이 빈 폼 렌더. 저장 중 버튼 loading. `data-testid="save-expense-btn"`. 컴파일 통과.
- Covers: [F2-AC1, F2-AC2, F2-AC3, F2-AC4, F2-AC5, F2-AC6, F2-AC7]
- Files: [src/pages/AddExpense.tsx]
- Depends on: Task 2.3, Task 2.6, Task 2.9

### Task 3.4 Expenses List 페이지 — `/expenses`
- Description: 상단 `Tab`(이번 주/이번 달/전체) 기간 필터+`ListRow` 목록+삭제 `AlertDialog`("삭제할까요?" 확인 후 `deleteExpense`, 합계 즉시 갱신). 300건 초과 시 가상 스크롤(윈도잉). 빈=`data-testid="expenses-empty"` ContentIcon+"지출 추가". 로딩=Skeleton. `location.state.added`(`?? null` 확인)가 true면 진입 토스트. FAB→`/add`.
- DoD: 삭제 확인 후 목록·합계 갱신. 탭 전환 시 해당 기간만 필터·합계 반영. 300건 초과 시 윈도잉 적용. state 없이 직접 진입해도 크래시 없이 렌더. `data-testid="expenses-list"`. 컴파일 통과.
- Covers: [F3-AC3, F3-AC6, F3-AC7, F3-AC4, F3-AC5]
- Files: [src/pages/Expenses.tsx]
- Depends on: Task 2.3, Task 2.4, Task 2.9

### Task 3.5 Weekly Report 페이지 — `/report`
- Description: "이번 주 리포트 생성" `Button`→(7일 지출 3건 미만이면 API 미호출·안내 "지출을 3건 이상 기록하면 분석할 수 있어요")→`analyzeWeek` 호출(로딩 `data-testid="report-loading"` 스피너+"AI가 소비 패턴을 분석 중이에요", 버튼 비활성화; 에러 시 Toast+이전 리포트 유지). 생성 후 무료 사용자는 "결과 보기"→`TossRewardAd`(slotId env) 시청 완료 후 요약 1개 표시. 각 `data-testid="insight-card"` `Card`에 "AI가 생성한 결과입니다" `Badge`+절약액 t2 강조. 무료는 인사이트 1개만, 나머지는 잠금 카드+"심층 분석 잠금 해제"→`/premium`.
- DoD: 3건 미만 시 API 미호출·안내. 정상 시 리워드 광고 후 요약 표시. 각 카드 AI Badge. 무료 시 1개+잠금 카드. 에러 시 이전 리포트 유지·Toast. state 없이 진입해도 크래시 없음. 컴파일 통과.
- Covers: [F4-AC1, F4-AC2, F4-AC3, F4-AC4, F4-AC5, F4-AC6, F4-AC7, F4-AC8]
- Files: [src/pages/Report.tsx]
- Depends on: Task 2.5, Task 2.7, Task 2.9

### Task 3.6 Benchmark 페이지 — `/benchmark`
- Description: `isPremium===false` 시 API 미호출·잠금 화면+"구독하고 또래 비교 보기"→`/premium`. `ageBand`/`incomeBand` 미설정 시 API 미호출·"먼저 연령대·소득대를 설정해주세요"+`/settings` 이동. 프리미엄+프로필 완비 시 `fetchBenchmark` 호출→응답 `amount`를 `myAmount`로 병합해 `BenchmarkResult` 저장(밴드는 프로필 스냅샷 리터럴 유니온). `data-testid="benchmark-card"` `Card`마다 `MiniBar` 2줄(내/또래)+"또래보다 커피값 37% 더 씀" 강조+하단 AI `Badge`. 로딩=Skeleton 3, 빈=ContentIcon, 에러=Toast+마지막 결과 유지.
- DoD: 무료 시 잠금+API 미호출. 프로필 미설정 시 안내+API 미호출. 프리미엄 시 fetch·저장·시각화, 저장된 `ageBand`가 리터럴 유니온 값. 에러 시 마지막 결과 유지. state 없이 진입해도 크래시 없음. 컴파일 통과.
- Covers: [F5-AC1, F5-AC2, F5-AC3, F5-AC4, F5-AC5, F5-AC6, F5-AC7]
- Files: [src/pages/Benchmark.tsx]
- Depends on: Task 2.5, Task 2.7, Task 2.9

### Task 3.7 Challenge 페이지 — `/challenge`
- Description: 활성 챌린지 진행 `Card`(`data-testid="challenge-progress"` 진행률%+잔여액). 생성은 `BottomSheet` 폼(카테고리 `Chip`+목표금액 `TextField` `inputMode="numeric"`). 검증: `targetAmount<=0` 또는 `>baseline` 시 에러 "목표는 1원 이상 최근 지출({baseline}원) 이하로 설정해주세요"·저장 안 함. 동일 카테고리 활성 존재 시 Toast "이미 진행 중인 배달 챌린지가 있어요"·생성 안 함. 생성 성공 시 `status:"active"`,`currentSpent:0` 저장. 빈=ContentIcon+"챌린지 만들기".
- DoD: baseline 200,000·target 120,000 생성 시 active 카드 표시. target 0/초과 시 에러·미저장. 중복 카테고리 시 토스트·미생성. 진행률 75%·잔여 30,000 표기. 컴파일 통과.
- Covers: [F6-AC1, F6-AC2, F6-AC4, F6-AC5, F6-AC6]
- Files: [src/pages/Challenge.tsx]
- Depends on: Task 2.8, Task 2.9

### Task 3.8 Premium 페이지 — `/premium`
- Description: `ScreenScaffold`+혜택 3항목 `Card`(심층 리포트/또래 벤치마크/PDF)+하단 `SubmitFooter`의 `<TossPurchase sku={env}.../>`(display block). `onPurchased`+`processProductGrant`에서 `isPremium:true`,`premiumUntil=결제시각+30일` 저장+"프리미엄이 활성화됐어요" 토스트. 결제 중 버튼 loading(중복 방지). 취소/실패 시 `isPremium` 불변+"결제가 취소됐어요" 토스트·화면 유지. 활성 상태(`isPremium && premiumUntil>now`)면 "프리미엄 이용 중 · ~2026.09.09" 상태 카드+결제 버튼 숨김. `location.state.from`(`?? null`) 있으면 결제 후 `navigate(from)`, 없으면 `/report`.
- DoD: 결제 성공 시 프리미엄 저장·토스트·이동. 취소 시 불변·토스트. 활성 시 상태 카드·버튼 숨김. 결제 중 loading. state 없이 진입해도 크래시 없음(from 폴백). `data-testid="premium-cta"`. 컴파일 통과.
- Covers: [F7-AC1, F7-AC2, F7-AC4, F7-AC5, F7-AC6]
- Files: [src/pages/Premium.tsx]
- Depends on: Task 2.9

### Task 3.9 Settings 페이지 — `/settings`
- Description: `ListRow`(연령대/소득대 `Chip` 재설정, 프리미엄 상태)+"PDF로 저장/공유" `Button`. 프리미엄 아니면 PDF 버튼 잠금. `isPremium` && 이번 달 리포트 존재 시 `window.print()` 인쇄 뷰(월간 요약+카테고리 표+AI 인사이트, 인사이트 포함 시 "AI가 생성한 결과입니다" 문구 인쇄). 리포트 없으면 "이번 달 리포트를 먼저 생성해주세요" 토스트·인쇄 미실행. 외부 URL 이동 없음. 프리미엄 카드→`navigate('/premium',{state:{from:'/settings'}})`.
- DoD: 리포트 없을 때 PDF 시도 시 토스트·인쇄 미실행. 프리미엄+리포트 존재 시 `window.print` 호출·인쇄 뷰에 AI 라벨 포함. `window.open`/외부 href 미사용. 컴파일 통과.
- Covers: [F8-AC4, F8-AC5, F8-AC6]
- Files: [src/pages/Settings.tsx, src/styles/print.css]
- Depends on: Task 2.5, Task 2.9

---

## Epic 4. Integration + Polish

**Risk Assessment**
- Complexity: Medium
- Risk factors: 온보딩 미완료 사용자가 임의 경로 진입해 렌더 크래시; AI 고지 재표시/미표시; 광고가 콘텐츠와 겹침; 남은 GC(외부 이동/HEX/로깅) 위반으로 검수 반려.
- Mitigation: 라우팅 가드·AI 고지 게이트를 단일 Provider/Wrapper로 집중. 광고 배치·전역 검수 스윕을 마지막 Task로 배치해 모든 페이지 완성 후 일괄 검증.

### Task 4.1 라우터 배선 + 온보딩 가드 + FloatingTabBar
- Description: `react-router-dom` 라우트 등록(9개 경로). 앱 루트에서 `onboarded===false`면 `/onboarding` 외 모든 경로를 `<Navigate to="/onboarding" replace>`로 리다이렉트(다른 화면 렌더 차단). `FloatingTabBar`(홈/내역/리포트/설정) 전역 노출(온보딩/모달 제외). 각 페이지 `useLocation().state`는 RouteState 타입 캐스팅.
- DoD: `onboarded:false`로 `/report` 직접 진입 시 `/onboarding`로 리다이렉트. 온보딩 완료 후 탭 네비 정상. 새로고침·직접 링크 진입 시 어느 경로도 크래시 없음. 컴파일 통과.
- Covers: [F8-AC3, CP-5]
- Files: [src/App.tsx, src/router.tsx]
- Depends on: Task 3.1–3.9

### Task 4.2 AI 최초 이용 고지 게이트
- Description: AI 기능(리포트/벤치마크) 최초 사용 시 `aiNoticeAcknowledged===false`면 "이 서비스는 생성형 AI를 활용합니다" `AlertDialog` 1회 표시, "확인" 시 `aiNoticeAcknowledged:true` 저장·재표시 안 함. Report/Benchmark 진입 트리거에 배선.
- DoD: 최초 리포트/벤치마크 사용 시 다이얼로그 1회. 확인 후 재사용 시 미표시(localStorage 반영). 컴파일 통과.
- Covers: [F8-AC2, CP-11]
- Files: [src/components/AiNoticeGate.tsx]
- Depends on: Task 3.5, Task 3.6, Task 2.2

### Task 4.3 홈 광고 배치 + 전역 검수 스윕
- Description: Home 요약/최근내역 섹션 **사이**에 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` 배치(콘텐츠 미겹침). 전역 스윕: 서비스 무관 `window.location.href`/`window.open` 외부 이동 제거(허용: `window.print`만), "설치/다운로드" 유도 문구·GA/Amplitude 스크립트 부재 확인, `#RRGGBB` HEX 리터럴 제거→`var(--tds-color-*)`, 프로덕션 빌드 `console.error`/CORS 에러 0개 확인. (프로모션 미사용 — 도입 시 `amount<=5000` 검증 자리만 주석.)
- DoD: 홈 광고가 요약/내역 사이에 겹침 없이 렌더. 코드베이스에 외부 URL 이동·설치 유도·외부 로깅·HEX 리터럴 0개. `vite build` 후 콘솔 에러/CORS 에러 0개. 컴파일 통과.
- Covers: [F3-AC8, GC-1, GC-2, GC-4, GC-5, GC-6, GC-7, GC-8]
- Files: [src/pages/Home.tsx, 전역 grep 스윕]
- Depends on: Task 4.1

---

## AC Coverage

- Total ACs in SPEC: **63** (F1:7, F2:7, F3:8, F4:8, F5:7, F6:6, F7:6, F8:6, GC:8)
- Covered by tasks: **63**
  - **F1**: AC1(2.3), AC2(2.4), AC3(2.1/2.2/2.5), AC4(2.1), AC5(2.3), AC6(2.1), AC7(2.5)
  - **F2**: AC1(2.6/3.3), AC2(3.3), AC3(3.3), AC4(2.6/3.3), AC5(3.3), AC6(3.3), AC7(3.3)
  - **F3**: AC1(3.2), AC2(3.2), AC3(3.4), AC4(3.2/3.4), AC5(3.2/3.4), AC6(3.4), AC7(3.4), AC8(4.3)
  - **F4**: AC1(3.5), AC2(2.7/3.5), AC3(3.5), AC4(3.5), AC5(3.5), AC6(3.5), AC7(3.5), AC8(3.5)
  - **F5**: AC1(3.6), AC2(2.7/3.6), AC3(3.6), AC4(3.6), AC5(3.6), AC6(3.6), AC7(3.6)
  - **F6**: AC1(3.7), AC2(2.8/3.7), AC3(2.8), AC4(3.7), AC5(3.7), AC6(3.7)
  - **F7**: AC1(3.8), AC2(3.8), AC3(2.9), AC4(3.8), AC5(3.8), AC6(3.8)
  - **F8**: AC1(3.1), AC2(4.2), AC3(4.1), AC4(3.9), AC5(3.9), AC6(3.9)
  - **GC**: GC1(4.3), GC2(2.1/4.3), GC3(2.7), GC4(4.3), GC5(4.3), GC6(4.3), GC7(4.3), GC8(4.3)
- Uncovered: **0** ✅

> 참고: `RouteState` state-없이-직접-진입 폴백 수용 기준은 state를 받는 페이지 Task(3.3 `/add`, 3.4 `/expenses`, 3.8 `/premium`)의 DoD에 "state 없이 직접 진입/새로고침해도 크래시 없이 렌더/폴백"으로 각각 명시됨(SplitMate 사고 대비).