import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { patchProfile, getProfile } from "@/lib/storage/profile";
import { AINoticeGate } from "@/components/AINoticeGate";

/**
 * Packet 0016: AI 최초 이용 고지 게이트
 *
 * AC-1: 미확인 상태에서 AI 기능 최초 진입 시 AlertDialog 1회 표시
 * AC-2: 확인 후 patchProfile(aiNoticeAcknowledged:true) 반영, 재진입 시 미표시
 */

mockAll();

describe("AINoticeGate — AI 최초 이용 고지", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("AC-1[P0]: 미확인 상태(aiNoticeAcknowledged:false)면 AlertDialog가 열리고 children도 함께 렌더된다", () => {
    patchProfile({ onboarded: true, aiNoticeAcknowledged: false });

    renderWithRouter(
      React.createElement(AINoticeGate, null, React.createElement("div", { "data-testid": "ai-content" }, "AI 결과")),
    );

    expect(screen.getByRole("alertdialog", { name: "AI 활용 안내" })).toBeInTheDocument();
    expect(screen.getByText(/생성형 AI로 소비 진단 결과를 제공해요/)).toBeInTheDocument();
    expect(screen.getByTestId("ai-content")).toBeInTheDocument();
  });

  it("AC-2[P0]: 확인 클릭 시 patchProfile(aiNoticeAcknowledged:true)가 저장되고 다이얼로그가 닫힌다", () => {
    patchProfile({ onboarded: true, aiNoticeAcknowledged: false });

    renderWithRouter(
      React.createElement(AINoticeGate, null, React.createElement("div", null, "AI 결과")),
    );

    fireEvent.click(screen.getByText("확인"));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(getProfile().aiNoticeAcknowledged).toBe(true);
  });

  it("AC-3[P0]: 이미 확인한 상태(aiNoticeAcknowledged:true)면 다이얼로그 없이 children만 렌더된다", () => {
    patchProfile({ onboarded: true, aiNoticeAcknowledged: true });

    renderWithRouter(
      React.createElement(AINoticeGate, null, React.createElement("div", { "data-testid": "ai-content" }, "AI 결과")),
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-content")).toBeInTheDocument();
  });
});
