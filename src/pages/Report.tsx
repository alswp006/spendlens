import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Top, Paragraph, Spacing, ListRow, Button, Badge, Toast, Asset } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { AINoticeGate } from "@/components/AINoticeGate";
import { SummaryHero } from "@/components/SummaryHero";
import { Card } from "@/components/Card";
import { Amount } from "@/components/Amount";
import { MiniBar } from "@/components/MiniBar";
import { EmptyState, LoadingState } from "@/components/StateView";
import { TossRewardAd } from "@/components/TossRewardAd";
import { getProfile } from "@/lib/storage/profile";
import { getExpenses } from "@/lib/storage/expenses";
import { getReports, saveReport } from "@/lib/storage/reports";
import { aggregateByCategory, getThisWeek } from "@/lib/domain/aggregate";
import { analyzeWeek } from "@/lib/api/client";
import type { Expense, UserProfile, WeeklyReport } from "@/lib/types";

const AD_SLOT_ID = import.meta.env.VITE_TOSS_AD_SLOT_ID ?? "report-unlock";
const MIN_EXPENSES = 3;
const ANALYZE_ERROR_TEXT = "리포트 분석에 실패해 이전 결과를 보여드려요";

function generateReportId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function latestReport(reports: WeeklyReport[]): WeeklyReport | null {
  if (reports.length === 0) return null;
  return [...reports].sort((a, b) => b.generatedAt - a.generatedAt)[0];
}

function ReportSummary({
  expenses,
  profile,
  weekStart,
  weekEnd,
}: {
  expenses: Expense[];
  profile: UserProfile;
  weekStart: number;
  weekEnd: number;
}) {
  const navigate = useNavigate();
  const [report, setReport] = useState<WeeklyReport | null>(() => latestReport(getReports()));
  const [toast, setToast] = useState<{ open: boolean; text: string }>({ open: false, text: "" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await analyzeWeek({
          expenses: expenses.map((e) => ({
            amount: e.amount,
            category: e.category,
            merchant: e.merchant,
            timestamp: e.timestamp,
          })),
          profile: { ageBand: profile.ageBand, incomeBand: profile.incomeBand },
        });

        const newReport: WeeklyReport = {
          id: generateReportId(),
          weekStart,
          weekEnd,
          totalSpent: expenses.reduce((sum, e) => sum + e.amount, 0),
          categoryBreakdown: aggregateByCategory(expenses),
          insights: res.insights,
          isAi: true,
          generatedAt: Date.now(),
        };
        saveReport(newReport);
        if (!cancelled) setReport(newReport);
      } catch {
        if (!cancelled) setToast({ open: true, text: ANALYZE_ERROR_TEXT });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleInsights = report ? (profile.isPremium ? report.insights : report.insights.slice(0, 1)) : [];
  const hasLocked = !!report && !profile.isPremium && report.insights.length > 1;

  return (
    <>
      {!report ? (
        <LoadingState rows={3} testId="report-loading" />
      ) : (
        <div data-testid="report-summary">
          <SummaryHero
            label="이번 주 총지출"
            value={<Amount value={report.totalSpent} unit="원" typography="t1" testId="report-total-amount" />}
            testId="report-hero"
          />

          <Spacing size={16} />
          <Paragraph.Text typography="t4">카테고리별 지출</Paragraph.Text>
          <Spacing size={12} />
          <Card testId="report-category-breakdown">
            {report.categoryBreakdown.map((b) => (
              <ListRow
                key={b.category}
                contents={<ListRow.Texts type="2RowTypeA" top={b.category} bottom={<MiniBar ratio={b.ratio} />} />}
                right={<Amount value={b.amount} unit="원" typography="t5" />}
              />
            ))}
          </Card>

          <Spacing size={16} />
          {visibleInsights.map((insight, i) => (
            <div key={`${insight.type}-${i}`}>
              <Card testId="report-insight">
                <Badge size="small" variant="weak" color="blue">
                  AI가 생성한 결과입니다
                </Badge>
                <Spacing size={8} />
                <ListRow
                  contents={<ListRow.Texts type="2RowTypeA" top={insight.title} bottom={insight.description} />}
                  right={<Amount value={insight.savingPotential} unit="원" typography="t5" />}
                />
              </Card>
              <Spacing size={12} />
            </div>
          ))}

          {hasLocked && (
            <Card testId="report-locked-insight">
              <Asset.ContentIcon name="iconLockRegular" alt="잠김" style={{ width: 24, height: 24 }} />
              <Spacing size={8} />
              <Paragraph.Text typography="t6">프리미엄으로 전체 인사이트 보기</Paragraph.Text>
              <Spacing size={12} />
              <Button
                variant="fill"
                display="block"
                onClick={() => navigate("/premium", { state: { from: "report" } })}
              >
                구독하고 전체 보기
              </Button>
            </Card>
          )}
        </div>
      )}
      <Toast open={toast.open} text={toast.text} position="bottom" />
    </>
  );
}

export default function Report() {
  const [profile] = useState(() => getProfile());
  const [expenses] = useState(() => getExpenses());
  const { start, end } = getThisWeek();
  const thisWeekExpenses = expenses.filter((e) => e.timestamp >= start && e.timestamp <= end);

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>주간 리포트</Top.TitleParagraph>} />}>
      {thisWeekExpenses.length < MIN_EXPENSES ? (
        <>
          <Spacing size={24} />
          <EmptyState
            testId="report-insufficient"
            title="지출이 3건 이상 필요해요"
            description="이번 주 지출을 3건 이상 기록하면 리포트를 볼 수 있어요"
          />
        </>
      ) : (
        <TossRewardAd slotId={AD_SLOT_ID} description="광고를 보면 이번 주 리포트를 볼 수 있어요">
          <AINoticeGate>
            <ReportSummary expenses={thisWeekExpenses} profile={profile} weekStart={start} weekEnd={end} />
          </AINoticeGate>
        </TossRewardAd>
      )}
    </ScreenScaffold>
  );
}
