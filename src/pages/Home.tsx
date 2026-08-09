import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Button } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { Card } from '@/components/Card';
import { Amount } from '@/components/Amount';
import { CountUp } from '@/components/CountUp';
import { MiniBar } from '@/components/MiniBar';
import { AdSlot } from '@/components/AdSlot';
import { EmptyState, LoadingState } from '@/components/StateView';
import { getExpenses } from '@/lib/storage/expenses';
import { aggregateByCategory, getThisMonth } from '@/lib/domain/aggregate';
import type { Expense } from '@/lib/types';

const RECENT_LIMIT = 5;
const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? 'home-recent-banner';

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    setExpenses(getExpenses());
    setLoading(false);
  }, []);

  const { start, end } = getThisMonth();
  const monthExpenses = expenses.filter((e) => e.timestamp >= start && e.timestamp <= end);
  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const breakdown = aggregateByCategory(monthExpenses).slice(0, 3);
  const recent = [...expenses].sort((a, b) => b.timestamp - a.timestamp).slice(0, RECENT_LIMIT);
  const isEmpty = !loading && monthExpenses.length === 0;

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>이번 달 소비</Top.TitleParagraph>} />}>
      {loading && <LoadingState rows={3} testId="home-loading" />}

      {isEmpty && (
        <>
          <Spacing size={24} />
          <EmptyState
            title="아직 지출이 없어요"
            description="문자를 붙여넣어 시작하세요"
            action={
              <Button
                variant="weak"
                display="block"
                style={{ minHeight: 44 }}
                data-testid="home-add-expense-cta"
                onClick={() => navigate('/add')}
              >
                지출 추가
              </Button>
            }
          />
        </>
      )}

      {!loading && !isEmpty && (
        <>
          <SummaryHero
            label="이번 달 총지출"
            value={<CountUp value={monthTotal} unit="원" typography="t1" />}
            caption="지난달보다 8% 적게 썼어요"
            testId="month-total-hero"
          />

          <Spacing size={24} />
          <Paragraph.Text typography="t4">카테고리 비중</Paragraph.Text>
          <Spacing size={12} />
          <div data-testid="category-breakdown" onClick={() => navigate('/expenses')}>
            {breakdown.map((b) => (
              <ListRow
                key={b.category}
                contents={<ListRow.Texts type="2RowTypeA" top={b.category} bottom={<MiniBar ratio={b.ratio} />} />}
                right={<Amount value={b.amount} unit="원" typography="t5" />}
              />
            ))}
          </div>

          <Spacing size={16} />
          <AdSlot adGroupId={AD_GROUP_ID} />
          <Spacing size={16} />

          <Paragraph.Text typography="t4">최근 지출</Paragraph.Text>
          <Spacing size={12} />
          <Card testId="home-recent-expenses">
            {recent.length === 0 ? (
              <Paragraph.Text typography="t6">최근 기록된 지출이 없어요</Paragraph.Text>
            ) : (
              recent.map((e) => (
                <ListRow
                  key={e.id}
                  contents={<ListRow.Texts type="2RowTypeA" top={e.merchant || e.category} bottom={e.category} />}
                  right={<Amount value={e.amount} unit="원" typography="t5" />}
                  onClick={() => navigate('/expenses')}
                />
              ))
            )}
          </Card>

          <Spacing size={16} />
          <Button variant="weak" display="block" onClick={() => navigate('/report')}>
            리포트 보기
          </Button>
          <Spacing size={24} />
        </>
      )}
    </ScreenScaffold>
  );
}
