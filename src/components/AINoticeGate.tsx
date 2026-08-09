import type { ReactNode } from "react";
import { AlertDialog } from "@toss/tds-mobile";
import { useAiNotice } from "@/hooks/useAiNotice";

const AI_NOTICE_TITLE = "AI 활용 안내";
const AI_NOTICE_DESCRIPTION =
  "이 서비스는 생성형 AI로 소비 진단 결과를 제공해요. 결과는 참고용이에요.";

interface AINoticeGateProps {
  children: ReactNode;
}

/**
 * AI 기능(리포트/벤치마크) 최초 사용 시 생성형 AI 고지를 1회 표시한다.
 * 확인 시 profile.aiNoticeAcknowledged=true로 저장되어 이후 재표시되지 않는다.
 */
export function AINoticeGate({ children }: AINoticeGateProps) {
  const { show, acknowledge } = useAiNotice();

  return (
    <>
      {children}
      <AlertDialog
        open={show}
        title={AI_NOTICE_TITLE}
        description={AI_NOTICE_DESCRIPTION}
        alertButton={<AlertDialog.AlertButton onClick={acknowledge}>확인</AlertDialog.AlertButton>}
        onClose={() => {}}
      />
    </>
  );
}
