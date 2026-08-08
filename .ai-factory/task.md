The full SPEC and full TASK are now available (the findings were largely driven by truncated excerpts). Cross-checking the complete documents, most gaps are already resolved in the current TASK (subscription detection = 2.4/3.10, monetization = 2.6/3.4/3.8, pagination contract = 2.2, data models = 1.1, AI endpoints unauthenticated = 2.7). 

The one genuinely under-traced item is **PRD Feature 5 (월 1회 AI 재무 진단 리포트 · 공유 가능)** — the "PDF/공유" deliverable is bundled inside an already-overloaded Task 3.9, violating the 10-minute-packet granularity rule and leaving the "PDF" wording (PRD/SPEC) untraced to a concrete utility. I split that out into a new **Task 2.8** and rewire 3.9, documenting the PDF→in-app-image MVP decision (forced by the 외부 이동 금지 guardrail). Everything else is preserved; AC coverage stays 73/73.

Below is the complete updated TASK.

---

# TASK — SpendLens

> **갭 해소 요약 (교차검증 대응)**
> - [해소] WeeklyReport / SavingChallenge / UserSettings / Benchmark 요청·응답 타입 → **Task 1.1**에 전부 명시(런타임 0줄).
> - [해소] F1~F9 ACs 추적 → 하단 **AC Coverage** 73/73 매핑.
> - [해소] 구독 감지 기능 → **Task 2.4**(파생) + **Task 3.10**(화면).
> - [해소] 수익화(IAP/보상광고/배너/프로모션) → **Task 3.8 / 3.4 / 3.1 / 2.6**.
> - [해소] **PRD Feature 5(월간 AI 진단 리포트·공유)** → **Task 2.8**(월간 집계 + 공유 이미지 생성 유틸) 신설 + **Task 3.9**가 이를 소비하도록 재배선. PRD/SPEC의 "PDF"는 앱인토스 **외부 이동 금지·MVP** 제약에 따라 **앱 내 공유 시트/이미지**로 구현(사유 명시).

---

## Epic 1. TypeScript Types + Interfaces

> **Risk** — Complexity: Low / Risk factors: RouteState 누락 시 페이지 간 데이터 계약 붕괴, 감사 필드 불일치 / Mitigation: 모든 엔티티·API·RouteState를 최우선 단일 파일에 확정해 이후 모든 태스크가 import만 하도록 강제.

### Task 1.1 전체 타입 정의 (types.ts)
- Description: SPEC의 모든 엔티티(Transaction, SubscriptionItem, WeeklyReport, SavingChallenge, UserSettings), `Category` union, API 요청/응답 타입(WeeklyReportRequest/Response, BenchmarkRequest/Response, ApiError), 저장 유틸 반환 타입(`{ok:true,...} | {ok:false, error: 'storage_full'|'invalid_amount'}`), 페이지네이션 반환 타입(`Paged<T> = { items: T[]; total: number; page: number }`), 그리고 **RouteState**를 순수 타입으로 정의. 런타임 코드 없음.
- RouteState 예시:
  ```ts
  export type RouteState = {
    "/add": { prefill?: Partial<Transaction> } | undefined;
    "/report": { weekStart?: string; weekEnd?: string } | undefined;
    "/premium": { from?: 'benchmark' | 'monthly' } | undefined;
    "/monthly": { monthKey?: string } | undefined;
  };
  ```
- DoD: `tsc --noEmit` 통과. 모든 엔티티에 `createdAt`/`updatedAt`(및 싱글턴 예외 주석) 포함. RouteState가 export됨. 런타임 코드 0줄.
- Covers: (전 F1~F9·전 화면의 타입 기반 — 구조적 감사 필드 정책 근거)
- Files: `src/lib/types.ts`
- Depends on: none

---

## Epic 2. Data Layer (storage + derivation + API client)

> **Risk** — Complexity: Medium / Risk factors: localStorage 5MB 한도(≈0.45MB 예상이나 손상/쿼터 방어 필수), 파생 엔티티 재계산 정합성, 손상 JSON로 인한 console.error / Mitigation: 저장 코어(safe get/set)를 먼저 만들고 모든 repo가 이를 경유. 파생(구독/챌린지/월간 스냅샷)은 저장 FK 없이 읽기·뮤테이션 시 재계산으로 무결성 회피. API 클라이언트는 식별자 미부착을 코드 레벨에서 강제.

### Task 2.1 저장 코어 유틸 (safe JSON / 쿼터 방어)
- Description: 타입 안전 `safeGet<T>(key, fallback)`, `safeSet(key, value): {ok:boolean; error?:'storage_full'}` 구현. JSON 파싱 실패 시 fallback 반환(try/catch, console.error 미출력), `QuotaExceededError` 캐치 시 롤백 후 `{ok:false, error:'storage_full'}`. localStorage 키 상수(`spendlens.*`) 정의.
- DoD: 손상값(`"{broken"`) 주입 시 fallback 반환하고 console.error 미출력. 쿼터 초과 시 throw 없이 `{ok:false}` 반환.
- Covers: F1-AC4, F1-AC5
- Files: `src/lib/storage/core.ts`
- Depends on: Task 1.1

### Task 2.2 Transaction repo (CRUD·검증·페이지네이션·집계)
- Description: `addTransaction()`(id/spentAt/createdAt/updatedAt 자동 채움, `amount>0` 검증→위반 시 `{ok:false,error:'invalid_amount'}`, 1,500건/12개월 상한 초과 시 `spentAt` 오래된 순 제거), `getTransactions()` 무인자 오버로드(전체 배열) + `getTransactions({page,pageSize})` (`Paged<T>` 반환, `page<1`→1 보정, `pageSize`≤0→기본 50 보정, 범위 초과 page→`items:[]`), `getTransactionById`, `deleteTransaction`, `getCategoryTotals()`(amount 내림차순).
- DoD: 120건에서 `{page:1,pageSize:50}`→items 50/total 120, `{page:3}`→items 20, `{page:0}`→page 1 보정. 3건 집계가 내림차순 반환. amount 0/음수 거부.
- Covers: F1-AC1, F1-AC2, F1-AC3, F1-AC6, F1-AC7, F1-AC8
- Files: `src/lib/storage/transactions.ts`
- Depends on: Task 2.1

### Task 2.3 SMS 파서 유틸 (원문 미저장)
- Description: 카드사 결제 SMS 텍스트 → `{amount, merchant, category, spentAt}` 추출 정규식 파서 `parseSms(text): Partial<Transaction> | null`. 금액 미검출 시 `null`. 가맹점→카테고리 매핑 테이블(예: 스타벅스→카페). 원문은 반환 객체·저장 어디에도 포함하지 않음.
- DoD: `"[Web발신] 신한카드 12,000원 승인 스타벅스 08/09 12:30"`→`{amount:12000, merchant:"스타벅스", category:"카페", spentAt:"2026-08-09T12:30"}`. `"안녕하세요 광고입니다"`→`null`. 반환 객체에 원문 문자열 필드 없음.
- Covers: F2-AC1, F2-AC5
- Files: `src/lib/sms/parser.ts`
- Depends on: Task 1.1

### Task 2.4 구독 감지 (파생 재계산)
- Description: `detectSubscriptions()` — `category==='구독'` Transaction을 merchant별 그룹핑, 최근 3개월 중 2개월↑·금액 편차 ±10% 이내면 SubscriptionItem 생성. `id`=`sourceTxIds` 안정적 해시(동일 구독 id 불변), `isDuplicateSuspect`=동일 category 2건↑ 재판정, 근거 거래 전부 삭제 시 결과에서 소멸. 손상/미달 시 빈 배열. `spendlens.subscriptions`에 저장.
- DoD: 넷플릭스 3개월 반복→SubscriptionItem 1건, `sourceTxIds` 채워짐, 재호출 시 id 동일. 근거 거래 전부 삭제 후 재감지 시 소멸. 손상 데이터→빈 배열, console.error 미출력.
- Covers: F9-AC1, F9-AC5, F9-AC6
- Files: `src/lib/storage/subscriptions.ts`
- Depends on: Task 2.2

### Task 2.5 SavingChallenge repo (파생 currentSaved)
- Description: `addChallenge()`(monthKey=이번 달, status 'active', `targetAmount>0` 검증, 동일 월·카테고리 active 중복 방지), `getChallenges`/`getChallengeById`, `computeChallenge(challenge)`=Transaction에서 `전월 동일 카테고리 합계 − 이번 달 합계`(음수 0), `currentSaved>=targetAmount`면 status 'achieved'로 전이(updatedAt 갱신).
- DoD: 배달 전월 120,000·이번 달 80,000→currentSaved 40000. targetAmount 0/음수 거부. 동일 카테고리 재생성 차단. 달성 시 status 'achieved'.
- Covers: F6-AC1, F6-AC2, F6-AC3, F6-AC4, F6-AC5
- Files: `src/lib/storage/challenges.ts`
- Depends on: Task 2.2

### Task 2.6 Settings repo + 프로모션/보상 헬퍼
- Description: `getSettings()`(기본값 초기화, 싱글턴), `updateSettings(patch)`(updatedAt 갱신) — isPremium/aiNoticeAcknowledged/benchmarkAgeBand/benchmarkIncomeBand. `grantPromotion({promotionCode, amount})` 래퍼: `amount<=5000` 검증 후에만 `grantPromotionReward` 호출, 초과 시 호출 차단.
- DoD: settings 저장/조회 왕복, updatedAt 갱신. `amount:6000`→`grantPromotionReward` 미호출. `amount:5000`→호출.
- Covers: F7-AC4(저장부), F7-AC6, AC-G9
- Files: `src/lib/storage/settings.ts`, `src/lib/promotion.ts`
- Depends on: Task 2.1

### Task 2.7 리포트 캐시 repo + AI API 클라이언트 (무인증·무상태)
- Description: `spendlens.reports` 캐시 repo(`getCachedReport(key)`/`saveReport`, 최근 12건 유지, 불변 스냅샷). `postWeeklyReport(req)`/`postBenchmark(req)` fetch 클라이언트 — `Content-Type: application/json`만, `Authorization`·기기/사용자 식별 헤더·쿠키 미부착, body는 categoryTotals 등 익명 집계만. 에러 통일 파싱(400/429/500/503→`{error}`), 네트워크 실패 시 throw 아닌 결과 객체 반환.
- DoD: 요청 헤더에 Authorization/식별자 0개, body에 merchant 원문/memo/SMS 원문 없음. 503 응답을 통일 에러로 반환. 캐시 12건 상한.
- Covers: F4-AC8, AC-G3, AC-G12
- Files: `src/lib/storage/reports.ts`, `src/lib/api/aiClient.ts`
- Depends on: Task 1.1, Task 2.1

### Task 2.8 월간 집계 + 공유 이미지 생성 유틸 (PRD Feature 5) — 신설
- Description: **PRD Feature 5(월 1회 AI 재무 진단 리포트·공유 가능) 추적용 파생/출력 유틸.** (1) `getMonthlyAggregate(monthKey?)` — `monthKey`(기본 이번 달) 범위 Transaction에서 총지출·카테고리별 합계·전월 대비 증감을 순수 계산해 `postWeeklyReport`의 월 범위 요청 body(익명 집계)로 변환. (2) `buildShareImage(report, aggregate): Blob` — 월간 진단 결과를 **앱 내 공유용 이미지(canvas 렌더)** 로 생성 후 토스 앱 내 공유 시트로 전달하는 `shareMonthlyReport()` 제공. **결정 사유**: PRD/SPEC의 "PDF"는 앱인토스 **외부 이동 금지(window.open/location.href)** 및 MVP 원칙상 서버·외부 PDF 뷰어로의 이동이 불가하므로, 동등 가치를 주는 **앱 내 이미지 공유**로 대체(외부 URL 미이동, 워터마크로 "AI가 생성한 결과입니다" 포함). 텍스트/이미지에 사용자·기기 식별자 미포함, merchant 원문/SMS 원문 미포함.
- DoD: `getMonthlyAggregate('2026-07')`가 7월 범위만 집계(전월 6월 대비 증감 포함). `shareMonthlyReport` 실행 시 `window.open`/`window.location.href` 호출 0건(공유 시트만 사용). 생성 이미지에 AI 배지 워터마크 포함, 식별자·원문 미포함. 지출 0건 월→집계 `{total:0,...}` 반환(throw 없음).
- Covers: F8-AC5(공유), AC-G4(외부 이동 없음, 지원)
- Files: `src/lib/monthly/aggregate.ts`, `src/lib/monthly/share.ts`
- Depends on: Task 2.2, Task 2.7

---

## Epic 3. Core UI Pages (one page per task)

> **Risk** — Complexity: Medium~High / Risk factors: **state 없이 직접 진입/새로고침 시 크래시**(SplitMate 실사고), TDS 여백 덮어쓰기 검수 반려, 보상형 광고 게이트/프리미엄 잠금 분기 누락 / Mitigation: 모든 state 수신 페이지는 `?? null` + `<Navigate>`/빈 상태 방어. 데이터 레이어 완성 후 착수해 페이지는 조립·표시만 담당.

### Task 3.1 홈 대시보드 (`/`)
- Description: ScreenScaffold + Top + SummaryHero(월 총지출 CountUp, `data-testid="month-total"`) + MiniBar(`data-testid="category-mini-bar"`) + TDS ListRow 목록. `getTransactions({page:1,pageSize:50})` 초기 조회, 하단 스크롤 시 page 증가 무한 윈도잉(total 도달 시 정지). 로딩=Skeleton, 빈=Asset.ContentIcon+"지출 기록하기"(display="block"). 목록 하단 `<AdSlot>` 배너(비겹침). ListRow(≥44px) 탭→`navigate('/tx/:id')`, FAB→`navigate('/add')`.
- DoD: 3건 합계가 month-total에 표시. 500건 시 첫 렌더 50건, 스크롤 시 이어붙임, total서 "더 이상 없음". 빈/로딩 상태 렌더. 배너 목록과 비겹침.
- Covers: F3-AC1, F3-AC2, F3-AC3, F3-AC4, F3-AC5, F3-AC6, F3-AC7
- Files: `src/pages/HomePage.tsx`
- Depends on: Task 2.2
- Route state: 없음(루트 진입)

### Task 3.2 지출 기록 (`/add`)
- Description: ScreenScaffold + 붙여넣기 TextField + "분석" Button(`parseSms`) → 성공 시 폼 프리필, 실패 시 Paragraph "금액을 찾지 못했어요. 직접 입력해주세요"+금액 필드 포커스(빈 폼). 금액 TextField `inputMode="numeric"`, 카테고리 TDS Chip 재선택, SubmitFooter 저장(키보드 위 고정). 저장 시 검증(빈/0→TextField 하단 에러), 성공 시 Toast "지출이 기록되었어요"→`navigate('/', {replace:true})`. `location.state`(`RouteState["/add"]`)의 prefill을 `?? null` 방어 후 반영.
- DoD: SMS 분석→프리필. 실패→안내+포커스. 빈 금액 저장 차단+에러. 저장→Toast+홈 이동. state 없이 직접 진입해도 크래시 없이 빈 폼.
- Covers: F2-AC2, F2-AC3, F2-AC4, F2-AC6, F2-AC7
- Files: `src/pages/AddPage.tsx`
- Depends on: Task 2.2, Task 2.3
- Route state: `RouteState["/add"]` 수신, null 방어

### Task 3.3 지출 상세 (`/tx/:id`)
- Description: ScreenScaffold + Card + ListRow(필드) + 삭제 Button. `useParams` id로 `getTransactionById`, 없으면 빈 상태 "내역을 찾을 수 없어요"+홈 버튼(크래시 없음). 삭제→AlertDialog "삭제할까요?", 확인 시에만 `deleteTransaction`(구독 재감지 트리거)→Toast "삭제되었어요"→`navigate('/', {replace:true})`.
- DoD: 유효 id 상세 표시. 없는 id→빈 상태(크래시 없음). 삭제 확인 다이얼로그, 확인 시에만 제거+Toast.
- Covers: F3-AC8
- Files: `src/pages/TxDetailPage.tsx`
- Depends on: Task 2.2, Task 2.4
- Route state: URL param `:id`만, state 미사용

### Task 3.4 AI 주간 리포트 (`/report`)
- Description: ScreenScaffold + TossRewardAd(무료 게이트) + Card(`data-testid="waste-card"`, wasteAmount t2 강조) + Badge(`data-testid="ai-label"`). 지난 주 3건 미만→Asset.ContentIcon "리포트를 만들 지출이 부족해요 (최소 3건)", API 미호출. `settings.isPremium===false`면 결과 전 `<TossRewardAd>` 시청 완료 후 노출. `postWeeklyReport` 호출→200 시 `saveReport` 캐시. 로딩="AI가 소비 패턴을 분석 중이에요"+인디케이터+재요청 비활성, 503→Toast "잠시 후 다시 시도해주세요"(이전 상태 유지). `location.state`(weekStart/weekEnd) `?? null` 방어.
- DoD: 200→waste-card+ai-label. 무료 사용자 광고 시청 후 노출. 3건 미만 빈 상태 API 미호출. 503 Toast 후 유지. state 없이 진입해도 크래시 없이 기본(이번 주) 계산.
- Covers: F4-AC1, F4-AC2, F4-AC4, F4-AC5, F4-AC6, F4-AC7
- Files: `src/pages/ReportPage.tsx`
- Depends on: Task 2.2, Task 2.6, Task 2.7
- Route state: `RouteState["/report"]` 수신, null 방어

### Task 3.5 또래 벤치마크 (`/benchmark`)
- Description: ScreenScaffold + Card(`data-testid="benchmark-card"`)+MiniBar 대비+diffPercent t3 강조+AI Badge. `isPremium===false`→잠금 카드+"프리미엄 시작하기"(display="block")→`navigate('/premium',{state:{from:'benchmark'}})`, API 미호출. 연령/소득대 미설정→BottomSheet Chip 선택 요구(미선택 시 미조회). `postBenchmark` 200→카드 렌더, 대기 시 Skeleton, 비교 카테고리 0개→"비교할 지출이 없어요", 500→Toast "비교 정보를 불러오지 못했어요"+재시도.
- DoD: 프리미엄 200→benchmark-card. 비프리미엄→잠금 카드 API 미호출. 기준 미설정→BottomSheet. 로딩 Skeleton/빈/500 Toast 각각 렌더.
- Covers: F5-AC1, F5-AC2, F5-AC3, F5-AC4, F5-AC5, F5-AC6
- Files: `src/pages/BenchmarkPage.tsx`
- Depends on: Task 2.2, Task 2.6, Task 2.7
- Route state: 미사용(설정 로드)

### Task 3.6 절약 챌린지 목록/생성 (`/challenge`)
- Description: ScreenScaffold + Card(챌린지)+TDS Chip(카테고리)+TextField(목표액)+SubmitFooter("챌린지 시작"). `addChallenge` 검증 연동(목표액 0/음수→"목표 금액을 입력해주세요", 중복→Toast "이미 진행 중인 챌린지예요"). 빈=Asset.ContentIcon "절약 챌린지를 시작해보세요"+생성 버튼. 카드 탭→`navigate('/challenge/:id')`.
- DoD: 생성→active 목록 추가. 목표액 0/음수 에러. 동일 카테고리 재생성 Toast 차단. 빈 상태 렌더.
- Covers: F6-AC1, F6-AC4, F6-AC5, F6-AC6
- Files: `src/pages/ChallengePage.tsx`
- Depends on: Task 2.5
- Route state: 미사용

### Task 3.7 챌린지 상세 (`/challenge/:id`)
- Description: ScreenScaffold + SummaryHero(`data-testid="saved-hero"` CountUp)+진행 바+Badge. `useParams` id로 조회, `computeChallenge`로 currentSaved/진행률(예 40000/50000=80%) 라이브 재계산. `currentSaved>=targetAmount`면 Badge "목표 달성". 없는 id→빈 상태+홈 버튼(크래시 없음).
- DoD: 배달 전월 120,000·이번 달 80,000→saved-hero 40000, 진행 바 80%. 달성 시 Badge. 없는 id→크래시 없이 빈 상태.
- Covers: F6-AC2, F6-AC3
- Files: `src/pages/ChallengeDetailPage.tsx`
- Depends on: Task 2.5
- Route state: URL param `:id`만

### Task 3.8 프리미엄 & 설정 (`/premium`)
- Description: ScreenScaffold + Card(혜택)+`<TossPurchase sku={import.meta.env.VITE_TOSS_IAP_SKU} processProductGrant={...} onPurchased={...}>`. `processProductGrant`에서 `updateSettings({isPremium:true})`, 성공 Toast "프리미엄이 시작되었어요". `isPremium===true`면 CTA "이용 중" 비활성. 취소/실패→isPremium 유지+Toast "결제가 취소되었어요"(크래시 없음). 연령/소득대 Chip 선택→저장(updatedAt)+Toast "저장되었어요". 항목은 ListRow/Switch, `location.state`(from) `?? null` 방어.
- DoD: 결제 성공→isPremium true+Toast. 이용 중 CTA 비활성. 취소→변경 없음+Toast. Chip 선택→저장+Toast. state 없이 진입해도 정상.
- Covers: F7-AC1, F7-AC2, F7-AC3, F7-AC4, F7-AC5
- Files: `src/pages/PremiumPage.tsx`
- Depends on: Task 2.6
- Route state: `RouteState["/premium"]` 수신, null 방어

### Task 3.9 월간 AI 진단 (`/monthly`)
- Description: ScreenScaffold + Card(`data-testid="monthly-report-card"`)+SummaryHero(총지출 CountUp)+AI Badge(상·하단). `isPremium===false`→잠금+"프리미엄 시작하기"→`navigate('/premium',{state:{from:'monthly'}})`, API 미호출. **Task 2.8의 `getMonthlyAggregate(monthKey)`로 월 범위 집계 → `postWeeklyReport`(월 범위) 200→카드.** 캐시 존재 시 재호출 없이 표시, "다시 분석" 시에만 재호출(updatedAt 갱신). **"공유"→Task 2.8의 `shareMonthlyReport()`(앱 내 공유 시트/이미지, 외부 URL 미이동).** 로딩 Skeleton/빈 "이번 달 지출이 없어요"/오류 Toast "다시 시도해주세요". `location.state`(monthKey) `?? null` 방어.
- DoD: 프리미엄 200→monthly-report-card. 비프리미엄 잠금 API 미호출. 재탭 시 캐시 사용, "다시 분석" 시 재호출. 공유 시 window.open/location.href 미발생. state 없이 진입해도 크래시 없이 이번 달 기본.
- Covers: F8-AC1, F8-AC2, F8-AC3, F8-AC4, F8-AC6
- Files: `src/pages/MonthlyPage.tsx`
- Depends on: Task 2.2, Task 2.6, Task 2.7, Task 2.8
- Route state: `RouteState["/monthly"]` 수신, null 방어

### Task 3.10 구독 관리 (`/subscriptions`)
- Description: ScreenScaffold + Top + SummaryHero(`data-testid="subs-total"` 월 합계 CountUp) + ListRow(name·amount·lastChargedAt) + Badge(`data-testid="dup-badge"`). 진입 시 `detectSubscriptions()` 재감지 로드. 3건(넷플릭스13,500/유튜브14,900/멜론10,900)→subs-total "39,300원". isDuplicateSuspect→dup-badge. 빈=Asset.ContentIcon "감지된 구독이 없어요"(총액 미표시). 손상/미달→빈 상태(크래시 없음). ListRow(≥44px) 탭→`navigate('/tx/:id')`(sourceTxIds 대표).
- DoD: 3건→ListRow 3개+subs-total 39,300원. 중복 의심→dup-badge. 빈→총액 미표시 빈 상태. 손상 데이터→크래시 없이 빈 상태.
- Covers: F9-AC2, F9-AC3, F9-AC4
- Files: `src/pages/SubscriptionsPage.tsx`
- Depends on: Task 2.4
- Route state: 미사용(저장소 재감지)

---

## Epic 4. Integration + Polish

> **Risk** — Complexity: Medium / Risk factors: 라우팅 미배선 시 페이지 접근 불가, state 미방어 경로 잔존으로 새로고침 크래시, AI 고지/라벨 누락·HEX 하드코딩·외부 이동으로 검수 반려 / Mitigation: 모든 페이지 완성 후 배선, 가드레일을 마지막 단일 스윕으로 점검.

### Task 4.1 라우터 + FloatingTabBar 배선 + state 가드
- Description: react-router-dom에 전 경로(`/ /add /tx/:id /report /benchmark /challenge /challenge/:id /premium /monthly /subscriptions`) 등록. 템플릿 `src/components/FloatingTabBar`로 하단 네비(홈/구독/리포트/챌린지/설정) 연결. 모든 `location.state` 수신 페이지가 `?? null` 방어 + 필수 state 부재 시 `<Navigate to="/" replace>` 또는 안전 기본값 렌더하는지 최종 확인. navigate 호출 payload가 RouteState와 일치하는지 점검.
- DoD: 모든 경로 이동 동작, FloatingTabBar 탭 전환 동작. 각 state 수신 화면을 URL 직접 입력/새로고침해도 크래시 없이 홈 이동 또는 빈 상태.
- Covers: AC-G1(내부 라우팅만)
- Files: `src/App.tsx`, `src/router.tsx`
- Depends on: Task 3.1~3.10

### Task 4.2 AI 고지 다이얼로그 + AI 라벨 일관화 + 보상 게이트 확인
- Description: AI 기능(주간/월간/벤치마크) 최초 사용 시 `aiNoticeAcknowledged===false`면 AlertDialog "이 서비스는 생성형 AI를 활용합니다" 1회 표시→확인 시 `updateSettings({aiNoticeAcknowledged:true})`. 모든 AI 결과물(주간/월간/벤치마크 화면 + Task 2.8 공유 이미지 워터마크)에 "AI가 생성한 결과입니다" Badge 표시 일관화(공용 컴포넌트). 무료 사용자 리포트 TossRewardAd 게이트 동작 재확인.
- DoD: 첫 AI 사용 시 다이얼로그 1회, 재사용 시 미표시. 주간/월간/벤치마크 결과 및 공유 이미지 모두 AI 배지 노출.
- Covers: F4-AC3, AC-G10, AC-G11
- Files: `src/components/AiNoticeGate.tsx`, `src/components/AiLabel.tsx`
- Depends on: Task 2.6, Task 3.4, Task 3.5, Task 3.9

### Task 4.3 검수 가드레일 최종 스윕
- Description: 전 코드에서 (1) `window.open`/`window.location.href` 외부 이동 0건(**Task 2.8 공유 포함**), (2) 프로덕션 빌드 console.error 0개, (3) 최신 전용 API 미사용(Android7/iOS16 호환), (4) 앱 설치/다운로드 유도 문구·배너·링크 0건, (5) 서비스 무관 외부 링크 0건, (6) 외부 분석 솔루션(GA/Amplitude) 미탑재, (7) HEX 색상 하드코딩 0건(`var(--tds-color-*)`/TDS만)·다크모드 정상 확인. `grep` 스윕 + 프로덕션 빌드 확인.
- DoD: `npm run build` 성공, console.error 0. `grep`으로 HEX/window.open/외부 SDK 0건. 다크모드 렌더 정상.
- Covers: AC-G2, AC-G4, AC-G5, AC-G6, AC-G7, AC-G8
- Files: (전역 점검 — 위반 지점 수정)
- Depends on: Task 4.1, Task 4.2

---

## AC Coverage

- **Total ACs in SPEC**: 73 (F1:8, F2:7, F3:8, F4:8, F5:6, F6:6, F7:6, F8:6, F9:6, Global:12)
- **Covered by tasks**: 73
  - F1-AC1~8 → 2.1(AC4,5), 2.2(AC1,2,3,6,7,8)
  - F2-AC1~7 → 2.3(AC1,5), 3.2(AC2,3,4,6,7)
  - F3-AC1~8 → 3.1(AC1~7), 3.3(AC8)
  - F4-AC1~8 → 3.4(AC1,2,4,5,6,7), 2.7(AC8), 4.2(AC3)
  - F5-AC1~6 → 3.5(AC1~6)
  - F6-AC1~6 → 2.5(AC1,3,4,5)+3.6(AC1,4,5,6)+3.7(AC2,3)
  - F7-AC1~6 → 3.8(AC1~5), 2.6(AC4,6)
  - F8-AC1~6 → 3.9(AC1,2,3,4,6), **2.8(AC5 — 공유)**
  - F9-AC1~6 → 2.4(AC1,5,6), 3.10(AC2,3,4)
  - AC-G1→4.1, G2/G4/G5/G6/G7/G8→4.3(+2.8 G4 지원), G3/G12→2.7, G9→2.6, G10/G11→4.2
- **Uncovered**: 0 ✅

**PRD 추적**: PRD Feature 1(SMS 파싱)→2.3/3.2 · Feature 2(대시보드)→3.1 · Feature 3(주간 리포트)→3.4 · Feature 4(벤치마크)→3.5 · **Feature 5(월간 진단·공유)→2.8+3.9** · 절약 챌린지→3.6/3.7 · 구독 감지→2.4/3.10 · 수익화(IAP/광고/프로모션)→3.8/3.4/3.1/2.6. 미추적 0.

---

**한 가지 확인 필요**: PRD/SPEC 문구는 "PDF"이나, 앱인토스 **외부 이동 금지** 가드레일상 외부 PDF 뷰어 이동이 불가하여 Task 2.8은 **앱 내 이미지 공유**로 구현했습니다. 진짜 PDF 파일 다운로드가 필수 요구사항이라면 (a) 클라이언트 PDF 생성(jsPDF 등, 번들 증가) + (b) 토스 파일 공유 API 지원 여부 확인이 별도 태스크로 필요합니다 — 필요 시 알려주세요.