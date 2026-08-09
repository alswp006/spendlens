import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // react-router(v7)의 exports 맵은 node 조건에서 CJS(index.js), import 조건에서
      // ESM(index.mjs)을 준다. vitest가 테스트 파일(ESM 변환)과 src 컴포넌트(node_modules
      // externalize → CJS)를 서로 다른 조건으로 해석하면 두 인스턴스가 로드되고,
      // MemoryRouter가 심는 NavigationContext와 useNavigate가 읽는 컨텍스트가 갈라져
      // 탭 네비게이션(navigate)이 조용히 no-op이 된다.
      // 세 진입점을 모두 단일 .mjs로 못박아 한 인스턴스만 로드되게 한다. `react-router/dom`을
      // 반드시 `react-router`보다 먼저 두어야 한다(더 구체적인 패턴 우선 매칭) — 아니면
      // `react-router` 별칭이 subpath를 삼켜 깨진 경로가 되고, node 폴백으로 CJS
      // dom-export.js(→ CJS 컨텍스트 청크)가 로드되어 두 번째 인스턴스가 생긴다.
      'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom/dist/index.mjs'),
      'react-router/dom': path.resolve(__dirname, 'node_modules/react-router/dist/development/dom-export.mjs'),
      'react-router': path.resolve(__dirname, 'node_modules/react-router/dist/development/index.mjs'),
    },
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    server: { deps: { inline: [/react-router/] } },
    // Playwright 비주얼 스펙은 e2e/에 있다 — vitest 실행에서 제외(기본 제외 + e2e).
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    // 워커 폭발 방지(실사고 2026-07-21 global OOM/exit 137): vitest 기본은 CPU 코어 수만큼
    // 포크를 띄운다(16스레드 머신=최대 16개, 각 수백 MB) → jsdom 로드까지 겹쳐 WSL 총 메모리
    // 소진. 미니앱은 테스트 파일이 3~5개라 2포크로 충분하고 메모리를 8배 이상 줄인다.
    pool: 'forks',
    poolOptions: { forks: { minForks: 1, maxForks: 2 } },
  },
});
