import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Top, Paragraph, Spacing, ListRow, Toast, Asset } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { SummaryHero } from "@/components/SummaryHero";
import { TossPurchase } from "@/components/TossPurchase";
import { getProfile, patchProfile } from "@/lib/storage/profile";
import type { RouteState } from "@/lib/types";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const BENEFITS = [
  { icon: "iconDocRegular", title: "심층 리포트", desc: "지출 패턴을 항목별로 자세히 분석해요" },
  { icon: "iconPeopleRegular", title: "또래 벤치마크", desc: "비슷한 또래·소득대와 지출을 비교해요" },
  { icon: "iconFileRegular", title: "PDF 내보내기", desc: "리포트를 PDF로 저장하고 공유해요" },
];

function formatDateDot(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export default function Premium() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as RouteState["/premium"])?.from ?? null;

  const [profile, setProfile] = useState(() => getProfile());
  const [toast, setToast] = useState<{ open: boolean; text: string }>({ open: false, text: "" });

  const isActive = profile.isPremium && !!profile.premiumUntil && profile.premiumUntil > Date.now();

  function handlePurchased() {
    const updated = patchProfile({ isPremium: true, premiumUntil: Date.now() + THIRTY_DAYS_MS });
    setProfile(updated);
    setToast({ open: true, text: "프리미엄이 활성화됐어요" });
    navigate(from ?? "/report");
  }

  function handlePurchaseError() {
    setToast({ open: true, text: "결제가 취소됐어요" });
  }

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>프리미엄</Top.TitleParagraph>} />}>
      <SummaryHero
        label="스펜드렌즈 프리미엄"
        value={<Paragraph.Text typography="t1">월 4,900원</Paragraph.Text>}
        caption="언제든 해지할 수 있어요"
      />

      <Spacing size={24} />

      <Card>
        {BENEFITS.map((b) => (
          <ListRow
            key={b.title}
            left={<Asset.ContentIcon name={b.icon} alt={b.title} style={{ width: 32, height: 32 }} />}
            contents={<ListRow.Texts type="2RowTypeA" top={b.title} bottom={b.desc} />}
          />
        ))}
      </Card>

      <Spacing size={24} />

      {isActive ? (
        <Card testId="premium-status-card">
          <Paragraph.Text typography="t5">프리미엄 이용 중</Paragraph.Text>
          <Spacing size={4} />
          <Paragraph.Text typography="st13">
            ~{formatDateDot(profile.premiumUntil as number)}까지
          </Paragraph.Text>
        </Card>
      ) : (
        <div data-testid="premium-cta">
          <TossPurchase
            sku={import.meta.env.VITE_TOSS_IAP_SKU}
            processProductGrant={async () => true}
            onPurchased={handlePurchased}
            onError={handlePurchaseError}
          >
            프리미엄 시작하기
          </TossPurchase>
        </div>
      )}

      <Toast
        open={toast.open}
        text={toast.text}
        position="bottom"
        onClose={() => setToast({ open: false, text: "" })}
      />
    </ScreenScaffold>
  );
}
