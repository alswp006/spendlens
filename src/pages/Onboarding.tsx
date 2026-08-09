import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Top, Paragraph, Spacing, Chip, ChipItem, AlertDialog } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { getProfile, patchProfile } from "@/lib/storage/profile";
import type { AgeBand, IncomeBand } from "@/lib/types";

const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: "25-30", label: "25-30세" },
  { value: "31-34", label: "31-34세" },
  { value: "35-38", label: "35-38세" },
];

const INCOME_BANDS: { value: IncomeBand; label: string }[] = [
  { value: "250-350", label: "250-350만 원" },
  { value: "350-450", label: "350-450만 원" },
];

function fireTickHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [incomeBand, setIncomeBand] = useState<IncomeBand | null>(null);
  const [aiNoticeAcknowledged, setAiNoticeAcknowledged] = useState(
    () => getProfile().aiNoticeAcknowledged,
  );

  const canSubmit = ageBand !== null && incomeBand !== null;

  const handleSelectAge = (value: AgeBand) => {
    fireTickHaptic();
    setAgeBand(value);
  };

  const handleSelectIncome = (value: IncomeBand) => {
    fireTickHaptic();
    setIncomeBand(value);
  };

  const handleSubmit = () => {
    if (!ageBand || !incomeBand) return;
    patchProfile({ ageBand, incomeBand, onboarded: true });
    navigate("/", { replace: true });
  };

  const handleAckAiNotice = () => {
    patchProfile({ aiNoticeAcknowledged: true });
    setAiNoticeAcknowledged(true);
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>SpendLens 시작하기</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label="시작하기"
          onClick={handleSubmit}
          disabled={!canSubmit}
          testId="onboarding-cta"
        />
      }
    >
      <Spacing size={16} />
      <Paragraph.Text typography="t3">연령대를 골라주세요</Paragraph.Text>
      <Spacing size={12} />
      <Chip kind="select" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {AGE_BANDS.map((band) => (
          <ChipItem
            key={band.value}
            selected={ageBand === band.value}
            onClick={() => handleSelectAge(band.value)}
          >
            {band.label}
          </ChipItem>
        ))}
      </Chip>
      <Spacing size={24} />
      <Paragraph.Text typography="t3">월 소득 구간을 골라주세요</Paragraph.Text>
      <Spacing size={12} />
      <Chip kind="select" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {INCOME_BANDS.map((band) => (
          <ChipItem
            key={band.value}
            selected={incomeBand === band.value}
            onClick={() => handleSelectIncome(band.value)}
          >
            {band.label}
          </ChipItem>
        ))}
      </Chip>
      <AlertDialog
        open={!aiNoticeAcknowledged}
        title="AI 활용 안내"
        description="이 서비스는 생성형 AI로 소비 진단 결과를 제공해요. 결과는 참고용이에요."
        alertButton={
          <AlertDialog.AlertButton onClick={handleAckAiNotice}>확인</AlertDialog.AlertButton>
        }
      />
    </ScreenScaffold>
  );
}
