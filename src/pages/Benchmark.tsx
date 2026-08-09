import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Top, Spacing, ListRow, Button, Badge, Toast, Asset } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { AINoticeGate } from "@/components/AINoticeGate";
import { Card } from "@/components/Card";
import { Amount } from "@/components/Amount";
import { MiniBar } from "@/components/MiniBar";
import { EmptyState, LoadingState } from "@/components/StateView";
import { getProfile } from "@/lib/storage/profile";
import { getExpenses } from "@/lib/storage/expenses";
import { getBenchmark, saveBenchmark } from "@/lib/storage/benchmark";
import { aggregateByCategory } from "@/lib/domain/aggregate";
import { fetchBenchmark } from "@/lib/api/client";
import type { BenchmarkResult, Expense, UserProfile } from "@/lib/types";

const FETCH_ERROR_TEXT = "벤치마크 조회에 실패해 이전 결과를 보여드려요";

function formatDiffRatio(ratio: number): string {
  const pct = Math.round(ratio * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function BenchmarkSummary({
  profile,
  expenses,
}: {
  profile: UserProfile;
  expenses: Expense[];
}) {
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(() => getBenchmark());
  const [toast, setToast] = useState<{ open: boolean; text: string }>({ open: false, text: "" });

  useEffect(() => {
    let cancelled = false;
    const myAmounts = aggregateByCategory(expenses);

    (async () => {
      try {
        const res = await fetchBenchmark({
          ageBand: profile.ageBand,
          incomeBand: profile.incomeBand,
          categories: myAmounts.map((a) => ({ category: a.category, amount: a.amount })),
        });

        const newBenchmark: BenchmarkResult = {
          ageBand: profile.ageBand,
          incomeBand: profile.incomeBand,
          categories: res.categories.map((c) => ({
            category: c.category,
            myAmount: myAmounts.find((a) => a.category === c.category)?.amount ?? 0,
            peerAvg: c.peerAvg,
            diffRatio: c.diffRatio,
          })),
          generatedAt: Date.now(),
        };
        saveBenchmark(newBenchmark);
        if (!cancelled) setBenchmark(newBenchmark);
      } catch {
        if (!cancelled) setToast({ open: true, text: FETCH_ERROR_TEXT });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {!benchmark ? (
        <LoadingState rows={3} testId="benchmark-loading" />
      ) : (
        <div data-testid="benchmark-summary">
          <Badge size="small" variant="weak" color="blue">
            AI가 생성한 결과입니다
          </Badge>
          <Spacing size={12} />
          {benchmark.categories.map((c) => {
            const maxAmt = Math.max(c.myAmount, c.peerAvg, 1);
            return (
              <div key={c.category}>
                <Card testId="benchmark-category">
                  <ListRow
                    contents={
                      <ListRow.Texts
                        type="2RowTypeA"
                        top={c.category}
                        bottom={
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <MiniBar ratio={c.myAmount / maxAmt} />
                            <MiniBar ratio={c.peerAvg / maxAmt} />
                          </div>
                        }
                      />
                    }
                    right={
                      <Badge size="small" variant="weak" color={c.diffRatio > 0 ? "red" : "green"}>
                        {formatDiffRatio(c.diffRatio)}
                      </Badge>
                    }
                  />
                  <Spacing size={8} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Amount value={c.myAmount} unit="원" typography="st13" />
                    <Amount value={c.peerAvg} unit="원" typography="st13" />
                  </div>
                </Card>
                <Spacing size={12} />
              </div>
            );
          })}
        </div>
      )}
      <Toast open={toast.open} text={toast.text} position="bottom" />
    </>
  );
}

export default function Benchmark() {
  const navigate = useNavigate();
  const [profile] = useState(() => getProfile());
  const [expenses] = useState(() => getExpenses());

  const hasBands = !!profile.ageBand && !!profile.incomeBand;

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>또래 비교</Top.TitleParagraph>} />}>
      {!profile.isPremium ? (
        <>
          <Spacing size={24} />
          <EmptyState
            testId="benchmark-locked"
            icon={
              <Asset.ContentIcon name="iconLockRegular" alt="잠김" style={{ width: 64, height: 64 }} />
            }
            title="프리미엄에서 또래와 비교해요"
            description="비슷한 나이대·소득대 평균과 내 지출을 비교해 드려요"
            action={
              <Button
                variant="fill"
                display="block"
                onClick={() => navigate("/premium", { state: { from: "benchmark" } })}
              >
                구독하고 비교하기
              </Button>
            }
          />
        </>
      ) : !hasBands ? (
        <>
          <Spacing size={24} />
          <EmptyState
            testId="benchmark-band-required"
            icon={
              <Asset.ContentIcon name="iconProfileRegular" alt="프로필" style={{ width: 64, height: 64 }} />
            }
            title="연령대·소득대를 설정해 주세요"
            description="프로필을 설정하면 또래 평균과 비교할 수 있어요"
            action={
              <Button variant="fill" display="block" onClick={() => navigate("/settings")}>
                프로필 설정
              </Button>
            }
          />
        </>
      ) : (
        <AINoticeGate>
          <BenchmarkSummary profile={profile} expenses={expenses} />
        </AINoticeGate>
      )}
    </ScreenScaffold>
  );
}
