import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, within, waitFor, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { patchProfile, getProfile } from "@/lib/storage/profile";
import { IAP } from "@apps-in-toss/web-framework";

/**
 * Packet 0012: Premium 페이지 — /premium
 *
 * AC-1: 결제 성공 시 isPremium:true, premiumUntil=결제시각+30일 저장 + "프리미엄이 활성화됐어요" 토스트
 *       + location.state.from(?? null) 있으면 navigate(from), 없으면 navigate('/report')
 * AC-2: 결제 취소/실패 시 프로필 불변 + "결제가 취소됐어요" 토스트 + navigate 미호출(화면 유지)
 * AC-3: 활성 상태(isPremium && premiumUntil>now)면 "프리미엄 이용 중 · ~yyyy.mm.dd" 상태 카드 표시 +
 *       결제 버튼(data-testid="premium-cta") 숨김. 결제 중에는 버튼이 loading(aria-busy) 상태.
 * AC-4: location.state 없이 진입해도 크래시 없음(from ?? null 폴백) · data-testid="premium-cta" 존재 · 컴파일 통과
 *
 * Implementation target: src/pages/Premium.tsx (App.tsx가 이미 /premium에 연결)
 *
 * 테스트가 요구하는 testid/문구 규약 (Coder가 구현 시 준수):
 *   - data-testid="premium-cta"        : 결제 버튼(또는 이를 감싼 컨테이너) — 무료 사용자에게만 노출
 *   - 결제 성공 토스트 문구: "프리미엄이 활성화됐어요"
 *   - 결제 취소 토스트 문구: "결제가 취소됐어요"
 *   - 활성 상태 카드 문구: "프리미엄 이용 중"과 만료일 "yyyy.mm.dd"(0패딩) 포함
 */

mockAll();

function formatDateDot(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

describe("Premium 페이지 — /premium", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
    vi.mocked(IAP.createOneTimePurchaseOrder).mockClear();
  });

  // ==========================================================================
  // AC-1: 결제 성공 저장·토스트·이동
  // ==========================================================================

  it("AC-1a[P0]: 결제 성공 시 isPremium:true·premiumUntil=+30일 저장 후 토스트를 표시한다", async () => {
    patchProfile({ onboarded: true, isPremium: false, premiumUntil: null });
    const before = Date.now();

    const Premium = (await import("@/pages/Premium")).default;
    renderWithRouter(React.createElement(Premium), { initialEntries: ["/premium"] });

    const cta = screen.getByTestId("premium-cta");
    fireEvent.click(within(cta).getByRole("button"));

    await waitFor(() =>
      expect(screen.getByText("프리미엄이 활성화됐어요")).toBeInTheDocument(),
    );

    const saved = getProfile();
    expect(saved.isPremium).toBe(true);
    expect(saved.premiumUntil).not.toBeNull();
    expect(saved.premiumUntil as number).toBeGreaterThanOrEqual(before + THIRTY_DAYS_MS - 5000);
    expect(saved.premiumUntil as number).toBeLessThanOrEqual(Date.now() + THIRTY_DAYS_MS + 5000);
  });

  it("AC-1b[P0]: location.state.from이 있으면 결제 후 해당 경로로 이동한다", async () => {
    patchProfile({ onboarded: true, isPremium: false, premiumUntil: null });

    const Premium = (await import("@/pages/Premium")).default;
    renderWithRouter(React.createElement(Premium), {
      initialEntries: [{ pathname: "/premium", state: { from: "/challenge" } }],
    });

    fireEvent.click(within(screen.getByTestId("premium-cta")).getByRole("button"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/challenge"));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("AC-1c[P0]: location.state.from이 없으면 결제 후 /report로 이동한다", async () => {
    patchProfile({ onboarded: true, isPremium: false, premiumUntil: null });

    const Premium = (await import("@/pages/Premium")).default;
    renderWithRouter(React.createElement(Premium), { initialEntries: ["/premium"] });

    fireEvent.click(within(screen.getByTestId("premium-cta")).getByRole("button"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/report"));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // AC-2: 결제 취소/실패 시 불변·토스트
  // ==========================================================================

  it("AC-2[P0]: 결제가 취소되면 프로필이 바뀌지 않고 취소 토스트를 표시하며 이동하지 않는다", async () => {
    patchProfile({ onboarded: true, isPremium: false, premiumUntil: null });

    vi.mocked(IAP.createOneTimePurchaseOrder).mockImplementationOnce((opts: any) => {
      opts.onError?.({ code: "USER_CANCELED" });
      return () => {};
    });

    const Premium = (await import("@/pages/Premium")).default;
    renderWithRouter(React.createElement(Premium), { initialEntries: ["/premium"] });

    fireEvent.click(within(screen.getByTestId("premium-cta")).getByRole("button"));

    await waitFor(() =>
      expect(screen.getByText("결제가 취소됐어요")).toBeInTheDocument(),
    );

    const saved = getProfile();
    expect(saved.isPremium).toBe(false);
    expect(saved.premiumUntil).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // AC-3: 활성 상태 카드/버튼 숨김 + 결제 중 loading
  // ==========================================================================

  it("AC-3a[P0]: 프리미엄이 활성 상태면 만료일 상태 카드를 보여주고 결제 버튼을 숨긴다", async () => {
    const premiumUntil = Date.now() + TEN_DAYS_MS;
    patchProfile({ onboarded: true, isPremium: true, premiumUntil });

    const Premium = (await import("@/pages/Premium")).default;
    renderWithRouter(React.createElement(Premium), { initialEntries: ["/premium"] });

    expect(screen.getByText(/프리미엄 이용 중/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatDateDot(premiumUntil).replace(/\./g, "\\.")))).toBeInTheDocument();
    expect(screen.queryByTestId("premium-cta")).toBeNull();
  });

  it("AC-3b[P0]: 결제 진행 중에는 버튼이 loading(aria-busy) 상태로 비활성화된다", async () => {
    patchProfile({ onboarded: true, isPremium: false, premiumUntil: null });

    const Premium = (await import("@/pages/Premium")).default;
    renderWithRouter(React.createElement(Premium), { initialEntries: ["/premium"] });

    const button = within(screen.getByTestId("premium-cta")).getByRole("button");
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();

    // 결제 흐름이 끝날 때까지 대기해 타이머가 테스트 밖으로 새지 않도록 정리
    await waitFor(() =>
      expect(screen.getByText("프리미엄이 활성화됐어요")).toBeInTheDocument(),
    );
  });

  // ==========================================================================
  // AC-4: state 없이 진입해도 크래시 없음 · testid · 컴파일 통과
  // ==========================================================================

  it("AC-4a[P0]: location.state 없이 진입해도 크래시 없이 렌더되고 premium-cta가 보인다", async () => {
    const Premium = (await import("@/pages/Premium")).default;

    expect(() =>
      renderWithRouter(React.createElement(Premium), { initialEntries: ["/premium"] }),
    ).not.toThrow();

    expect(screen.getByTestId("premium-cta")).toBeInTheDocument();
    expect(screen.queryByText(/프리미엄 이용 중/)).toBeNull();
  });

  it("AC-4b[P0]: Premium의 default export는 함수 컴포넌트다", async () => {
    const Premium = (await import("@/pages/Premium")).default;
    expect(typeof Premium).toBe("function");
    expect(Premium.length).toBeLessThanOrEqual(1);
  });
});
