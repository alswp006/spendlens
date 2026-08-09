import { useEffect, useMemo, useState } from "react";
import { Top, Spacing, ListRow, Chip, ChipItem, TextField, Toast, Badge, Paragraph, Asset } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { Amount } from "@/components/Amount";
import { MiniBar } from "@/components/MiniBar";
import { SubmitFooter } from "@/components/BottomCTA";
import { EmptyState } from "@/components/StateView";
import { getExpenses } from "@/lib/storage/expenses";
import { getChallenges, saveChallenge, updateChallenge } from "@/lib/storage/challenges";
import { baselineAmount, computeProgress, recomputeChallenge } from "@/lib/domain/challenge";
import { formatKRW } from "@/lib/format";
import type { Category, SavingChallenge } from "@/lib/types";

const CATEGORIES: Category[] = [
  "식비",
  "카페/간식",
  "배달",
  "교통",
  "쇼핑",
  "구독",
  "문화/여가",
  "기타",
];

const STATUS_LABEL: Record<SavingChallenge["status"], string> = {
  active: "진행중",
  completed: "완료",
  failed: "실패",
};

const STATUS_COLOR: Record<SavingChallenge["status"], "blue" | "green" | "red"> = {
  active: "blue",
  completed: "green",
  failed: "red",
};

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `chal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Challenge() {
  const expenses = useMemo(() => getExpenses(), []);
  const [challenges, setChallenges] = useState<SavingChallenge[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ open: boolean; text: string }>({ open: false, text: "" });

  useEffect(() => {
    const raw = getChallenges();
    const recomputed = raw.map((c) => recomputeChallenge(c, expenses));
    recomputed.forEach((c, i) => {
      if (c.currentSpent !== raw[i].currentSpent || c.status !== raw[i].status) {
        updateChallenge(c.id, { currentSpent: c.currentSpent, status: c.status });
      }
    });
    setChallenges(recomputed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeChallenges = challenges.filter((c) => c.status === "active");
  const baseline = category ? baselineAmount(expenses, category) : 0;

  function handleStart() {
    if (!category) return;
    const target = Number(targetInput);

    if (!target || target <= 0 || target > baseline) {
      setError(`목표는 1원 이상 최근 지출(${formatKRW(baseline)}) 이하로 설정해주세요`);
      return;
    }

    const duplicate = challenges.find((c) => c.category === category && c.status === "active");
    if (duplicate) {
      setToast({ open: true, text: `이미 진행 중인 ${category} 챌린지가 있어요` });
      return;
    }

    const challenge: SavingChallenge = {
      id: generateId(),
      category,
      baselineAmount: baseline,
      targetAmount: target,
      monthStart: Date.now(),
      currentSpent: 0,
      status: "active",
    };
    saveChallenge(challenge);
    setChallenges((prev) => [...prev, challenge]);
    setError(null);
    setCategory(null);
    setTargetInput("");
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>절약 챌린지</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label="챌린지 시작"
          onClick={handleStart}
          disabled={!category || !targetInput}
          testId="challenge-submit"
        />
      }
    >
      <Card>
        <Chip kind="select" wrap>
          {CATEGORIES.map((c) => (
            <ChipItem
              key={c}
              selected={category === c}
              onClick={() => {
                setCategory(c);
                setError(null);
                setToast({ open: false, text: "" });
              }}
            >
              {c}
            </ChipItem>
          ))}
        </Chip>
        <Spacing size={12} />
        <TextField
          variant="box"
          label="목표 금액"
          placeholder="목표 금액을 입력해 주세요"
          inputMode="numeric"
          hasError={!!error}
          help={error ?? undefined}
          value={targetInput}
          onChange={(e) => {
            setTargetInput(e.target.value.replace(/[^0-9]/g, ""));
            setError(null);
          }}
        />
        {category && (
          <>
            <Spacing size={8} />
            <Paragraph.Text typography="st13">
              최근 30일 실지출 {formatKRW(baseline)}
            </Paragraph.Text>
          </>
        )}
      </Card>

      <Spacing size={24} />

      {activeChallenges.length === 0 ? (
        <EmptyState
          testId="challenge-empty"
          icon={
            <Asset.ContentIcon name="iconFlagRegular" alt="챌린지" style={{ width: 64, height: 64 }} />
          }
          title="절약 목표를 세워보세요"
          description="카테고리를 고르고 목표 금액을 정해보세요"
        />
      ) : (
        activeChallenges.map((c) => {
          const { percent, remaining } = computeProgress(c);
          return (
            <div key={c.id}>
              <Card testId="challenge-active-card">
                <ListRow
                  contents={
                    <ListRow.Texts
                      type="2RowTypeA"
                      top={c.category}
                      bottom={`${c.currentSpent}원 사용 / 목표 ${c.targetAmount}원`}
                    />
                  }
                  right={<Badge size="small" variant="weak" color={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</Badge>}
                />
                <Spacing size={8} />
                <div data-testid="challenge-progress">
                  <MiniBar ratio={percent / 100} />
                  <Spacing size={4} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Paragraph.Text typography="st13">{percent}%</Paragraph.Text>
                    <Amount value={remaining} unit="원 남음" typography="st13" />
                  </div>
                </div>
              </Card>
              <Spacing size={12} />
            </div>
          );
        })
      )}

      <Toast open={toast.open} text={toast.text} position="bottom" onClose={() => setToast({ open: false, text: "" })} />
    </ScreenScaffold>
  );
}
