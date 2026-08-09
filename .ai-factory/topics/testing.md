# Topic: testing

> These are learned patterns — VERIFY against actual codebase before applying.

## 화면 구현 패킷을 돌리기 전에 플랫폼 SDK·결제/광고 컴포넌트·UI 라이브러리·스토리지 API를 감싼 공유 테스트 목 하네스를 먼저 확정하고, 에이전트가 임시 디버그 테스트 파일을 만들지 못하게 막아라.
_[unverified, 60%, fix_loop]_

각 화면 패킷이 외부 SDK와 수익화·토스트/다이얼로그 컴포넌트, localStorage/matchMedia 목을 스스로 재발명하면 목 불일치가 날 때마다 에이전트가 임시 디버그 테스트를 생성·삭제하며 원인을 추적하려다 max_turns·시간 초과에 걸려 화면 결함이 없어도 실패한다. 공용 setup에서 이들 경계를 한 번만 목으로 고정하고(에러 주입 헬퍼 포함), 라우팅·세션 셸 같은 공통 의존성을 화면보다 먼저 안정화하며, 한 패킷=한 화면으로 스코프를 좁히고 임시 파일 생성을 금지하면 스레싱과 타임아웃을 구조적으로 예방할 수 있다.
