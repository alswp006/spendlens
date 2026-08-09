import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { patchProfile } from "@/lib/storage/profile";

/**
 * Settings 페이지 — 프로필 수정 / 프리미엄 이동 / AI 고지 재확인
 * (PDF 내보내기 게이트·인쇄 뷰는 src/__tests__/packet-0013.test.ts가 이미 커버)
 */

mockAll();

describe("Settings 페이지 — 프로필/프리미엄/AI 고지", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
  });

  it("프로필 ListRow 탭 시 연령대/소득대 수정 BottomSheet가 열린다", async () => {
    patchProfile({ onboarded: true });
    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings));

    fireEvent.click(screen.getByText("프로필"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("BottomSheet에서 연령대를 바꾸면 프로필 표시가 즉시 갱신된다", async () => {
    patchProfile({ onboarded: true, ageBand: "25-30" });
    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings));

    fireEvent.click(screen.getByText("프로필"));
    fireEvent.click(screen.getByText("31-34세"));

    expect(screen.getByText(/31-34세 ·/)).toBeInTheDocument();
  });

  it("무료 사용자는 프리미엄 ListRow 클릭 시 /premium으로 이동한다", async () => {
    patchProfile({ onboarded: true, isPremium: false });
    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings));

    fireEvent.click(screen.getByText("프리미엄 보기"));

    expect(mockNavigate).toHaveBeenCalledWith("/premium", { state: { from: "settings" } });
  });

  it("AI 활용 안내 다시 보기 클릭 시 AlertDialog가 다시 열리고 확인하면 닫힌다", async () => {
    patchProfile({ onboarded: true, aiNoticeAcknowledged: true });
    const Settings = (await import("@/pages/Settings")).default;
    renderWithRouter(React.createElement(Settings));

    fireEvent.click(screen.getByText("AI 활용 안내 다시 보기"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByText("확인"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
