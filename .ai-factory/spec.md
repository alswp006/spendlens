Below is the complete fixed SPEC. All existing content is preserved; the five issues are addressed by (1) adding a dedicated subscription-detection feature/screen so every data model has ACs, (2) making audit fields uniform/documented across all entities, (3) adding derivation & cascade rules, (4) defining a `getTransactions({page,pageSize})` pagination contract with ACs in F1 and F3, and (5) documenting the AI endpoints as unauthenticated/stateless-by-design with no device/user identifier attached.

---

# SPEC — SpendLens

## Common Principles

- **플랫폼**: 앱인토스 (Vite + React + TypeScript), 모든 UI는 TDS(@toss/tds-mobile), 라우팅은 react-router-dom, 데이터 영속화는 localStorage.
- **인증**: 토스 세션 자동 제공 — 별도 로그인 함수 호출 없음. 사용자 식별 필요 시 `getIsTossLoginIntegratedService()`로 연동 상태 확인.
- **개인정보 최소화**: 카드사 연동 API를 사용하지 않음. 사용자가 **직접 붙여넣은 SMS/알림 텍스트**만 클라이언트에서 파싱 → 원문은 저장하지 않고 파싱 결과(카테고리/금액/일시)만 저장. 외부 AI 서버에는 **익명 집계값만** 전송하며, 기기·사용자 식별자(토스 userId, 광고 ID, 디바이스 ID, 세션 토큰)를 **어떤 요청에도 부착하지 않는다**(아래 API Contract의 무인증·무상태 설계 참조).
- **AI 고지 의무**: AI 기반 결과물(주간 리포트, 벤치마크 코멘트, 월간 진단)에는 "AI가 생성한 결과입니다" 배지 상시 표시. 첫 이용 시 "이 서비스는 생성형 AI를 활용합니다" 다이얼로그 1회 표시.
- **수익화**: freemium. 무료(기본 분류 + 주간 요약), 유료(월 4,900원 — 심층 패턴/벤치마크/PDF). 결제는 템플릿 `<TossPurchase>` (IAP).
- **광고**: 무료 사용자의 AI 리포트는 `<TossRewardAd>`로 게이트, 목록 하단에 `<AdSlot>` 배너.
- **색상**: HEX 하드코딩 금지 — `var(--tds-color-*)` 또는 TDS 컴포넌트만. 다크모드 지원.
- **외부 이동 금지**: `window.open`/`window.location.href` 외부 URL 이동 차단. 외부 분석 솔루션(GA, Amplitude) 미사용.
- **호환성**: Android 7+, iOS 16+. 프로덕션 빌드 console.error 0개.
- **금액 단위**: 원(KRW), 정수. 통화 표기 `Intl.NumberFormat('ko-KR')` (Android7/iOS16 지원 범위 내).

---

## Data Models

> **감사 필드(audit fields) 정책**: 모든 엔티티는 `id`/`createdAt`/`updatedAt`를 원칙적으로 보유한다. 예외는 각 엔티티 주석에 **의도적 생략 사유**를 명시한다(예: 싱글턴 설정 객체는 `id` 불필요, 불변 캐시는 `updatedAt` 생성=수정 동일). 모든 `*At`은 ISO 8601 문자열이다.

### Transaction — 지출 내역
```typescript
interface Transaction {
  id: string;              // crypto.randomUUID()
  amount: number;          // 원, 양의 정수. > 0
  category: Category;      // 아래 enum
  merchant: string;        // 가맹점명, 파싱 실패 시 "미분류"
  memo: string;            // 사용자 메모, 기본 ""
  spentAt: string;         // ISO 8601, 지출 일시
  source: 'sms' | 'manual';// 파싱 출처
  createdAt: string;       // ISO 8601, 기록 생성 시각
  updatedAt: string;       // ISO 8601, memo/category 등 수정 시각. 생성 시 createdAt과 동일
}

type Category =
  | '식비' | '카페' | '배달' | '쇼핑' | '구독'
  | '교통' | '문화' | '생활' | '의료' | '기타';
```

### SubscriptionItem — 감지된 구독
```typescript
interface SubscriptionItem {
  id: string;              // 파생 식별자: 아래 sourceTxIds 집합의 안정적 해시(동일 구독 재계산 시 동일 id 유지)
  name: string;            // 예: "넷플릭스"
  amount: number;          // 월 결제액, 원
  lastChargedAt: string;   // ISO 8601
  isDuplicateSuspect: boolean; // 유사 카테고리 중복 의심
  sourceTxIds: string[];   // 이 구독을 감지하는 데 사용된 Transaction.id 집합 (원천 링크/재계산 근거)
  createdAt: string;       // 최초 감지 시각
  updatedAt: string;       // 재계산으로 amount/lastChargedAt/isDuplicateSuspect 변경 시각
}
```

### WeeklyReport — AI 주간 리포트 (API 응답 캐시)
```typescript
interface WeeklyReport {
  id: string;
  weekStart: string;       // ISO 8601 (월요일)
  weekEnd: string;         // ISO 8601 (일요일)
  totalSpent: number;      // 원 (캐시 시점의 파생 스냅샷)
  topWasteCategory: Category;
  wasteAmount: number;     // AI 추정 낭비 금액, 원
  insights: string[];      // AI 생성 문장 배열, 최대 5개
  savingSuggestion: string;// AI 절약 제안 1문장
  generatedByAI: true;     // 항상 true (라벨 근거)
  createdAt: string;       // 생성/캐시 시각
  updatedAt: string;       // 불변 스냅샷 원칙: "다시 분석"으로 재생성 시에만 갱신. 그 외 생성=수정
}
```

### SavingChallenge — 절약 챌린지
```typescript
interface SavingChallenge {
  id: string;
  targetCategory: Category;
  targetAmount: number;    // 이번 달 목표 절감액, 원, > 0
  monthKey: string;        // "YYYY-MM"
  currentSaved: number;    // 파생 스냅샷: 읽기 시 Transaction에서 라이브 재계산되어 갱신됨 (아래 파생 규칙)
  status: 'active' | 'achieved' | 'failed';
  createdAt: string;
  updatedAt: string;       // currentSaved/status 재계산·전이 시각
}
```

### UserSettings — 설정/플래그
```typescript
interface UserSettings {
  // id 의도적 생략: `spendlens.settings` 키에 1개만 존재하는 싱글턴 객체 — 식별자 불필요
  isPremium: boolean;          // IAP 구매 여부
  aiNoticeAcknowledged: boolean; // AI 첫 고지 확인
  benchmarkAgeBand: '25-29' | '30-34' | '35-38';
  benchmarkIncomeBand: '250-350' | '350-450';
  createdAt: string;           // 최초 초기화 시각
  updatedAt: string;           // 플래그/기준 변경 시각
}
```

### 파생 & 캐스케이드 규칙 (Derivation & Cascade Rules)

Transaction은 유일한 **원천(source of truth)** 이며, 다른 엔티티는 이로부터 파생된다. 파생 엔티티는 저장된 외래키를 두지 않고, **읽기/뮤테이션 시 재계산**을 원칙으로 한다.

- **SavingChallenge.currentSaved / status**: 저장 FK 없음. 챌린지 상세/목록 **읽기 시** 해당 `monthKey`·`targetCategory`의 Transaction에서 라이브 재계산(`전월 동일 카테고리 합계 − 이번 달 합계`, 음수는 0)하고 `status`를 재판정한다. 근거 Transaction이 편집/삭제되면 다음 읽기에서 자동으로 값이 갱신되며 별도 캐스케이드 삭제는 없다(챌린지 레코드는 유지).
- **SubscriptionItem**: `sourceTxIds`가 이 구독을 감지한 Transaction 집합을 참조한다. `id`는 `sourceTxIds`의 안정적 해시로, **Transaction 뮤테이션(추가/수정/삭제)마다 전체 재감지**를 수행한다. 근거 거래가 모두 삭제되면 해당 SubscriptionItem은 재감지 결과에서 사라진다(자동 소멸). `isDuplicateSuspect`도 재감지 시 재판정된다.
- **WeeklyReport / 월간 진단**: 생성 시점의 **불변 스냅샷**(`totalSpent`, `topWasteCategory` 등). 이후 Transaction이 바뀌어도 캐시는 자동 변경되지 않으며, 사용자가 "다시 분석"을 명시적으로 실행할 때만 재요청→재캐시된다(불필요한 과금 방지).
- **getCategoryTotals / 홈 히어로 등 집계값**: 저장하지 않고 매 조회 시 Transaction에서 계산한다.
- **일관성 원칙**: 파생 엔티티는 Transaction을 참조하는 **저장 FK를 두지 않는다**(FK 무결성 관리 회피). 대신 위와 같이 "읽기/뮤테이션 시 재계산"으로 정합성을 유지한다.

### localStorage 키 및 크기 산정

| 키 | 값 shape | 예상 크기 |
|---|---|---|
| `spendlens.transactions` | `Transaction[]` | ~270B/건 × 1,500건 ≈ **405KB** (12개월 상한) |
| `spendlens.subscriptions` | `SubscriptionItem[]` | ~200B × 30 ≈ 6KB |
| `spendlens.reports` | `WeeklyReport[]` | ~820B × 12 ≈ 9.8KB (최근 12주) |
| `spendlens.challenges` | `SavingChallenge[]` | ~220B × 12 ≈ 2.6KB |
| `spendlens.settings` | `UserSettings` | ~220B |
| **합계** | | **< 0.45MB** (5MB 한도 내) |

- 트랜잭션은 최근 12개월/최대 1,500건만 유지, 초과 시 오래된 순 제거.

---

## API Contract (External — AI 분석 서버, 별도 Railway 배포)

> **무인증·무상태 설계 (Unauthenticated / stateless-by-design)**: 두 엔드포인트는 **인증 토큰·API 키·세션을 사용하지 않는다**. 서버는 요청 간 상태를 저장하지 않으며, 응답 생성 외 목적으로 요청 페이로드를 보존하지 않는다(로그는 익명 집계 지표만). 클라이언트는 **어떤 기기·사용자 식별자도 부착하지 않는다** — 토스 userId, 광고 ID, 디바이스 ID, 쿠키, `Authorization` 헤더, 커스텀 식별 헤더 모두 미전송. 전송 값은 익명 집계(연령대/소득대 밴드, 카테고리별 합계, 건수, 구독명/금액)에 한정된다. 이는 "개인정보 최소화" 원칙에 부합한다. 따라서 인증 실패 응답(`401 unauthorized`)은 **정의하지 않으며**, 개인 리소스 조회가 없으므로 `404`도 사용하지 않는다. CORS 허용 오리진에 앱인토스 도메인 등록.
>
> (향후 남용 방지가 필요할 경우, 사용자 식별과 무관한 **오리진 기반 레이트리밋**(`429 rate_limited`)만으로 대응하며 사용자 식별 토큰을 도입하지 않는다.)

### POST /api/v1/weekly-report — AI 주간 낭비 리포트 생성
```typescript
// Headers: Content-Type: application/json 만. Authorization/식별 헤더 없음.
// Request
interface WeeklyReportRequest {
  weekStart: string;   // ISO 8601
  weekEnd: string;     // ISO 8601
  categoryTotals: { category: Category; amount: number }[]; // 카테고리별 합계
  subscriptions: { name: string; amount: number }[];
  txCount: number;     // 총 건수
}

// Response 200
interface WeeklyReportResponse {
  topWasteCategory: Category;
  wasteAmount: number;      // 원
  insights: string[];       // 최대 5
  savingSuggestion: string;
}

// Error (unified)
interface ApiError { error: string; }
```
- 에러 코드: `400` (필드 누락/타입 오류) → `{ error: "invalid_request" }`, `429` (레이트리밋) → `{ error: "rate_limited" }`, `500` → `{ error: "server_error" }`, `503` (AI 일시 불가) → `{ error: "ai_unavailable" }`.
- `401`/`404` 미정의 (무인증·무상태 설계).

### POST /api/v1/benchmark — 익명 또래 벤치마크 비교
```typescript
// Headers: Content-Type: application/json 만. Authorization/식별 헤더 없음.
// Request
interface BenchmarkRequest {
  ageBand: '25-29' | '30-34' | '35-38';
  incomeBand: '250-350' | '350-450';
  categoryTotals: { category: Category; amount: number }[];
}

// Response 200
interface BenchmarkResponse {
  comparisons: {
    category: Category;
    userAmount: number;    // 원
    peerAvg: number;       // 또래 평균, 원
    diffPercent: number;   // 양수=더 씀, 음수=덜 씀. 정수 %
  }[];
  aiComment: string;       // AI 생성 요약, 예: "또래보다 커피값 37% 더 씀"
}
```
- 에러 코드: 위와 동일 unified shape (`400`/`429`/`500`/`503`). `401`/`404` 미정의.

---

## Feature List

### F1. 데이터 모델 & localStorage 저장 계층
- **Description**: 모든 엔티티(Transaction, Subscription, Report, Challenge, Settings)의 CRUD를 담당하는 순수 로직 계층. 화면 없이 타입 안전한 저장/조회/집계 유틸을 제공하며, 12개월/1,500건 상한과 용량 초과 방어를 담당한다.
- **Data**: 전 엔티티
- **API**: 없음 (localStorage only)
- **Requirements**:
  - **AC-1 [U][P0]**: Scenario: 트랜잭션 저장/조회
    - Given 저장 계층이 초기화됨
    - When `addTransaction({ amount: 12000, category: "식비", merchant: "김밥천국", memo: "점심", source: "manual" })` 호출
    - Then `spendlens.transactions`에 `id`,`spentAt`,`createdAt`,`updatedAt`(=createdAt)가 채워진 항목이 추가되고, `getTransactions()`가 해당 항목을 포함해 반환
  - **AC-2 [U][P0]**: Scenario: 카테고리별 집계
    - Given `식비 12000`, `카페 5000`, `식비 8000` 3건이 저장됨
    - When `getCategoryTotals()` 호출
    - Then `[{category:"식비",amount:20000},{category:"카페",amount:5000}]`를 amount 내림차순으로 반환
  - **AC-3 [S][P1]**: Scenario: 건수 상한 유지
    - While `spendlens.transactions`에 1,500건이 저장된 상태
    - When 1건 추가
    - Then `spentAt` 오래된 1건이 제거되어 총 1,500건 유지
  - **AC-4 [W][P1]**: Scenario: localStorage 용량 초과
    - Given 저장 시 `QuotaExceededError` 발생
    - When `addTransaction()` 호출
    - Then 저장은 롤백되고 `{ ok: false, error: "storage_full" }` 반환 (throw 하지 않음)
  - **AC-5 [W][P1]**: Scenario: 손상된 JSON 복구
    - Given `spendlens.transactions` 값이 `"{broken"` 로 손상됨
    - When `getTransactions()` 호출
    - Then 빈 배열/빈 페이지 반환, console.error 미출력
  - **AC-6 [W][P0]**: Scenario: 잘못된 금액 거부
    - When `addTransaction({ amount: 0, ... })` 또는 `amount: -100` 호출
    - Then 저장하지 않고 `{ ok: false, error: "invalid_amount" }` 반환
  - **AC-7 [U][P0]**: Scenario: 페이지네이션 조회 계약
    - Given `spendlens.transactions`에 120건이 저장됨(`spentAt` 내림차순 기준)
    - When `getTransactions({ page: 1, pageSize: 50 })` 호출
    - Then `{ items: Transaction[], total: number, page: number }` 형태로 `{ items.length === 50, total === 120, page === 1 }`를 반환하고, `items`는 `spentAt` 내림차순 첫 50건. `getTransactions({ page: 3, pageSize: 50 })`는 `items.length === 20`(잔여분) 반환, 범위를 넘는 `page`는 `items: []` 반환. `getTransactions()`(인자 없음)는 전체 배열을 반환하는 하위호환 오버로드로 유지된다.
  - **AC-8 [W][P1]**: Scenario: 잘못된 페이지 인자 방어
    - When `getTransactions({ page: 0 })` 또는 `getTransactions({ pageSize: -1 })` 호출
    - Then throw 없이 `page`는 최소 1, `pageSize`는 기본값 50으로 보정하여 반환

---

### F2. SMS/알림 붙여넣기 자동 파싱 & 지출 입력
- **Description**: 사용자가 카드사 결제 SMS 텍스트를 붙여넣으면 정규식 파서가 금액·가맹점·일시·카테고리를 추출해 확인 폼에 프리필한다. 파싱 실패 시 수동 입력으로 전환하며, 원문 텍스트는 저장하지 않는다.
- **Data**: Transaction
- **API**: 없음
- **Requirements**:
  - **AC-1 [E][P0]**: Scenario: SMS 파싱 성공
    - Given 입력창에 `"[Web발신] 신한카드 12,000원 승인 스타벅스 08/09 12:30"` 붙여넣음
    - When "분석" 버튼 탭
    - Then 폼에 `{ amount: 12000, merchant: "스타벅스", category: "카페", spentAt: "2026-08-09T12:30" }`가 프리필됨
  - **AC-2 [E][P0]**: Scenario: 저장 성공
    - Given 파싱/수동 폼이 유효한 값을 가짐
    - When "저장" 버튼(TDS Button) 탭
    - Then Transaction이 저장되고 TDS Toast "지출이 기록되었어요" 표시 후 `/` 로 이동
  - **AC-3 [W][P1]**: Scenario: 파싱 실패 → 수동 전환
    - Given `"안녕하세요 광고입니다"` 붙여넣음
    - When "분석" 탭
    - Then TDS Paragraph "금액을 찾지 못했어요. 직접 입력해주세요" 표시 및 금액 필드에 포커스, 폼은 빈 상태로 열림
  - **AC-4 [W][P1]**: Scenario: 빈 금액 거부
    - When 금액 필드가 비거나 0인 상태로 "저장" 탭
    - Then TDS TextField 하단 에러 "금액을 입력해주세요" 표시, 저장 안 함
  - **AC-5 [W][P0]**: Scenario: 원문 미저장
    - Given 붙여넣은 SMS 원문이 존재
    - When 저장 완료
    - Then `spendlens.transactions` 어떤 필드에도 원문 문자열이 포함되지 않음(파싱 결과만 저장)
  - **AC-6 [U][P1]**: Scenario: 모바일 키보드
    - Given 금액 TextField 포커스
    - Then `inputMode="numeric"` 숫자 키패드가 노출되고, 키보드가 저장 버튼을 가리지 않도록 SubmitFooter가 키보드 위로 유지됨
  - **AC-7 [O][P2]**: Scenario: 카테고리 수동 변경
    - Where 파싱 카테고리가 "기타"인 경우
    - Then TDS Chip 목록에서 카테고리 재선택 가능

---

### F3. 홈 대시보드 & 지출 목록
- **Description**: 이번 달 총 지출과 카테고리 상위 비중을 히어로/시각화로 보여주고, 최근 지출 목록을 스크롤로 제공하는 핵심 가치 화면. 목록 하단에 배너 광고를 배치한다.
- **Data**: Transaction, UserSettings
- **API**: 없음
- **Requirements**:
  - **AC-1 [U][P0]**: Scenario: 이번 달 총 지출 표시
    - Given 이번 달 지출 3건 합계 25,000원
    - When 홈 진입
    - Then SummaryHero에 CountUp으로 "25,000원"이 `data-testid="month-total"`로 표시됨
  - **AC-2 [U][P0]**: Scenario: 목록 레이아웃 계약
    - Given 지출 10건 존재
    - Then 홈은 ScreenScaffold로 감싸이고, 각 항목은 TDS ListRow(가맹점·카테고리·금액)로 렌더, 카테고리 비중은 `data-testid="category-mini-bar"` MiniBar로 표시됨
  - **AC-3 [S][P1]**: Scenario: 빈 상태
    - While 저장된 지출이 0건
    - Then TDS Asset.ContentIcon + Paragraph "아직 기록이 없어요" + display="block" "지출 기록하기" 버튼 표시
  - **AC-4 [S][P1]**: Scenario: 로딩 상태
    - While localStorage 조회 중
    - Then TDS Skeleton(또는 로딩 placeholder)이 목록 영역에 표시됨
  - **AC-5 [E][P1]**: Scenario: 페이지네이션 렌더링 계약
    - Given 지출 500건 이상
    - When 홈 최초 진입
    - Then `getTransactions({ page: 1, pageSize: 50 })`로 첫 페이지만 조회해 초기 렌더는 50건으로 제한되고, 목록 하단 근처로 스크롤 시 `page`를 1씩 증가시켜 다음 50건을 이어붙여 렌더(윈도잉). `total`에 도달하면 추가 조회를 멈추고 "더 이상 없음" 상태로 전환
  - **AC-6 [U][P1]**: Scenario: 배너 광고 배치
    - Then `<AdSlot>` 배너가 목록과 겹치지 않고 목록 하단 고정 영역에 렌더됨
  - **AC-7 [E][P0]**: Scenario: 항목 진입
    - When ListRow(높이 ≥ 44px) 탭
    - Then `navigate('/tx/:id')` 상세로 이동
  - **AC-8 [W][P1]**: Scenario: 삭제 확인
    - When 상세에서 "삭제" 탭
    - Then TDS AlertDialog "삭제할까요?" 표시, 확인 시에만 제거 후 Toast "삭제되었어요"

---

### F4. AI 주간 낭비 패턴 리포트 (보상형 광고 게이트)
- **Description**: 지난 주 카테고리 집계를 AI 서버로 전송해 낭비 카테고리·추정 낭비액·절약 제안을 받아 카드로 시각화한다. 무료 사용자는 결과 열람 전 보상형 광고를 시청하며, 모든 결과에 AI 생성 라벨을 표시한다.
- **Data**: WeeklyReport, Transaction, Subscription, UserSettings
- **API**: `POST /api/v1/weekly-report` → `WeeklyReportResponse` | errors 400/429/500/503
- **Requirements**:
  - **AC-1 [E][P0]**: Scenario: 리포트 생성 성공
    - Given 지난 주 지출 데이터 존재
    - When "이번 주 리포트 보기" 탭 → API 200 응답
    - Then WeeklyReport가 `spendlens.reports`에 캐시되고, 결과 화면에 `data-testid="waste-card"` Card 표시(낭비 카테고리 + wasteAmount를 t2 강조 타이포)
  - **AC-2 [E][P0]**: Scenario: 보상형 광고 게이트 (무료)
    - Given `settings.isPremium === false`
    - When "결과 보기" 탭
    - Then `<TossRewardAd>` 광고 시청 완료 후에만 리포트 결과가 노출됨
  - **AC-3 [E][P0]**: Scenario: AI 첫 이용 고지
    - Given `settings.aiNoticeAcknowledged === false`
    - When AI 기능 최초 사용
    - Then TDS AlertDialog "이 서비스는 생성형 AI를 활용합니다" 1회 표시, 확인 탭 시 `settings.aiNoticeAcknowledged = true` 저장
  - **AC-4 [U][P0]**: Scenario: AI 결과물 라벨
    - Given 리포트 결과가 화면에 표시될 때
    - Then 결과 카드 상단에 TDS Badge "AI가 생성한 결과입니다"가 `data-testid="ai-label"`로 표시됨
  - **AC-5 [S][P1]**: Scenario: 로딩 상태
    - While API 응답 대기 중
    - Then "AI가 소비 패턴을 분석 중이에요" 문구와 TDS 로딩 인디케이터 표시, 재요청 버튼 비활성
  - **AC-6 [W][P1]**: Scenario: AI 서버 오류
    - Given API가 `503 { error: "ai_unavailable" }` 반환
    - Then TDS Toast "잠시 후 다시 시도해주세요" 표시, 화면은 이전 상태 유지(크래시 없음)
  - **AC-7 [S][P1]**: Scenario: 데이터 부족 빈 상태
    - While 지난 주 지출이 3건 미만
    - Then TDS Asset.ContentIcon + "리포트를 만들 지출이 부족해요 (최소 3건)" 표시, API 미호출
  - **AC-8 [W][P1]**: Scenario: 개인정보 전송 제한
    - When API 요청 전송
    - Then request body에 merchant 원문/memo/원문 SMS가 포함되지 않고 categoryTotals 집계값만 전송되며, `Authorization`·기기/사용자 식별 헤더가 부착되지 않음

---

### F5. 익명 또래 벤치마크 비교 (프리미엄)
- **Description**: 사용자의 연령/소득대를 기준으로 카테고리별 지출을 또래 평균과 비교해 초과 비율을 시각화한다. 프리미엄 전용 기능으로, 비프리미엄은 잠금 상태와 구매 유도 화면을 노출한다.
- **Data**: Transaction, UserSettings
- **API**: `POST /api/v1/benchmark` → `BenchmarkResponse` | errors 400/429/500/503
- **Requirements**:
  - **AC-1 [E][P0]**: Scenario: 벤치마크 조회 성공
    - Given `settings.isPremium === true`, 연령대/소득대 설정 완료
    - When "또래 비교 보기" 탭 → API 200
    - Then 카테고리별 `data-testid="benchmark-card"` Card에 사용자값·또래평균·diffPercent가 MiniBar 대비로 표시되고 초과 항목은 diffPercent를 t3 강조
  - **AC-2 [S][P0]**: Scenario: 프리미엄 잠금
    - While `settings.isPremium === false`
    - Then 결과 대신 잠금 카드 + display="block" "프리미엄 시작하기" 버튼(→ `/premium`) 표시, API 미호출
  - **AC-3 [U][P0]**: Scenario: AI 코멘트 라벨
    - Then `aiComment`(예: "또래보다 커피값 37% 더 씀") 표시 시 "AI가 생성한 결과입니다" 배지 동반
  - **AC-4 [W][P1]**: Scenario: 설정 미완료
    - Given 연령대/소득대 미설정
    - When "또래 비교 보기" 탭
    - Then BottomSheet로 연령/소득대 선택(Chip) 요구, 미선택 시 조회 진행 안 함
  - **AC-5 [S][P1]**: Scenario: 로딩/빈 상태
    - While API 대기 중 Skeleton 카드 표시; If 비교 가능한 카테고리 0개면 "비교할 지출이 없어요" 표시
  - **AC-6 [W][P1]**: Scenario: 네트워크 오류
    - Given API가 `500 { error: "server_error" }`
    - Then TDS Toast "비교 정보를 불러오지 못했어요" 표시, 재시도 버튼 노출

---

### F6. 절약 챌린지
- **Description**: 특정 카테고리에 대한 이번 달 목표 절감액을 설정하고, 실제 지출과 전월 대비로 현재 절감액·달성 여부를 자동 계산해 진행률을 보여준다. 순수 로컬 계산으로 동작한다.
- **Data**: SavingChallenge, Transaction
- **API**: 없음
- **Requirements**:
  - **AC-1 [E][P0]**: Scenario: 챌린지 생성
    - When `{ targetCategory: "배달", targetAmount: 50000 }` 로 "챌린지 시작" 탭
    - Then `monthKey`가 이번 달로 설정된 SavingChallenge가 저장되고 status "active"로 목록에 추가됨
  - **AC-2 [U][P0]**: Scenario: 절감액 계산
    - Given 배달 전월 지출 120,000원, 이번 달 80,000원
    - When 챌린지 상세 진입
    - Then Transaction에서 라이브 재계산된 `currentSaved = 40000`이 `data-testid="saved-hero"` SummaryHero(CountUp)로, 진행률(40000/50000=80%)이 진행 바로 표시됨(파생 규칙에 따라 저장 FK 없이 읽기 시 계산)
  - **AC-3 [S][P0]**: Scenario: 달성 상태
    - While `currentSaved >= targetAmount`
    - Then status "achieved"로 갱신(`updatedAt` 갱신)되고 TDS Badge "목표 달성" 표시
  - **AC-4 [W][P1]**: Scenario: 잘못된 목표 금액
    - When `targetAmount: 0` 또는 음수로 생성 시도
    - Then "목표 금액을 입력해주세요" 에러 표시, 저장 안 함
  - **AC-5 [W][P1]**: Scenario: 중복 챌린지 방지
    - Given 이번 달 "배달" active 챌린지 존재
    - When 동일 카테고리 챌린지 재생성 시도
    - Then TDS Toast "이미 진행 중인 챌린지예요" 표시, 생성 안 함
  - **AC-6 [S][P1]**: Scenario: 빈 상태
    - While 챌린지 0개
    - Then Asset.ContentIcon + "절약 챌린지를 시작해보세요" + display="block" 생성 버튼 표시

---

### F7. 프리미엄 구독 (IAP) & 설정
- **Description**: 월 4,900원 프리미엄 구매를 템플릿 `<TossPurchase>`로 처리하고, 구매 성공 시 `settings.isPremium`을 활성화해 벤치마크/월간 리포트 잠금을 해제한다. 연령/소득대 등 벤치마크 기준과 AI 고지 상태도 이 화면에서 관리한다.
- **Data**: UserSettings
- **API**: 없음 (IAP는 TossPurchase 내부 `IAP.createOneTimePurchaseOrder`)
- **Requirements**:
  - **AC-1 [E][P0]**: Scenario: 구매 성공 → 프리미엄 활성화
    - When `<TossPurchase sku={VITE_TOSS_IAP_SKU}>` 결제 성공 → `onPurchased` 콜백
    - Then `processProductGrant`에서 `settings.isPremium = true` 저장(`updatedAt` 갱신), Toast "프리미엄이 시작되었어요" 표시
  - **AC-2 [S][P0]**: Scenario: 프리미엄 상태 반영
    - While `settings.isPremium === true`
    - Then 프리미엄 화면 CTA가 "이용 중"으로 바뀌고 재결제 버튼 비활성
  - **AC-3 [W][P1]**: Scenario: 결제 취소/실패
    - Given 사용자가 결제 창을 닫거나 실패
    - Then `isPremium` 변경 없이 화면 유지, Toast "결제가 취소되었어요" 표시(크래시 없음)
  - **AC-4 [E][P1]**: Scenario: 벤치마크 기준 저장
    - When 연령대 Chip "30-34", 소득대 Chip "350-450" 선택
    - Then `settings.benchmarkAgeBand`/`benchmarkIncomeBand` 저장(`updatedAt` 갱신), Toast "저장되었어요"
  - **AC-5 [U][P1]**: Scenario: 설정 레이아웃
    - Then 화면은 ScreenScaffold로 감싸이고 항목은 TDS ListRow/Switch로 구성, 프리미엄 카드는 Card로 위계 표현
  - **AC-6 [W][P0]**: Scenario: 프로모션 지급 한도
    - Where `grantPromotionReward` 호출 시
    - Then `amount <= 5000` 검증 후 호출, 초과 시 호출 차단

---

### F8. 월간 AI 재무 진단 리포트 (프리미엄, 공유)
- **Description**: 한 달 지출을 종합해 AI 서버가 생성한 진단 텍스트와 지표를 요약 화면으로 제공하고, 앱 내 캡처/이미지 형태로 공유할 수 있게 한다(외부 도메인 이동 없음). 프리미엄 전용이며 결과에는 AI 라벨을 표시한다.
- **Data**: WeeklyReport(월 집계 재사용), Transaction, UserSettings
- **API**: `POST /api/v1/weekly-report` (월 범위 파라미터로 재사용) → `WeeklyReportResponse` | errors
- **Requirements**:
  - **AC-1 [E][P0]**: Scenario: 월간 진단 생성
    - Given `isPremium === true`, 이번 달 지출 존재
    - When "월간 진단 만들기" 탭 → API 200
    - Then `data-testid="monthly-report-card"` Card에 총지출 SummaryHero(CountUp)·낭비 카테고리·절약 제안이 표시됨
  - **AC-2 [S][P0]**: Scenario: 프리미엄 잠금
    - While `isPremium === false`
    - Then 잠금 화면 + "프리미엄 시작하기" 버튼(→ `/premium`) 표시, API 미호출
  - **AC-3 [U][P0]**: Scenario: AI 라벨
    - Then 리포트 상·하단에 "AI가 생성한 결과입니다" 배지 표시
  - **AC-4 [E][P1]**: Scenario: 앱 내 공유
    - When "공유" 탭
    - Then 앱 내 공유 시트/이미지 저장이 실행되고 외부 URL(window.open/location.href) 이동은 발생하지 않음
  - **AC-5 [S][P1]**: Scenario: 로딩/빈/오류
    - While 대기 중 로딩 인디케이터; If 이번 달 지출 0건이면 "이번 달 지출이 없어요" 빈 상태; API 오류 시 Toast "다시 시도해주세요"
  - **AC-6 [W][P1]**: Scenario: 중복 생성 방지
    - Given 이번 달 리포트가 이미 캐시됨
    - When "월간 진단 만들기" 재탭
    - Then API 재호출 없이 캐시된 결과 표시(불필요한 요청/과금 방지), "다시 분석" 명시적 탭 시에만 재호출(재호출 시 `updatedAt` 갱신)

---

### F9. 구독 감지 & 관리
- **Description**: 저장된 Transaction에서 반복 결제 패턴을 감지해 SubscriptionItem 목록을 생성하고, 월 구독 총액과 중복 의심 구독을 시각화한다. 순수 로컬 계산이며, Transaction 뮤테이션마다 전체 재감지한다(파생 규칙 참조). 화면 없이 데이터만 있던 SubscriptionItem 모델에 대한 UI/로직 계층.
- **Data**: SubscriptionItem, Transaction, UserSettings
- **API**: 없음 (localStorage only)
- **Requirements**:
  - **AC-1 [U][P0]**: Scenario: 구독 감지 재계산
    - Given `category === "구독"`인 Transaction이 동일 `merchant`로 최근 3개월 중 2개월 이상, 금액 편차 ±10% 이내로 존재
    - When `detectSubscriptions()` 호출(또는 Transaction 추가/수정/삭제 시 자동 트리거)
    - Then 해당 merchant에 대해 SubscriptionItem이 생성/갱신되고, `sourceTxIds`에 근거 Transaction.id들이 채워지며 `id`는 `sourceTxIds` 안정적 해시로 결정됨(동일 구독 재계산 시 id 불변), `spendlens.subscriptions`에 저장
  - **AC-2 [U][P0]**: Scenario: 목록 & 월 총액 표시
    - Given 감지된 구독 3건(넷플릭스 13,500 / 유튜브 14,900 / 멜론 10,900)
    - When `/subscriptions` 진입
    - Then 각 구독이 TDS ListRow(name·amount·lastChargedAt)로 렌더되고, 상단 `data-testid="subs-total"` SummaryHero(CountUp)에 월 구독 합계 "39,300원" 표시
  - **AC-3 [U][P1]**: Scenario: 중복 의심 표기
    - Given 동일 `category`(예: 문화/OTT)로 판정되는 구독이 2건 이상 존재해 `isDuplicateSuspect === true`
    - Then 해당 ListRow에 TDS Badge "중복 의심"이 `data-testid="dup-badge"`로 표시됨
  - **AC-4 [S][P1]**: Scenario: 빈 상태
    - While 감지된 구독 0건
    - Then TDS Asset.ContentIcon + Paragraph "감지된 구독이 없어요" 표시, 총액 히어로 미표시
  - **AC-5 [W][P1]**: Scenario: 근거 거래 삭제 시 자동 소멸
    - Given 넷플릭스 SubscriptionItem의 `sourceTxIds` 근거 Transaction이 모두 삭제됨
    - When 다음 재감지(삭제 뮤테이션에 의해 자동 트리거)
    - Then 해당 SubscriptionItem이 목록/저장소에서 사라지고 `subs-total`이 재계산됨(크래시 없음)
  - **AC-6 [W][P1]**: Scenario: 손상/미달 데이터 방어
    - Given `spendlens.subscriptions` 값이 손상되었거나 구독 판정 조건 미달
    - When `/subscriptions` 진입
    - Then throw/console.error 없이 빈 상태로 렌더

---

## Screen Definitions

### S1. 홈 대시보드 — `/`
- **TDS 컴포넌트**: ScreenScaffold, Top(타이틀), SummaryHero(월 총지출 CountUp), MiniBar(카테고리 비중), TDS ListRow(지출 항목), Asset.ContentIcon(빈 상태), Skeleton(로딩), AdSlot(배너), FloatingTabBar(하단 네비).
- **상태**: 로딩=Skeleton 목록 / 빈=Asset.ContentIcon+"지출 기록하기" / 에러=Toast "불러오지 못했어요".
- **터치**: ListRow 높이 ≥ 44px, FAB "기록" 버튼 56px.
- **Navigation 계약**:
  - Outgoing: "기록 버튼 → `navigate('/add')`"; "ListRow → `navigate('/tx/:id')`"; "리포트 탭 → `navigate('/report')`".
  - Incoming: `location.state` 없음(루트 진입).
- **레이아웃 계약**: ScreenScaffold 골격, `data-testid="month-total"` SummaryHero + `data-testid="category-mini-bar"` MiniBar, 목록은 `getTransactions({page,pageSize:50})` 페이지네이션으로 ListRow 나열(raw div 금지), 배너는 목록 하단 비겹침.

### S2. 지출 기록 — `/add`
- **TDS 컴포넌트**: ScreenScaffold, TDS TextField(붙여넣기/금액/메모), TDS Chip(카테고리), TDS Button(분석), SubmitFooter(저장, 하단 고정), Toast.
- **상태**: 파싱 실패=Paragraph 안내+금액 포커스 / 유효성 에러=TextField 하단 에러 / 저장 중=버튼 로딩.
- **터치**: Chip ≥ 44px, 저장 버튼 display="block" 하단 고정, `inputMode="numeric"`.
- **Navigation 계약**:
  - Outgoing: "저장 성공 → `navigate('/', { replace: true })`".
  - Incoming: `location.state = { prefill?: Partial<Transaction> } | undefined`.
- **레이아웃 계약**: 단순 입력 화면 — SubmitFooter 하단 고정 저장 버튼(좌측 글자폭 금지), 폼은 ScreenScaffold 내 배치.

### S3. 지출 상세 — `/tx/:id`
- **TDS 컴포넌트**: ScreenScaffold, Card(내역), TDS ListRow(필드), TDS Button(삭제), AlertDialog(삭제 확인), Toast.
- **상태**: 없는 id=빈 상태 "내역을 찾을 수 없어요"+홈 이동 버튼.
- **터치**: 삭제 버튼 ≥ 44px.
- **Navigation 계약**:
  - Outgoing: "삭제 확인 → `navigate('/', { replace: true })`".
  - Incoming: URL param `:id`(string). `location.state` 미사용.

### S4. AI 주간 리포트 — `/report`
- **TDS 컴포넌트**: ScreenScaffold, TossRewardAd(무료 게이트), Card(`data-testid="waste-card"`), TDS Badge(`data-testid="ai-label"`), 강조 타이포 t2, AlertDialog(AI 고지), 로딩 인디케이터, Asset.ContentIcon(데이터 부족), Toast.
- **상태**: 로딩="분석 중" / 빈="지출 부족(최소 3건)" / 오류=Toast.
- **터치**: "결과 보기" 버튼 display="block" ≥ 44px.
- **Navigation 계약**:
  - Outgoing: "프리미엄 유도 → `navigate('/premium')`".
  - Incoming: `location.state = { weekStart?: string; weekEnd?: string } | undefined`.
- **레이아웃 계약**: 결과는 Card로 묶고 wasteAmount는 t2 강조+배지, AI 라벨 배지 상단 고정.

### S5. 또래 벤치마크 — `/benchmark`
- **TDS 컴포넌트**: ScreenScaffold, Card(`data-testid="benchmark-card"`), MiniBar(대비), TDS Badge(AI 라벨), BottomSheet(연령/소득 선택), TDS Chip, Skeleton.
- **상태**: 잠금(비프리미엄)=잠금 카드+"프리미엄 시작하기" / 로딩=Skeleton / 빈="비교할 지출 없음" / 오류=Toast+재시도.
- **터치**: Chip/버튼 ≥ 44px.
- **Navigation 계약**:
  - Outgoing: "프리미엄 시작하기 → `navigate('/premium')`".
  - Incoming: `location.state` 미사용(설정에서 기준 로드).
- **레이아웃 계약**: 카테고리별 benchmark-card + diffPercent t3 강조, 초과/절감 MiniBar 대비.

### S6. 절약 챌린지 — `/challenge`
- **TDS 컴포넌트**: ScreenScaffold, SummaryHero(`data-testid="saved-hero"` CountUp), 진행 바, Card(챌린지), TDS Chip(카테고리), TextField(목표액), SubmitFooter(시작), Badge(달성), Asset.ContentIcon(빈), Toast.
- **상태**: 빈="챌린지 시작" / 달성=Badge / 에러=인라인/Toast.
- **터치**: 카테고리 Chip ≥ 44px, 시작 버튼 하단 고정.
- **Navigation 계약**:
  - Outgoing: "챌린지 카드 → `navigate('/challenge/:id')`".
  - Incoming: `location.state` 미사용.
- **레이아웃 계약**: currentSaved SummaryHero(CountUp)+진행 바, 각 챌린지 Card 위계.

### S7. 프리미엄 & 설정 — `/premium`
- **TDS 컴포넌트**: ScreenScaffold, Card(프리미엄 혜택), TossPurchase(결제 버튼), TDS ListRow/Switch(설정), TDS Chip(연령/소득), Toast.
- **상태**: 이용 중=CTA "이용 중" 비활성 / 결제 취소=Toast.
- **터치**: 결제 버튼 display="block" ≥ 48px.
- **Navigation 계약**:
  - Outgoing: 구매 성공 시 `navigate(-1)` 또는 이전 화면 유지.
  - Incoming: `location.state = { from?: 'benchmark' | 'monthly' } | undefined`.

### S8. 월간 AI 진단 — `/monthly`
- **TDS 컴포넌트**: ScreenScaffold, Card(`data-testid="monthly-report-card"`), SummaryHero(총지출 CountUp), TDS Badge(AI 라벨), TDS Button(공유/다시 분석), Skeleton, Asset.ContentIcon.
- **상태**: 잠금=프리미엄 유도 / 로딩=Skeleton / 빈="이번 달 지출 없음" / 오류=Toast.
- **터치**: 공유 버튼 ≥ 44px.
- **Navigation 계약**:
  - Outgoing: "프리미엄 시작하기 → `navigate('/premium', { state: { from: 'monthly' } })`".
  - Incoming: `location.state = { monthKey?: string } | undefined`.
- **레이아웃 계약**: monthly-report-card에 총지출 SummaryHero+AI 배지(상·하단), 공유는 앱 내 처리(외부 URL 금지).

### S9. 구독 관리 — `/subscriptions`
- **TDS 컴포넌트**: ScreenScaffold, Top(타이틀), SummaryHero(`data-testid="subs-total"` 월 구독 합계 CountUp), TDS ListRow(구독 항목: name·amount·lastChargedAt), TDS Badge(`data-testid="dup-badge"` 중복 의심), Asset.ContentIcon(빈 상태), Skeleton(로딩), FloatingTabBar.
- **상태**: 로딩=Skeleton / 빈=Asset.ContentIcon+"감지된 구독이 없어요"(총액 미표시) / 정상=합계 히어로+ListRow 목록.
- **터치**: ListRow ≥ 44px.
- **Navigation 계약**:
  - Outgoing: "구독 원천 지출 보기 → `navigate('/tx/:id')`"(sourceTxIds 대표 항목).
  - Incoming: `location.state` 미사용(저장소에서 재감지 로드).
- **레이아웃 계약**: 상단 subs-total SummaryHero, 각 구독 ListRow 나열(raw div 금지), 중복 의심 항목에 dup-badge, 근거 거래 삭제 시 목록/합계 자동 재계산.

---

## Toss 검수 통과 공통 ACs
- **AC-G1 [W][P0]**: `window.location.href`/`window.open`으로 외부 URL 이동 시도 시 실행 차단(내부 라우팅만 허용).
- **AC-G2 [U][P0]**: 프로덕션 빌드에서 console.error 출력 0개.
- **AC-G3 [U][P0]**: 외부 AI API 호출 시 CORS 에러 0개(허용 오리진 등록 완료).
- **AC-G4 [U][P0]**: Android 7+/iOS 16+ 호환 — 최신 전용 API 미사용.
- **AC-G5 [W][P0]**: "앱 설치/다운로드" 유도 문구·배너·링크 미포함.
- **AC-G6 [W][P0]**: 서비스 본질과 무관한 외부 링크 미포함(법률/공공기관 링크만 허용).
- **AC-G7 [W][P0]**: 외부 분석 솔루션(GA/Amplitude 등) 미탑재.
- **AC-G8 [U][P0]**: HEX 색상 하드코딩 0건 — `var(--tds-color-*)`/TDS 컴포넌트만 사용, 다크모드 정상.
- **AC-G9 [U][P0]**: `grantPromotionReward` 사용 시 `amount ≤ 5000` 검증.
- **AC-G10 [E][P0]**: AI 기능 첫 사용 시 "이 서비스는 생성형 AI를 활용합니다" 다이얼로그 1회 표시 후 플래그 저장.
- **AC-G11 [U][P0]**: 모든 AI 결과물에 "AI가 생성한 결과입니다" 라벨/배지 표시.
- **AC-G12 [W][P0]**: 외부 AI API 요청에 기기·사용자 식별자(토스 userId/광고 ID/디바이스 ID/세션 토큰)와 `Authorization` 헤더가 부착되지 않음(무인증·무상태 설계, 익명 집계값만 전송).

---

## Assumptions

1. AI 분석 및 벤치마크 평균 데이터는 별도 Railway API 서버가 제공하며, 앱은 익명 집계값만 전송한다.
2. 사용자가 카드사 결제 SMS/알림 텍스트를 수동으로 붙여넣을 수 있다(카드사 자동 연동 없음).
3. IAP SKU, 광고 그룹/슬롯 ID, 프로모션 코드는 앱인토스 콘솔에서 발급되어 env로 주입된다.
4. 벤치마크 또래 평균은 서버가 유지하는 집계 통계이며 개인 데이터는 저장하지 않는다.
5. 무료 사용자는 주간 리포트를 보상형 광고 시청으로 열람하고, 심층/월간/벤치마크는 프리미엄 전용이다.
6. PDF는 앱 내 이미지 캡처/공유 시트로 대체하여 외부 도메인 이동을 피한다(MVP 범위).
7. 정기 구독은 IAP 단건 결제(월 단위 갱신)로 근사하며, 자동 반복결제 서버 로직은 MVP 제외.
8. 외부 AI 서버는 무인증·무상태로 운영되며, 남용 방지가 필요하면 사용자 식별 없는 오리진 기반 레이트리밋(`429`)만 사용한다.
9. 구독 감지는 순수 로컬 규칙(동일 merchant 반복·금액 편차 ±10%·최근 3개월 중 2개월↑)으로 근사하며, Transaction 뮤테이션마다 전체 재감지한다.

## Open Questions

1. 벤치마크 또래 평균 데이터의 초기 시드는 어떻게 확보하는가(공개 통계 vs 자체 집계)? 데이터 부족 시 표기 정책은?
2. AI 서버 비용 통제를 위한 무료 사용자 리포트 생성 빈도 제한(주 1회 등)의 구체 수치? (무인증 설계 하에서 오리진 기반 레이트리밋으로만 제어)
3. 구독 중복 감지(SubscriptionItem.isDuplicateSuspect) 판정 규칙 — 카테고리 기준인가 가맹점명 유사도 기준인가? (F9는 잠정적으로 동일 category 기준을 채택, 확정 필요)
4. IAP 단건-월갱신 근사 시 만료/재구매 UX 처리 방식(만료일 표시 여부)?
5. SMS 파서가 지원할 카드사/은행 발신 포맷 범위(초기 지원 목록)?
6. 프로모션 캠페인(`grantPromotionReward`) 적용 여부 및 promotionCode 발급 계획?