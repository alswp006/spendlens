import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Top, Paragraph, Spacing, ListRow, Chip, ChipItem, BottomSheet, AlertDialog, Toast, Badge, Button } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { Amount } from "@/components/Amount";
import { getProfile, patchProfile } from "@/lib/storage/profile";
import { getReports } from "@/lib/storage/reports";
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

const AGE_LABEL: Record<AgeBand, string> = Object.fromEntries(
  AGE_BANDS.map((b) => [b.value, b.label]),
) as Record<AgeBand, string>;

const INCOME_LABEL: Record<IncomeBand, string> = Object.fromEntries(
  INCOME_BANDS.map((b) => [b.value, b.label]),
) as Record<IncomeBand, string>;

const AI_NOTICE_TEXT = "이 서비스는 생성형 AI로 소비 진단 결과를 제공해요. 결과는 참고용이에요.";

export default function Settings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(() => getProfile());
  const [reports] = useState(() => getReports());
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [aiNoticeOpen, setAiNoticeOpen] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; text: string }>({ open: false, text: "" });

  const latestReport = reports.length
    ? [...reports].sort((a, b) => b.generatedAt - a.generatedAt)[0]
    : null;
  const canExportPdf = profile.isPremium && !!latestReport;
  const isPremiumActive =
    profile.isPremium && !!profile.premiumUntil && profile.premiumUntil > Date.now();

  function handleSelectAge(value: AgeBand) {
    setProfile(patchProfile({ ageBand: value }));
  }

  function handleSelectIncome(value: IncomeBand) {
    setProfile(patchProfile({ incomeBand: value }));
  }

  function handleExportPdf() {
    if (!latestReport) {
      setToast({ open: true, text: "내보낼 리포트가 없어요" });
      return;
    }
    if (!profile.isPremium) {
      setToast({ open: true, text: "프리미엄 구독 후 PDF로 저장할 수 있어요" });
      return;
    }
    window.print();
  }

  function handleAckAiNotice() {
    setProfile(patchProfile({ aiNoticeAcknowledged: true }));
    setAiNoticeOpen(false);
  }

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>설정</Top.TitleParagraph>} />}>
      <Spacing size={8} />

      <Card>
        <ListRow
          onClick={() => setProfileSheetOpen(true)}
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="프로필"
              bottom={`${AGE_LABEL[profile.ageBand]} · ${INCOME_LABEL[profile.incomeBand]}`}
            />
          }
        />
      </Card>

      <Spacing size={16} />

      <Card>
        <ListRow
          onClick={isPremiumActive ? undefined : () => navigate("/premium", { state: { from: "settings" } })}
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="프리미엄"
              bottom={isPremiumActive ? "이용 중이에요" : "프리미엄 보기"}
            />
          }
        />
        <div data-testid="settings-export-pdf">
          <ListRow
            contents={<ListRow.Texts type="2RowTypeA" top="PDF 리포트 저장" bottom="이번 달 리포트를 인쇄해요" />}
            right={
              <Button variant="weak" onClick={handleExportPdf}>
                저장
              </Button>
            }
          />
        </div>
        <ListRow
          onClick={() => setAiNoticeOpen(true)}
          contents={<ListRow.Texts type="1RowTypeA" top="AI 활용 안내 다시 보기" />}
        />
      </Card>

      <BottomSheet
        open={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
        header={<BottomSheet.Header>프로필 수정</BottomSheet.Header>}
      >
        <Spacing size={12} />
        <Paragraph.Text typography="t5">연령대</Paragraph.Text>
        <Spacing size={8} />
        <Chip kind="select" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {AGE_BANDS.map((band) => (
            <ChipItem
              key={band.value}
              selected={profile.ageBand === band.value}
              onClick={() => handleSelectAge(band.value)}
            >
              {band.label}
            </ChipItem>
          ))}
        </Chip>
        <Spacing size={20} />
        <Paragraph.Text typography="t5">월 소득 구간</Paragraph.Text>
        <Spacing size={8} />
        <Chip kind="select" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INCOME_BANDS.map((band) => (
            <ChipItem
              key={band.value}
              selected={profile.incomeBand === band.value}
              onClick={() => handleSelectIncome(band.value)}
            >
              {band.label}
            </ChipItem>
          ))}
        </Chip>
        <Spacing size={16} />
      </BottomSheet>

      <AlertDialog
        open={aiNoticeOpen}
        title="AI 활용 안내"
        description={AI_NOTICE_TEXT}
        alertButton={<AlertDialog.AlertButton onClick={handleAckAiNotice}>확인</AlertDialog.AlertButton>}
        onClose={() => setAiNoticeOpen(false)}
      />

      <Toast
        open={toast.open}
        text={toast.text}
        position="bottom"
        onClose={() => setToast({ open: false, text: "" })}
      />

      {canExportPdf && latestReport ? (
        <div data-testid="settings-print-view" className="settings-print-view">
          <Badge size="small" variant="weak" color="blue">
            AI가 생성한 결과입니다
          </Badge>
          <Spacing size={8} />
          <Paragraph.Text typography="t3">이번 달 지출 리포트</Paragraph.Text>
          <Spacing size={4} />
          <Amount value={latestReport.totalSpent} unit="원" typography="t2" />
        </div>
      ) : null}

      <style>{`
        .settings-print-view { display: none; }
        @media print {
          .settings-print-view { display: block; }
        }
      `}</style>
    </ScreenScaffold>
  );
}
