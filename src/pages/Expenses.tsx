import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Top, Tab, Button, AlertDialog, ListRow, Toast, Spacing } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Amount } from "@/components/Amount";
import { EmptyState, LoadingState } from "@/components/StateView";
import { getExpenses, deleteExpense } from "@/lib/storage/expenses";
import { getThisWeek, getThisMonth } from "@/lib/domain/aggregate";
import type { Expense, RouteState } from "@/lib/types";

const PAGE_SIZE = 300;
const PERIODS = ["이번 주", "이번 달", "전체"] as const;

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function Expenses() {
  const navigate = useNavigate();
  const routeState = (useLocation().state as RouteState["/expenses"]) ?? null;

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [periodIndex, setPeriodIndex] = useState(1);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(!!routeState?.added);

  useEffect(() => {
    setExpenses(getExpenses());
    setLoading(false);
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [periodIndex]);

  useEffect(() => {
    if (!toastOpen) return;
    const t = setTimeout(() => setToastOpen(false), 2000);
    return () => clearTimeout(t);
  }, [toastOpen]);

  const range = periodIndex === 0 ? getThisWeek() : periodIndex === 1 ? getThisMonth() : null;
  const filtered = [...expenses]
    .filter((e) => !range || (e.timestamp >= range.start && e.timestamp <= range.end))
    .sort((a, b) => b.timestamp - a.timestamp);
  const periodTotal = filtered.reduce((sum, e) => sum + e.amount, 0);
  const visible = filtered.slice(0, visibleCount);
  const isEmpty = !loading && filtered.length === 0;

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteExpense(deleteId);
    setExpenses(getExpenses());
    setDeleteId(null);
  };

  return (
    <ScreenScaffold
      top={
        <Top
          title={<Top.TitleParagraph>지출 내역</Top.TitleParagraph>}
          right={
            <Button variant="weak" size="small" onClick={() => navigate("/add")}>
              추가
            </Button>
          }
        />
      }
    >
      <Spacing size={8} />
      <Tab onChange={(i) => setPeriodIndex(i)}>
        {PERIODS.map((label, i) => (
          <Tab.Item key={label} selected={periodIndex === i} onClick={() => setPeriodIndex(i)}>
            {label}
          </Tab.Item>
        ))}
      </Tab>

      <Spacing size={12} />
      <Amount value={periodTotal} unit="원" typography="t3" testId="period-total-amount" />

      <Spacing size={12} />
      {loading && <LoadingState rows={3} testId="expenses-loading" />}

      {isEmpty && (
        <EmptyState
          testId="expenses-empty"
          title="아직 지출이 없어요"
          description="문자를 붙여넣어 시작하세요"
          action={
            <Button
              variant="weak"
              display="block"
              style={{ minHeight: 44 }}
              onClick={() => navigate("/add")}
            >
              지출 추가
            </Button>
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <div data-testid="expenses-list">
          {visible.map((e) => (
            <ListRow
              key={e.id}
              data-testid={`expense-row-${e.id}`}
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={e.merchant || e.category}
                  bottom={`${e.category} · ${fmtDate(e.timestamp)}`}
                />
              }
              right={<Amount value={e.amount} unit="원" typography="t5" />}
              onClick={() => setDeleteId(e.id)}
            />
          ))}
          {visible.length < filtered.length && (
            <>
              <Spacing size={12} />
              <Button
                variant="weak"
                display="block"
                style={{ minHeight: 44 }}
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                더 보기
              </Button>
            </>
          )}
        </div>
      )}

      <Spacing size={24} />
      <AlertDialog
        open={!!deleteId}
        title="삭제할까요?"
        description="이 지출 기록을 지워요."
        onClose={() => setDeleteId(null)}
        alertButton={<AlertDialog.AlertButton onClick={confirmDelete}>삭제</AlertDialog.AlertButton>}
      />
      <Toast open={toastOpen} text="지출이 저장됐어요" position="bottom" />
    </ScreenScaffold>
  );
}
