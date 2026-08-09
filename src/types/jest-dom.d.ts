// jsdom 매처(toBeInTheDocument 등) 타입을 tsc 프로그램에 노출.
// vitest.setup.ts는 루트라 tsconfig("include": ["src"]) 밖 → 여기서 augmentation을 끌어온다.
import "@testing-library/jest-dom/vitest";
