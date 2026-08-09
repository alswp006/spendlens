# SpendLens

앱인토스 (Vite + React + TDS) 한국 직장인 10명 중 7명이 월말 '돈이 어디 갔지?'를 경험하는 가운데, 카드사 앱의 단순 내역 조회를 넘어 AI가 소비 패턴의 '낭비 구조'를 시각적으로 진단해주는 개인 재무 코치 앱 국내 카드사/은행 앱은 거래 내역 나열에 그쳐 '왜 돈이 부족한지' 구조적 원인을 알 수 없음. 토스·뱅크샐러드는 연동은 되지만 실행 가능한 절약 액션을 제시하지 않아 '보고 끝나는' 앱으로 전락. 특히 2030 직장인은 구독 서비스 중복 지출, 배달비 과지출을 인지하지 못한 채 매월 반복함.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/Add` | Add |
| `/Benchmark` | Benchmark |
| `/Challenge` | Challenge |
| `/Expenses` | Expenses |
| `/Home` | Home |
| `/Onboarding` | Onboarding |
| `/Premium` | Premium |
| `/Report` | Report |
| `/Settings` | Settings |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-08-09
