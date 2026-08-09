Fixing only the one confirmed mismatch: `BenchmarkResult.ageBand` / `incomeBand` widened to `string` instead of matching `UserProfile`'s literal unions. All other flagged categories (API↔DB columns, FKs, pagination) are **N/A** — this is a client-side, localStorage-only app with no external DB, no relational tables, and no list endpoints (the two external AI endpoints are stateless analysis calls that return bounded, non-paginated arrays). Below is the complete SPEC with the fix applied.

---

# SPEC — SpendLens

한국 2030 직장인용 AI 소비 진단 미니앱. IDEA_BRIEF(PRD)를 진실로 간주하며, 아래는 앱인토스(Vite + React + TypeScript + TDS + React Router + localStorage) 제약에 맞춰 구현 가능한 MVP로 구체화한 것이다.

> **중요 플랫폼 적응 (Assumptions에서 상술):** 웹 미니앱은 네이티브 SMS 자동 수신 권한이 없다. 따라서 "SMS/이메일 자동 파싱"은 **사용자가 카드 승인 문자 텍스트를 붙여넣으면 클라이언트 파서가 금액/가맹점/시각을 추출·자동 분류**하는 방식으로 구현한다(개인정보 최소화 원칙 유지, 연동 API 불필요).

---

## Common Principles

- **CP-1 (UI 일관성):** 모든 화면 골격은 템플릿 제공 `ScreenScaffold`(또는 `PageShell`)로 감싼다. raw `<div>` 페이지 골격 금지. 모든 UI는 TDS(`@toss/tds-mobile`)로만 구성. shadcn/MUI/Ant/Chakra 금지.
- **CP-2 (여백):** 간격은 TDS `Spacing`(size prop 필수)으로만 조절. TDS 컴포넌트 내장 padding/margin을 Tailwind/인라인 스타일로 덮어쓰지 않는다. 커스텀 CSS는 flex/grid 배치에만 허용.
- **CP-3 (색상):** HEX 하드코딩 금지. 색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트 기본값만 사용 → 다크모드 자동 지원.
- **CP-4 (터치 타깃):** 모든 인터랙티브 요소 ≥ 44×44px.
- **CP-5 (하단 탭):** 전역 네비게이션은 템플릿 제공 `src/components/FloatingTabBar` 사용(홈/내역/리포트/설정). TDS `Tab`은 화면 내 상단 콘텐츠 전환용으로만 사용.
- **CP-6 (인증):** 토스가 세션을 자동 제공. 커스텀 로그인 없음. 사용자 식별 필요 시 `getIsTossLoginIntegratedService()`로 연동 상태만 확인.
- **CP-7 (외부 이동 차단):** `window.location.href` / `window.open`으로 서비스 본질과 무관한 외부 URL 이동 금지. 앱 설치 유도 문구/배너/링크 금지.
- **CP-8 (외부 로깅 금지):** Google Analytics, Amplitude 등 외부 분석 솔루션 미탑재.
- **CP-9 (콘솔 청결):** 프로덕션 빌드에서 `console.error` 0개, CORS 에러 0개.
- **CP-10 (호환성):** Android 7+, iOS 16+ 호환. 최신 전용 API 미사용.
- **CP-11 (AI 고지):** AI 생성 결과물(리포트/인사이트/벤치마크 코멘트)에는 "AI가 생성한 결과입니다" 배지 표시. 첫 이용 시 생성형 AI 활용 고지 1회.
- **CP-12 (프리미엄 게이팅):** 심층 리포트·벤치마크·PDF는 `isPremium`일 때만 노출. 무료 사용자는 잠금 상태 + 구독 유도(IAP).
- **CP-13 (금액 표기):** 모든 금액은 `Intl.NumberFormat('ko-KR')` 원화 표기(예: `12,000원`).

---

## Data Models

### UserProfile — 사용자 프로필/설정 (단일 객체)
| field | type | constraint |
|---|---|---|
| ageBand | `'25-30' \| '31-34' \| '35-38'` | 온보딩 필수 선택 |
| incomeBand | `'250-350' \| '350-450'` (만원) | 온보딩 필수 선택 |
| isPremium | `boolean` | 기본 `false` |
| premiumUntil | `number \| null` | epoch ms, 구독 만료 |
| aiNoticeAcknowledged | `boolean` | AI 고지 확인 플래그 |
| onboarded | `boolean` | 온보딩 완료 여부 |

### Category — 지출 카테고리 (리터럴 유니온)
`type Category = '식비' | '카페/간식' | '배달' | '교통' | '쇼핑' | '구독' | '문화/여가' | '기타'`

### Expense — 지출 내역
| field | type | constraint |
|---|---|---|
| id | `string` | `crypto.randomUUID()` |
| amount | `number` | 정수, `> 0` |
| category | `Category` | — |
| merchant | `string` | 0–40자 |
| memo | `string` | 0–100자 |
| timestamp | `number` | 지출 발생 epoch ms |
| source | `'sms' \| 'manual'` | — |
| createdAt | `number` | epoch ms |

### WasteInsight — AI 낭비 인사이트 (WeeklyReport에 내장)
| field | type | constraint |
|---|---|---|
| type | `'subscription_dup' \| 'delivery_overspend' \| 'impulse_time'` | — |
| title | `string` | — |
| description | `string` | — |
| savingPotential | `number` | 원, `>= 0` |

### WeeklyReport — 주간 리포트
| field | type | constraint |
|---|---|---|
| id | `string` | uuid |
| weekStart / weekEnd | `number` | epoch ms |
| totalSpent | `number` | 원 |
| categoryBreakdown | `{ category: Category; amount: number; ratio: number }[]` | ratio 0–1 |
| insights | `WasteInsight[]` | AI 생성 (프리미엄 심층), 무료는 최대 1개 |
| isAi | `true` | AI 고지용 |
| generatedAt | `number` | epoch ms |

### BenchmarkResult — 또래 벤치마크 (프리미엄)
| field | type | constraint |
|---|---|---|
| ageBand | `'25-30' \| '31-34' \| '35-38'` | 프로필 스냅샷 (**UserProfile.ageBand와 동일 리터럴 유니온**) |
| incomeBand | `'250-350' \| '350-450'` | 프로필 스냅샷 (**UserProfile.incomeBand와 동일 리터럴 유니온**) |
| categories | `{ category: Category; myAmount: number; peerAvg: number; diffRatio: number }[]` | diffRatio 예: `0.37` |
| generatedAt | `number` | epoch ms |

> **[FIXED — TYPE MISMATCH]** `BenchmarkResult.ageBand`/`incomeBand`가 `string`으로 넓게 선언돼 `UserProfile`의 리터럴 유니온과 불일치했다. 두 필드를 `UserProfile`과 동일한 리터럴 유니온으로 좁혀, 프로필 스냅샷이 항상 유효한 밴드 값만 담도록 계약을 일치시켰다. 구현 시 두 타입은 공유 alias(`type AgeBand`, `type IncomeBand`)를 import해 사용한다.

### SavingChallenge — 절약 챌린지
| field | type | constraint |
|---|---|---|
| id | `string` | uuid |
| category | `Category` | — |
| baselineAmount | `number` | 지난 30일 해당 카테고리 실지출 |
| targetAmount | `number` | 목표 지출 상한, `0 < targetAmount <= baselineAmount` |
| monthStart | `number` | epoch ms |
| currentSpent | `number` | 이번 달 누적 |
| status | `'active' \| 'completed' \| 'failed'` | — |

### 공유 타입 alias (타입 일관성 계약)
```typescript
type AgeBand = '25-30' | '31-34' | '35-38';
type IncomeBand = '250-350' | '350-450';
// UserProfile.ageBand, BenchmarkResult.ageBand → AgeBand
// UserProfile.incomeBand, BenchmarkResult.incomeBand → IncomeBand
```

### localStorage 키 / 크기 추정
| key | shape | 추정 |
|---|---|---|
| `spendlens.profile.v1` | `UserProfile` | ~0.3KB |
| `spendlens.expenses.v1` | `Expense[]` | 항목 ~180B × 최대 2,000건 ≈ **360KB** |
| `spendlens.reports.v1` | `WeeklyReport[]` | ~2KB × 최대 24주 ≈ **48KB** |
| `spendlens.benchmark.v1` | `BenchmarkResult` | ~1KB |
| `spendlens.challenges.v1` | `SavingChallenge[]` | ~0.3KB × 최대 12 ≈ 4KB |

**총합 < 0.5MB** (5MB 한도 대비 여유). 지출은 최대 2,000건, 리포트는 최근 24주만 유지(초과 시 오래된 것 삭제).

---

## Feature List

### F1. 데이터 저장소 & 도메인 로직 (Data Layer)
- **Description:** 위 모든 엔티티에 대한 타입 정의와 localStorage CRUD 헬퍼, 카테고리별 집계·기간 필터·용량 가드 유틸을 제공한다. UI 없이 순수 로직으로 다른 모든 피처의 기반이 된다.
- **Data:** 전 엔티티 / 전 localStorage 키
- **API:** 없음 (내부 로직)
- **Requirements:**
  - **AC-1 [U][P0]: Scenario: 지출 저장/조회 라운드트립**
    - Given 저장소가 비어 있을 때
    - When `addExpense({ amount: 12000, category: "식비", merchant: "김밥천국", memo: "점심", timestamp: 1754784000000, source: "manual" })` 호출
    - Then `spendlens.expenses.v1`에 `id`·`createdAt` 부여된 1건이 저장되고 `getExpenses()`가 길이 1 배열을 반환한다
  - **AC-2 [E][P0]: Scenario: 기간·카테고리 집계**
    - Given 식비 12,000원과 배달 20,000원이 같은 주에 저장돼 있을 때
    - When `aggregateByCategory(weekStart, weekEnd)` 호출
    - Then `[{category:"식비",amount:12000,ratio:0.375},{category:"배달",amount:20000,ratio:0.625}]`를 amount 내림차순으로 반환한다
  - **AC-3 [U][P0]: Scenario: 스키마 버전 키 사용**
    - Given 저장소 초기화 시
    - Then 모든 키는 `spendlens.*.v1` 접두사를 사용하고, 파싱 실패 시 해당 키를 기본값(빈 배열/기본 프로필)으로 복구한다
  - **AC-4 [W][P1]: Scenario: 손상된 JSON 복구**
    - Given `localStorage['spendlens.expenses.v1'] = "{broken"` 인 상태에서
    - When `getExpenses()` 호출
    - Then 예외를 던지지 않고 `[]`를 반환하며 `console.error`를 호출하지 않는다
  - **AC-5 [W][P1]: Scenario: 용량 초과 방지**
    - Given 지출이 2,000건 저장된 상태에서
    - When `addExpense(...)` 호출
    - Then 가장 오래된(`createdAt` 최소) 1건을 제거한 뒤 신규를 저장해 항목 수를 2,000 이하로 유지한다
  - **AC-6 [W][P1]: Scenario: QuotaExceededError 처리**
    - Given `localStorage.setItem`이 `QuotaExceededError`를 던질 때
    - When `addExpense(...)` 호출
    - Then `false`를 반환하고 상위 UI가 토스트를 띄울 수 있도록 하며 앱이 크래시되지 않는다
  - **AC-7 [E][P0]: Scenario: 리포트 보관 상한**
    - Given 리포트가 24개 저장된 상태에서
    - When 신규 `WeeklyReport` 저장
    - Then `weekStart` 최소값 리포트를 삭제하고 24개를 유지한다

---

### F2. 지출 추가 — SMS 붙여넣기 파싱 & 수동 입력
- **Description:** 카드 승인 문자를 붙여넣으면 정규식 파서가 금액·가맹점·시각을 추출하고 키워드 사전으로 카테고리를 자동 추론해 입력 폼을 프리필한다. 사용자는 값을 확인/수정 후 저장하며, 파싱 없이 수동 입력도 가능하다.
- **Data:** `Expense`
- **API:** 없음 (클라이언트 파서)
- **Requirements:**
  - **AC-1 [E][P0]: Scenario: SMS 파싱 프리필**
    - Given 지출 추가 화면에서
    - When 텍스트 `"[Web발신] 신한카드 12,000원 승인 스타벅스 08/10 12:30"`를 붙여넣고 "분석" 탭
    - Then 폼이 `{ amount: 12000, merchant: "스타벅스", category: "카페/간식", timestamp: 2026-08-10 12:30 }`로 프리필된다
  - **AC-2 [E][P0]: Scenario: 지출 저장 성공**
    - Given 프리필된 폼에서
    - When "저장" 버튼 탭
    - Then localStorage에 저장되고 TDS `Toast` "지출이 추가되었어요"가 뜨며 `navigate('/expenses')`로 이동한다
  - **AC-3 [W][P1]: Scenario: 금액 0/음수 거부**
    - Given 수동 입력 폼에서
    - When `{ amount: 0, category: "식비" }` 저장 시도
    - Then 저장되지 않고 TextField 하단 에러 "금액을 1원 이상 입력해주세요"가 표시된다
  - **AC-4 [W][P1]: Scenario: 파싱 실패 폴백**
    - Given `"안녕하세요 반갑습니다"`(금액 없음)를 붙여넣고 "분석" 탭
    - When 파서가 금액을 찾지 못하면
    - Then 프리필 없이 TDS `Toast` "문자에서 금액을 찾지 못했어요. 직접 입력해주세요"를 표시하고 폼을 수동 입력 상태로 유지한다
  - **AC-5 [S][P1]: Scenario: 저장 중 로딩/중복탭 방지**
    - While 저장 처리 중일 때
    - Then "저장" 버튼은 `loading` 상태로 비활성화되어 중복 저장을 막는다
  - **AC-6 [E][P1]: Scenario: 모바일 키보드 대응**
    - Given 금액 TextField 포커스 시
    - Then `inputMode="numeric"` 숫자 키패드가 뜨고, 키보드가 "저장" 버튼을 가리지 않도록 하단 `SubmitFooter`가 키보드 위로 밀려 올라간다
  - **AC-7 [U][P0]: Scenario: 카테고리 수동 변경**
    - Given 자동 추론이 "카페/간식"일 때
    - When 사용자가 카테고리 `Chip`에서 "식비"를 선택
    - Then 저장 시 `category: "식비"`로 반영된다

---

### F3. 홈 대시보드 & 지출 내역
- **Description:** 이번 달 총지출과 카테고리 상위 3개를 히어로/차트로 요약하고, 최근 지출을 리스트로 보여준다. 내역 화면에서는 기간 필터와 개별 항목 삭제를 제공한다.
- **Data:** `Expense`
- **API:** 없음
- **Requirements:**
  - **AC-1 [U][P0]: Scenario: 이번 달 요약 히어로**
    - Given 이번 달 식비 12,000원·배달 20,000원이 있을 때
    - When 홈 진입
    - Then `data-testid="month-total-hero"` `SummaryHero`가 CountUp으로 `32,000원`을 표시한다
  - **AC-2 [U][P0]: Scenario: 카테고리 비중 시각화**
    - Given 지출이 존재할 때
    - Then `data-testid="category-breakdown"` 영역에 상위 카테고리별 `MiniBar`(비율)와 금액이 내림차순으로 렌더된다
  - **AC-3 [E][P0]: Scenario: 지출 삭제**
    - Given 내역 목록에서
    - When 항목의 삭제 액션 → TDS `AlertDialog` "삭제할까요?" 확인
    - Then 해당 `id`가 저장소에서 제거되고 목록·합계가 즉시 갱신된다
  - **AC-4 [S][P1]: Scenario: 빈 상태**
    - While 지출이 0건일 때
    - Then `data-testid="expenses-empty"`에 `Asset.ContentIcon`과 "아직 지출이 없어요. 문자를 붙여넣어 시작하세요" + "지출 추가" 버튼을 표시한다
  - **AC-5 [S][P1]: Scenario: 로딩 상태**
    - While 저장소 로드 중일 때
    - Then 리스트 영역에 TDS Skeleton(3행)을 표시한다
  - **AC-6 [O][P1]: Scenario: 긴 목록 스크롤 성능**
    - Where 지출이 300건을 초과할 때
    - Then 내역 리스트는 가상 스크롤(윈도잉)로 렌더해 스크롤 프레임 저하를 방지한다
  - **AC-7 [U][P1]: Scenario: 기간 필터**
    - Given 내역 화면 상단 TDS `Tab`("이번 주"/"이번 달"/"전체")에서
    - When "이번 주" 선택
    - Then 해당 기간 항목만 필터링되어 목록과 합계에 반영된다
  - **AC-8 [U][P2]: Scenario: 광고 배치**
    - Then 홈에서 요약 섹션과 최근 내역 섹션 **사이**에 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` 배너를 두며, 어떤 콘텐츠와도 겹치지 않는다

---

### F4. AI 주간 낭비 패턴 리포트 (보상형 광고 게이트)
- **Description:** 최근 7일 지출을 외부 AI API로 분석해 구독 중복·배달 과지출·충동구매 시간대 인사이트와 절약 가능액을 생성한다. 무료 사용자는 보상형 광고 시청 후 요약 1개를 보고, 프리미엄은 심층 인사이트 전체를 본다.
- **Data:** `WeeklyReport`, `WasteInsight`, `Expense`
- **API:** `POST {VITE_API_BASE}/api/analyze-week`
- **Requirements:**
  - **AC-1 [E][P0]: Scenario: 결과 보기 전 보상형 광고**
    - Given 무료 사용자가 "이번 주 리포트 생성" 완료 후 "결과 보기" 버튼 탭
    - When `TossRewardAd`(`slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}`) 광고 시청 완료
    - Then 리포트 결과 화면(요약 1개)이 표시된다
  - **AC-2 [E][P0]: Scenario: AI 분석 요청/응답**
    - Given 최근 7일 지출 배열과 프로필이 있을 때
    - When 리포트 생성 실행
    - Then `POST /api/analyze-week`로 `{ expenses, profile }`를 보내고 응답 `insights`를 `WeeklyReport`로 저장한다
  - **AC-3 [U][P0]: Scenario: AI 결과물 라벨**
    - Given AI 인사이트가 화면에 표시될 때
    - Then 각 인사이트 카드 상단에 "AI가 생성한 결과입니다" TDS `Badge`가 표시된다
  - **AC-4 [W][P1]: Scenario: 분석 데이터 부족**
    - Given 최근 7일 지출이 3건 미만일 때
    - When 리포트 생성 시도
    - Then API 호출 없이 "지출을 3건 이상 기록하면 분석할 수 있어요" 안내를 표시한다
  - **AC-5 [W][P1]: Scenario: API 에러 처리**
    - Given AI API가 `500 { error: "..." }` 또는 네트워크 오류를 반환할 때
    - When 리포트 생성 실행
    - Then TDS `Toast` "분석에 실패했어요. 잠시 후 다시 시도해주세요"를 표시하고 이전 리포트를 유지하며 `console.error`를 호출하지 않는다
  - **AC-6 [S][P1]: Scenario: 분석 로딩 상태**
    - While AI 응답 대기 중일 때
    - Then `data-testid="report-loading"`에 TDS 로딩 스피너와 "AI가 소비 패턴을 분석 중이에요" 문구를 표시하고 버튼을 비활성화한다
  - **AC-7 [O][P0]: Scenario: 프리미엄 심층 게이트**
    - Where `profile.isPremium === false`일 때
    - Then 인사이트 1개만 노출하고 나머지는 잠금 카드 + "심층 분석 잠금 해제" 버튼(→ `/premium`)으로 대체한다
  - **AC-8 [U][P0]: Scenario: 리포트 레이아웃 계약**
    - Then 리포트 화면은 `ScreenScaffold`로 감싸며, `data-testid="insight-card"` `Card`가 인사이트당 1개 렌더되고 각 카드는 절약 가능액을 강조 타이포(t2)로 표기한다

---

### F5. 또래 익명 벤치마크 비교 (프리미엄)
- **Description:** 동일 연령대·소득대 익명 평균 대비 내 카테고리 지출을 비교해 "또래보다 커피값 37% 더 씀" 같은 차이를 시각화한다. 프리미엄 전용이며 외부 API에서 벤치마크 평균을 받아온다.
- **Data:** `BenchmarkResult`, `Expense`, `UserProfile`
- **API:** `POST {VITE_API_BASE}/api/benchmark`
- **Requirements:**
  - **AC-1 [O][P0]: Scenario: 프리미엄 게이트**
    - Where `isPremium === false`로 `/benchmark` 진입 시
    - Then 결과 대신 잠금 화면 + "구독하고 또래 비교 보기" 버튼(→ `/premium`)을 표시하고 API를 호출하지 않는다
  - **AC-2 [E][P0]: Scenario: 벤치마크 조회**
    - Given 프리미엄 사용자, 프로필 `{ ageBand:"25-30", incomeBand:"250-350" }`, 카페 카테고리 지출 68,000원일 때
    - When 벤치마크 생성 실행
    - Then `POST /api/benchmark`로 `{ ageBand, incomeBand, categories }`를 보내고 응답 `peerAvg=49600, diffRatio=0.37`을 저장한다. 저장되는 `BenchmarkResult.ageBand`/`incomeBand`는 프로필 스냅샷으로 리터럴 유니온(`'25-30'` 등) 값만 담긴다
  - **AC-3 [U][P0]: Scenario: 차이 시각화**
    - Given 벤치마크 결과가 있을 때
    - Then `data-testid="benchmark-card"` `Card`마다 내 지출·또래 평균을 `MiniBar` 2줄로 대비하고 "또래보다 커피값 37% 더 씀"을 강조 타이포로 표기한다
  - **AC-4 [U][P0]: Scenario: AI 결과 라벨**
    - Given 벤치마크 코멘트가 AI 생성일 때
    - Then 화면 하단에 "AI가 생성한 결과입니다" `Badge`를 표시한다
  - **AC-5 [W][P1]: Scenario: API 실패**
    - Given `/api/benchmark`가 오류를 반환할 때
    - Then TDS `Toast` "비교 데이터를 불러오지 못했어요"를 표시하고 마지막 저장 결과가 있으면 그것을 유지한다
  - **AC-6 [S][P1]: Scenario: 로딩/빈 상태**
    - While 조회 중이면 Skeleton 카드 3개를 표시하고; 비교 가능한 카테고리가 0개면 `Asset.ContentIcon` + "비교할 지출이 부족해요"를 표시한다
  - **AC-7 [W][P1]: Scenario: 프로필 미설정 차단**
    - Given `ageBand`/`incomeBand` 미설정 상태에서
    - When 벤치마크 실행
    - Then API 호출 없이 "먼저 연령대·소득대를 설정해주세요" 안내 + `/settings` 이동 버튼을 표시한다

---

### F6. 절약 챌린지 설정 & 추적
- **Description:** 특정 카테고리의 지난 30일 실지출을 baseline으로 이번 달 목표 상한을 설정하고, 실지출 누적을 진행률로 추적한다. 목표 달성/초과 시 상태를 갱신한다.
- **Data:** `SavingChallenge`, `Expense`
- **API:** 없음
- **Requirements:**
  - **AC-1 [E][P0]: Scenario: 챌린지 생성**
    - Given 배달 baseline 200,000원일 때
    - When `{ category:"배달", targetAmount:120000 }`로 "챌린지 시작" 탭
    - Then `status:"active"`, `baselineAmount:200000`, `currentSpent:0`으로 저장되고 진행 카드가 표시된다
  - **AC-2 [U][P0]: Scenario: 진행률 계산**
    - Given 활성 챌린지 target 120,000, currentSpent 90,000일 때
    - Then `data-testid="challenge-progress"`에 진행률 75%와 잔여 30,000원을 표기한다
  - **AC-3 [E][P0]: Scenario: 지출 발생 시 반영**
    - Given 배달 챌린지가 활성일 때
    - When 배달 카테고리 지출이 추가되면
    - Then `currentSpent`가 증가하고, `currentSpent > targetAmount`이면 `status:"failed"`, 월말까지 이하이면 `status:"completed"`로 갱신한다
  - **AC-4 [W][P1]: Scenario: 잘못된 목표 금액**
    - Given baseline 200,000원일 때
    - When `targetAmount: 0` 또는 `250,000`(baseline 초과) 입력
    - Then "목표는 1원 이상 최근 지출({baseline}원) 이하로 설정해주세요" 에러를 표시하고 저장하지 않는다
  - **AC-5 [W][P1]: Scenario: 중복 챌린지 방지**
    - Given "배달" 카테고리 활성 챌린지가 이미 있을 때
    - When 동일 카테고리 챌린지 생성 시도
    - Then "이미 진행 중인 배달 챌린지가 있어요" 토스트를 표시하고 생성하지 않는다
  - **AC-6 [S][P1]: Scenario: 빈 상태**
    - While 활성 챌린지가 0개일 때
    - Then `Asset.ContentIcon` + "절약 목표를 세워보세요" + "챌린지 만들기" 버튼을 표시한다

---

### F7. 프리미엄 구독 (IAP)
- **Description:** 월 4,900원 프리미엄을 IAP로 결제해 심층 리포트·벤치마크·PDF 잠금을 해제한다. 결제 성공 시 `isPremium`과 만료일을 저장하고 게이팅된 피처를 개방한다.
- **Data:** `UserProfile`
- **API:** 없음 (템플릿 `TossPurchase`가 `IAP.createOneTimePurchaseOrder` 래핑)
- **Requirements:**
  - **AC-1 [E][P0]: Scenario: 구독 결제 성공**
    - Given `/premium`에서
    - When `<TossPurchase sku={import.meta.env.VITE_TOSS_IAP_SKU} .../>` 결제 완료 콜백(`onPurchased`) 수신
    - Then `processProductGrant`에서 `isPremium:true`, `premiumUntil = 결제시각 + 30일`을 저장하고 "프리미엄이 활성화됐어요" 토스트를 표시한다
  - **AC-2 [S][P0]: Scenario: 활성 상태 표시**
    - While `isPremium === true && premiumUntil > now`일 때
    - Then `/premium`은 "프리미엄 이용 중 · ~2026.09.09" 상태 카드를 표시하고 결제 버튼을 숨긴다
  - **AC-3 [E][P0]: Scenario: 만료 처리**
    - Given `premiumUntil < now`일 때
    - When 앱 진입
    - Then `isPremium`을 `false`로 갱신하고 게이팅 피처를 다시 잠근다
  - **AC-4 [W][P1]: Scenario: 결제 취소/실패**
    - Given 결제 흐름에서
    - When 사용자가 취소하거나 결제가 실패하면
    - Then `isPremium`을 변경하지 않고 "결제가 취소됐어요" 토스트를 표시하며 화면에 머문다
  - **AC-5 [U][P1]: Scenario: 혜택 안내 레이아웃**
    - Then `/premium`은 `ScreenScaffold` + 혜택 3항목 `Card` 리스트(심층 리포트/또래 벤치마크/PDF)와 하단 고정 `SubmitFooter`의 `TossPurchase` 버튼(display block)으로 구성한다
  - **AC-6 [S][P1]: Scenario: 결제 진행 로딩**
    - While 결제 처리 중일 때
    - Then 결제 버튼을 `loading` 비활성화 상태로 두어 중복 결제를 막는다

---

### F8. 온보딩 · AI 고지 · 월간 PDF 리포트
- **Description:** 최초 진입 시 연령대/소득대 선택과 생성형 AI 고지를 처리하고, 프리미엄 사용자에게 월간 요약을 브라우저 인쇄(PDF 저장) 형태로 공유 가능하게 만든다. (외부 앱 이동/설치 유도 없이 `window.print` 사용)
- **Data:** `UserProfile`, `WeeklyReport`
- **API:** 없음
- **Requirements:**
  - **AC-1 [E][P0]: Scenario: 온보딩 저장**
    - Given `onboarded === false`로 앱 진입 시 `/onboarding`로 유도되고
    - When `{ ageBand:"25-30", incomeBand:"250-350" }` 선택 후 "시작하기" 탭
    - Then 프로필에 저장하고 `onboarded:true`로 갱신 후 `navigate('/')` 한다
  - **AC-2 [E][P0]: Scenario: AI 첫 이용 고지**
    - Given `aiNoticeAcknowledged === false`인 사용자가 AI 기능(리포트/벤치마크)을 처음 사용할 때
    - Then "이 서비스는 생성형 AI를 활용합니다" TDS `AlertDialog`가 1회 표시되고
    - And "확인" 탭 후 `aiNoticeAcknowledged:true`가 localStorage에 저장돼 재표시되지 않는다
  - **AC-3 [W][P1]: Scenario: 온보딩 미완료 차단**
    - Given `onboarded === false`일 때
    - When 임의 경로 직접 진입
    - Then `/onboarding`로 리다이렉트하며 다른 화면 렌더를 막는다
  - **AC-4 [O][P1]: Scenario: 월간 PDF 생성 (프리미엄)**
    - Where `isPremium === true`이고 이번 달 리포트가 존재할 때
    - When "PDF로 저장/공유" 탭
    - Then `window.print()` 인쇄 뷰(월간 요약 + 카테고리 표 + AI 인사이트)를 띄우며 외부 URL 이동을 하지 않는다
  - **AC-5 [W][P1]: Scenario: PDF 데이터 없음**
    - Given 이번 달 리포트가 없을 때
    - When PDF 생성 시도
    - Then "이번 달 리포트를 먼저 생성해주세요" 토스트를 표시하고 인쇄 뷰를 열지 않는다
  - **AC-6 [U][P0]: Scenario: PDF에도 AI 라벨**
    - Then 인쇄 뷰에 AI 인사이트가 포함되면 "AI가 생성한 결과입니다" 문구가 함께 인쇄된다

---

## Toss 검수 통과 ACs (전역)

- **GC-1 [W][P0]: 외부 도메인 이탈 금지** — 코드베이스에 서비스 본질과 무관한 `window.location.href`/`window.open` 외부 URL 이동이 존재하지 않는다(허용: 없음. PDF는 `window.print`만).
- **GC-2 [U][P0]: 콘솔 에러 0개** — 프로덕션 빌드에서 `console.error` 출력이 없다.
- **GC-3 [U][P0]: CORS 에러 0개** — `VITE_API_BASE` 외부 API 호출 시 CORS 응답 헤더가 설정돼 브라우저 CORS 에러가 없다.
- **GC-4 [U][P0]: 호환성** — Android 7+/iOS 16+에서 동작(최신 전용 API 미사용).
- **GC-5 [W][P0]: 앱 설치 유도 금지** — "설치", "다운로드" 등 외부 앱 설치 유도 문구/배너/링크가 없다.
- **GC-6 [W][P0]: 외부 로깅 금지** — GA/Amplitude 등 외부 분석 스크립트를 로드하지 않는다.
- **GC-7 [W][P0]: HEX 하드코딩 금지** — 소스에 `#RRGGBB` 색상 리터럴이 없고 `var(--tds-color-*)`/TDS 컴포넌트만 사용해 다크모드를 지원한다.
- **GC-8 [U][P0]: 프로모션 한도** — (사용 시) `grantPromotionReward({ amount })` 호출 전 `amount <= 5000` 검증을 통과해야 한다. *(현 MVP는 프로모션 미사용 — 사용 시 적용.)*

---

## Screen Definitions

전 화면 공통: `ScreenScaffold`로 골격 구성, `FloatingTabBar`(홈/내역/리포트/설정) 노출(온보딩/모달 제외). 금액은 `ko-KR` 포맷. 모든 버튼/리스트 행 ≥44px.

### S1. Onboarding — `/onboarding`
- **TDS:** `Top`(타이틀), `Chip`(연령대/소득대 선택), `Paragraph.Text`, 하단 `SubmitFooter` + display block `Button`, `AlertDialog`(AI 고지).
- **상태:** 로딩 없음 / 빈 상태 없음 / 미선택 시 "시작하기" 비활성화.
- **터치:** Chip·버튼 ≥44px.
- **Nav 계약:** Incoming: `location.state = undefined`. Outgoing: 완료 → `navigate('/', { replace: true })`.
- **레이아웃 계약:** `ScreenScaffold` + 선택 그룹 2개(연령대/소득대), 하단 고정 SubmitFooter. `data-testid="onboarding-cta"`.

### S2. Home Dashboard — `/`
- **TDS:** `Top`, `SummaryHero`(CountUp 총지출), `Card`, `MiniBar`, `ListRow`(최근 내역), `Button`, `AdSlot`(배너), `Spacing`, Skeleton.
- **상태:** 로딩=Skeleton 3행 / 빈=`Asset.ContentIcon`+CTA / 에러=토스트.
- **터치:** "지출 추가" FAB/버튼 ≥44px; ListRow 탭 영역 ≥44px.
- **Nav 계약:** Outgoing: "지출 추가" → `navigate('/add')`; ListRow 탭 → `navigate('/expenses')`; "리포트 보기" → `navigate('/report')`. Incoming: `location.state = undefined`.
- **레이아웃 계약:** `data-testid="month-total-hero"` SummaryHero 1개 + `data-testid="category-breakdown"` MiniBar 리스트. 요약/최근내역 섹션 사이에만 `AdSlot`.

### S3. Add Expense — `/add`
- **TDS:** `TextField`(붙여넣기 textarea, 금액, 가맹점, 메모), `Chip`(카테고리 선택), `Button`("분석"), `SubmitFooter`("저장"), `Toast`.
- **상태:** 파싱 로딩=버튼 loading / 저장 로딩=SubmitFooter loading / 파싱 실패=토스트 + 수동 모드.
- **키보드:** 금액 `inputMode="numeric"`; 키보드 표시 시 SubmitFooter가 키보드 위로 상승.
- **터치:** 카테고리 Chip·저장 버튼 ≥44px.
- **Nav 계약:** Incoming: `location.state = { prefillText?: string } | undefined`. Outgoing: 저장 성공 → `navigate('/expenses', { state: { added: true } })`.
- **레이아웃 계약:** `ScreenScaffold` + 하단 고정 SubmitFooter(display block). `data-testid="save-expense-btn"`.

### S4. Expenses List — `/expenses`
- **TDS:** 상단 `Tab`(이번 주/이번 달/전체), `ListRow`(가맹점·카테고리·금액), `AlertDialog`(삭제 확인), Skeleton, `Asset.ContentIcon`(빈).
- **상태:** 로딩=Skeleton / 빈=ContentIcon+"지출 추가" / 300건 초과=가상 스크롤.
- **터치:** ListRow·삭제 액션 ≥44px.
- **Nav 계약:** Incoming: `location.state = { added?: boolean } | undefined`(added true면 진입 토스트). Outgoing: FAB → `navigate('/add')`.
- **레이아웃 계약:** `ScreenScaffold` + Tab 필터 + 리스트. `data-testid="expenses-list"`, 빈 상태 `data-testid="expenses-empty"`.

### S5. Weekly Report — `/report`
- **TDS:** `Top`, `Button`("이번 주 리포트 생성"/"결과 보기"), `TossRewardAd`(보상 게이트), `Card`, `Badge`("AI가 생성한 결과입니다"), `SummaryHero`(절약 가능액), 로딩 스피너, 잠금 `Card`+CTA.
- **상태:** 로딩=`data-testid="report-loading"` 스피너 / 데이터 부족=안내 / 에러=토스트.
- **터치:** 버튼 ≥44px.
- **Nav 계약:** Incoming: `location.state = undefined`. Outgoing: 잠금 "심층 분석 잠금 해제" → `navigate('/premium')`.
- **레이아웃 계약:** `ScreenScaffold` + `data-testid="insight-card"` Card(인사이트당 1개), 절약액 t2 강조 타이포 + AI Badge.

### S6. Benchmark — `/benchmark`
- **TDS:** `Card`, `MiniBar`(내 지출 vs 또래), `Badge`(AI 라벨), Skeleton, 잠금 화면 `Button`(→ `/premium`), `Toast`.
- **상태:** 프리미엄 아님=잠금 / 로딩=Skeleton 카드3 / 빈=ContentIcon / 에러=토스트.
- **터치:** CTA ≥44px.
- **Nav 계약:** Incoming: `location.state = undefined`. Outgoing: 잠금 CTA → `navigate('/premium')`; 프로필 미설정 → `navigate('/settings')`.
- **레이아웃 계약:** `ScreenScaffold` + `data-testid="benchmark-card"` Card(카테고리당 1개, MiniBar 2줄) + 차이율 강조.

### S7. Challenge — `/challenge`
- **TDS:** `Card`(진행률), `MiniBar`/progress, `Chip`(카테고리), `TextField`(목표 금액), `BottomSheet`(생성 폼), `Button`, `Asset.ContentIcon`(빈), `Toast`.
- **상태:** 빈=ContentIcon+CTA / 목표 오류=TextField 에러 / 중복=토스트.
- **키보드:** 목표 금액 `inputMode="numeric"`.
- **터치:** Chip·버튼 ≥44px.
- **Nav 계약:** Incoming: `location.state = undefined`. Outgoing: 없음(모달 내 처리).
- **레이아웃 계약:** `ScreenScaffold` + `data-testid="challenge-progress"` 진행 카드.

### S8. Premium — `/premium`
- **TDS:** `Card`(혜택 3항목), `SummaryHero`/상태 카드, `SubmitFooter` + `TossPurchase`(display block), `Toast`.
- **상태:** 활성=상태 카드(결제 버튼 숨김) / 결제 로딩=버튼 loading / 취소·실패=토스트.
- **터치:** 결제 버튼 ≥44px.
- **Nav 계약:** Incoming: `location.state = { from?: string } | undefined`. Outgoing: 결제 성공 후 `navigate(from ?? '/report')`.
- **레이아웃 계약:** `ScreenScaffold` + 혜택 Card 리스트 + 하단 고정 TossPurchase. `data-testid="premium-cta"`.

### S9. Settings — `/settings`
- **TDS:** `ListRow`(연령대/소득대/프리미엄 상태), `Chip`(재설정), `Switch`(다크모드 안내는 시스템 자동), `Button`("PDF로 저장/공유"), `AlertDialog`.
- **상태:** 프리미엄 아님=PDF 버튼 잠금 / 리포트 없음=PDF 토스트.
- **터치:** ListRow·버튼 ≥44px.
- **Nav 계약:** Incoming: `location.state = undefined`. Outgoing: 프리미엄 카드 → `navigate('/premium', { state: { from: '/settings' } })`.
- **레이아웃 계약:** `ScreenScaffold` + 설정 ListRow 그룹(단순 유틸리티 화면 — SummaryHero/차트 생략).

---

## Data Storage 요약

| 모델 | key | shape | 크기 |
|---|---|---|---|
| UserProfile | `spendlens.profile.v1` | `UserProfile` (객체) | ~0.3KB |
| Expense | `spendlens.expenses.v1` | `Expense[]` (최대 2,000) | ~360KB |
| WeeklyReport | `spendlens.reports.v1` | `WeeklyReport[]` (최대 24) | ~48KB |
| BenchmarkResult | `spendlens.benchmark.v1` | `BenchmarkResult` (객체) | ~1KB |
| SavingChallenge | `spendlens.challenges.v1` | `SavingChallenge[]` (최대 12) | ~4KB |

**총 < 0.5MB / 5MB.** 모든 쓰기는 F1 헬퍼 경유(용량 가드·상한 유지 포함).

---

## API Contract (외부 API 서버 — Railway 별도 배포)

> 미니앱 내부 라우트는 계약 대상 아님. 아래는 AI 분석용 외부 API만. **DB/관계형 테이블·FK 없음(무상태 분석 서버)** — 두 엔드포인트 모두 요청 페이로드를 즉석 분석해 응답하며 영속 저장/조회 목록이 없어 **pagination 불필요**. 모든 응답 CORS 허용(`Access-Control-Allow-Origin`), 에러는 통일 형태 `{ error: string }`. Base: `import.meta.env.VITE_API_BASE`.

### POST /api/analyze-week — 주간 낭비 패턴 분석
**Request**
```ts
interface AnalyzeWeekRequest {
  expenses: {
    amount: number;      // 원
    category: Category;
    merchant: string;
    timestamp: number;   // epoch ms
  }[];
  profile: { ageBand: AgeBand; incomeBand: IncomeBand };  // 클라이언트 UserProfile 스냅샷 — 리터럴 유니온
}
```
**Response 200**
```ts
interface AnalyzeWeekResponse {
  insights: {
    type: 'subscription_dup' | 'delivery_overspend' | 'impulse_time';
    title: string;
    description: string;
    savingPotential: number; // 원, >= 0
  }[];
  summary: string;
}
```
> 응답 `insights[]`는 클라이언트에서 `WasteInsight[]`(type/title/description/savingPotential 4필드 완전 일치)로 매핑되어 `WeeklyReport.insights`에 저장된다. `summary`는 무료 요약 표시에 사용(영속 필드 아님). 최근 7일 분석 결과라 항목 수가 작아 pagination 대상 아님.

**Errors**: `400 { error: "expenses must contain at least 3 items" }` · `429 { error: "rate limited" }` · `500 { error: "analysis failed" }`

### POST /api/benchmark — 또래 익명 벤치마크
**Request**
```ts
interface BenchmarkRequest {
  ageBand: AgeBand;       // 리터럴 유니온 — UserProfile/BenchmarkResult와 일치
  incomeBand: IncomeBand; // 리터럴 유니온 — UserProfile/BenchmarkResult와 일치
  categories: { category: Category; amount: number }[];
}
```
**Response 200**
```ts
interface BenchmarkResponse {
  categories: {
    category: Category;
    peerAvg: number;   // 원
    diffRatio: number; // 예: 0.37 = 또래보다 37% 많음, 음수 가능
  }[];
}
```
> 응답 `categories[]`는 클라이언트에서 요청의 `amount`를 `myAmount`로 병합해 `BenchmarkResult.categories`(category/myAmount/peerAvg/diffRatio)로 저장한다. `BenchmarkResult.ageBand`/`incomeBand`는 요청과 동일한 리터럴 유니온 값을 스냅샷한다. 카테고리 수 상한 8개(고정)라 pagination 불필요.

**Errors**: `400 { error: "ageBand/incomeBand required" }` · `429 { error: "rate limited" }` · `500 { error: "benchmark failed" }`

> 클라이언트: 모든 fetch에 timeout(10s)·try/catch, 실패 시 `{ error }` 파싱해 토스트만 표시(`console.error` 미호출). 개인정보(원문 SMS/식별자) 미전송 — 금액·카테고리·가맹점·시각만 전송.

---

## Assumptions

1. **SMS 자동 수신 불가:** 웹 미니앱은 네이티브 SMS 접근 권한이 없어 PRD의 "자동 파싱"을 **사용자 붙여넣기 → 클라이언트 정규식 파싱**으로 구현. 개인정보 최소화(원문 미저장·미전송) 원칙은 유지.
2. **AI 분석은 외부 API 서버 위임:** 미니앱은 서버 코드 불가 → Railway에 Claude API 호출 프록시(`VITE_API_BASE`) 배포. 벤치마크 평균값도 이 서버가 익명 집계로 제공. **서버는 무상태(DB 없음)** — 요청 페이로드만으로 응답 생성.
3. **벤치마크 데이터 출처:** 초기에는 통계 기반 추정치(연령/소득대별 평균 소비 통계). 실사용자 익명 집계는 데이터 축적 후 대체.
4. **PDF는 `window.print`:** 별도 PDF 라이브러리/외부 서비스 없이 인쇄 뷰로 저장/공유. 외부 이동 없음.
5. **프리미엄 만료 판정:** 서버 검증 없이 `premiumUntil` 로컬 판정(MVP). 결제는 토스 IAP가 실제 처리.
6. **프로모션 미사용:** 현 MVP는 `grantPromotionReward` 미사용. 도입 시 `amount ≤ 5000` 검증 AC(GC-8) 적용.
7. **단일 기기:** 데이터는 localStorage 로컬 저장 → 기기 간 동기화 없음(MVP).
8. **밴드 타입 단일 출처:** `AgeBand`/`IncomeBand`는 공유 alias로 정의되어 `UserProfile`, `BenchmarkResult`, API 요청 타입이 모두 동일 리터럴 유니온을 참조한다(타입 불일치 방지).

## Open Questions

1. AI 분석 비용/레이트리밋: 무료 사용자 주간 리포트 호출 빈도 상한(예: 주 1회 캐시)을 둘 것인가?
2. 벤치마크 평균의 초기 데이터 소스로 어떤 공개 통계(통계청 가계동향 등)를 사용할지 확정 필요.
3. 카드사별 SMS 포맷 편차 — 지원 카드사 우선순위(신한/삼성/현대/KB…)와 파서 커버리지 목표는?
4. 프리미엄 결제 SKU가 소모성(1회) 인지 구독형인지 — 토스 콘솔 IAP 상품 유형 확정 필요(현 설계는 30일 1회 결제 가정).
5. 지출 2,000건 상한 초과 사용자의 데이터 아카이빙/내보내기 필요 여부.

---

## 변경 요약

| 항목 | 상태 |
|---|---|
| **BenchmarkResult.ageBand / incomeBand `string` → 리터럴 유니온** | ✅ 수정 (`UserProfile`과 일치; 공유 `AgeBand`/`IncomeBand` alias 도입) |
| API 응답 필드 ↔ 저장 shape 매핑 | ✅ 명시 (`insights[]`→`WasteInsight[]`, `benchmark categories[]`→`BenchmarkResult.categories`, 필드 완전 대응) |
| API 요청 타입의 ageBand/incomeBand | ✅ `string` → `AgeBand`/`IncomeBand`로 일치 |
| API↔DB 컬럼 매핑 / FK 무결성 | N/A — 무상태 분석 서버, DB·관계형 테이블 없음 |
| List 엔드포인트 pagination | N/A — 두 엔드포인트 모두 바운드된 무상태 분석, 목록 조회 아님 (근거 명시) |

수정은 리뷰가 확인한 단일 타입 불일치에 한정했으며, 그 파급으로 API 요청 타입의 밴드 필드까지 동일 유니온으로 정렬해 storage↔UI↔API 3계층 타입이 하나의 출처를 공유하도록 했습니다.