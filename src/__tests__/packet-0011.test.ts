import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { addExpense } from "@/lib/storage/expenses";
import { getChallenges } from "@/lib/storage/challenges";
import { STORAGE_KEYS } from "@/lib/storage/base";
import { formatKRW } from "@/lib/format";
import type { SavingChallenge } from "@/lib/types";

/**
 * Packet 0011: Challenge 페이지 — /challenge
 *
 * AC-1: baseline 200,000·target 120,000 생성 시 active 카드
 * AC-2: target 0/초과 시 에러·미저장
 * AC-3: 중복 카테고리 Toast·미생성, 진행률 75%·잔여 30,000 표기
 * AC-4: 컴파일 통과 (location.state 없이도 크래시 없음)
 *
 * Implementation target: src/pages/Challenge.tsx (App.tsx가 이미 /challenge에 연결)
 *
 * 테스트가 요구하는 testid/문구 규약 (Coder가 구현 시 준수):
 *   - 카테고리 선택: 각 카테고리 라벨 텍스트를 그대로 접근 가능한 이름으로 갖는 버튼(ChipItem) — 예: getByRole("button", { name: "배달" })
 *   - 목표 금액 입력: placeholder에 "목표 금액" 포함 — getByPlaceholderText(/목표 금액/)
 *   - 생성 버튼 텍스트: 정확히 "챌린지 시작"
 *   - data-testid="challenge-active-card" : 활성 챌린지 카드 (getAllByTestId)
 *   - data-testid="challenge-progress"    : 진행률/잔여 표기 컨테이너 (percent·remaining 텍스트 포함)
 *   - 검증 에러: TextField hasError+help → role="alert"로 노출, 문구 "목표는 1원 이상 최근 지출({baseline}원) 이하로 설정해주세요"
 *   - 중복 생성 시 Toast 문구: "이미 진행 중인 {category} 챌린지가 있어요"
 */

mockAll();

const CATEGORY = "배달" as const;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function seedActiveChallenge(overrides: Partial<SavingChallenge> = {}): SavingChallenge {
  const challenge: SavingChallenge = {
    id: "challenge-existing-1",
    category: CATEGORY,
    baselineAmount: 200000,
    targetAmount: 120000,
    monthStart: Date.now() - 5 * 24 * 60 * 60 * 1000,
    currentSpent: 90000,
    status: "active",
    ...overrides,
  };
  seedLocalStorage({ [STORAGE_KEYS.CHALLENGES]: [challenge] });
  return challenge;
}

describe("Challenge 페이지 — /challenge", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
  });

  // ==========================================================================
  // AC-1: 챌린지 생성 시 active 카드
  // ==========================================================================

  it("AC-1[P0]: baseline 200,000·target 120,000으로 챌린지를 생성하면 active 카드가 표시된다", async () => {
    // baseline 계산용 지출 — monthStart(생성 시점) 이전인 25일 전으로 두어
    // 생성 직후 currentSpent가 0으로 유지되도록 한다.
    addExpense({
      amount: 200000,
      category: CATEGORY,
      merchant: "배민",
      memo: "",
      timestamp: Date.now() - 25 * 24 * 60 * 60 * 1000,
      source: "manual",
    });

    const Challenge = (await import("@/pages/Challenge")).default;
    expect(() => renderWithRouter(React.createElement(Challenge))).not.toThrow();

    fireEvent.click(screen.getByRole("button", { name: CATEGORY }));
    fireEvent.change(screen.getByPlaceholderText(/목표 금액/), { target: { value: "120000" } });
    fireEvent.click(screen.getByRole("button", { name: "챌린지 시작" }));

    const saved = getChallenges();
    expect(saved.length).toBe(1);
    expect(saved[0]).toMatchObject({
      category: CATEGORY,
      baselineAmount: 200000,
      targetAmount: 120000,
      currentSpent: 0,
      status: "active",
    });

    expect(screen.getAllByTestId("challenge-active-card").length).toBe(1);
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
  });

  // ==========================================================================
  // AC-2: target 0/초과 시 에러·미저장
  // ==========================================================================

  it("AC-2[P0]: 목표 금액이 0이거나 baseline을 초과하면 에러를 표시하고 저장하지 않는다", async () => {
    addExpense({
      amount: 200000,
      category: CATEGORY,
      merchant: "배민",
      memo: "",
      timestamp: Date.now() - 25 * 24 * 60 * 60 * 1000,
      source: "manual",
    });

    const Challenge = (await import("@/pages/Challenge")).default;
    renderWithRouter(React.createElement(Challenge));

    const expectedError = `목표는 1원 이상 최근 지출(${formatKRW(200000)}) 이하로 설정해주세요`;

    fireEvent.click(screen.getByRole("button", { name: CATEGORY }));

    // target = 0
    fireEvent.change(screen.getByPlaceholderText(/목표 금액/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "챌린지 시작" }));
    expect(screen.getByRole("alert")).toHaveTextContent(expectedError);
    expect(getChallenges().length).toBe(0);

    // target > baseline
    fireEvent.change(screen.getByPlaceholderText(/목표 금액/), { target: { value: "250000" } });
    fireEvent.click(screen.getByRole("button", { name: "챌린지 시작" }));
    expect(screen.getByRole("alert")).toHaveTextContent(expectedError);
    expect(getChallenges().length).toBe(0);
  });

  // ==========================================================================
  // AC-3: 중복 카테고리 Toast·미생성, 진행률 75%·잔여 30,000 표기
  // ==========================================================================

  it("AC-3a[P0]: 활성 챌린지의 진행률 75%와 잔여 30,000원을 표기한다", async () => {
    seedActiveChallenge();
    addExpense({
      amount: 90000,
      category: CATEGORY,
      merchant: "배민",
      memo: "",
      timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000,
      source: "manual",
    });

    const Challenge = (await import("@/pages/Challenge")).default;
    renderWithRouter(React.createElement(Challenge));

    expect(screen.getAllByTestId("challenge-active-card").length).toBe(1);
    const progress = screen.getByTestId("challenge-progress");
    expect(progress).toHaveTextContent("75%");
    expect(progress).toHaveTextContent("30,000");
  });

  it("AC-3b[P0]: 동일 카테고리 중복 생성 시도는 Toast를 띄우고 새로 생성하지 않는다", async () => {
    seedActiveChallenge();
    addExpense({
      amount: 90000,
      category: CATEGORY,
      merchant: "배민",
      memo: "",
      timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000,
      source: "manual",
    });

    const Challenge = (await import("@/pages/Challenge")).default;
    renderWithRouter(React.createElement(Challenge));

    fireEvent.click(screen.getByRole("button", { name: CATEGORY }));
    fireEvent.change(screen.getByPlaceholderText(/목표 금액/), { target: { value: "50000" } });
    fireEvent.click(screen.getByRole("button", { name: "챌린지 시작" }));

    expect(screen.getByText(`이미 진행 중인 ${CATEGORY} 챌린지가 있어요`)).toBeInTheDocument();
    expect(getChallenges().length).toBe(1);
    expect(getChallenges()[0].targetAmount).toBe(120000);
  });

  // ==========================================================================
  // AC-4: 컴파일 통과 · 크래시 없음
  // ==========================================================================

  it("AC-4a[P0]: 챌린지·지출 데이터가 없어도 location.state 없이 크래시 없이 렌더된다", async () => {
    const Challenge = (await import("@/pages/Challenge")).default;

    expect(() =>
      renderWithRouter(React.createElement(Challenge), { initialEntries: ["/challenge"] }),
    ).not.toThrow();

    expect(screen.queryAllByTestId("challenge-active-card").length).toBe(0);
  });

  it("AC-4b[P0]: Challenge의 default export는 함수 컴포넌트다", async () => {
    const Challenge = (await import("@/pages/Challenge")).default;
    expect(typeof Challenge).toBe("function");
  });
});
