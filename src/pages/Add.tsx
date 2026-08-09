import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Top, Paragraph, Spacing, TextArea, TextField, Button, Chip, ChipItem, Toast } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { parseSmsText } from "@/lib/domain/smsParser";
import { addExpense } from "@/lib/storage/expenses";
import type { Category, RouteState } from "@/lib/types";

const CATEGORIES: Category[] = ["식비", "카페/간식", "배달", "교통", "쇼핑", "구독", "문화/여가", "기타"];

export default function Add() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as RouteState["/add"]) ?? null;

  const [smsText, setSmsText] = useState(routeState?.prefillText ?? "");
  const [amountStr, setAmountStr] = useState("");
  const [merchant, setMerchant] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState<Category>("기타");
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [source, setSource] = useState<"sms" | "manual">("manual");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ open: boolean; text: string }>({ open: false, text: "" });
  const [saving, setSaving] = useState(false);

  const handleAnalyze = () => {
    const parsed = parseSmsText(smsText);
    if (!parsed || !parsed.amount) {
      setToast({ open: true, text: "문자를 인식하지 못했어요. 직접 입력해주세요" });
      return;
    }
    setAmountStr(String(parsed.amount));
    setMerchant(parsed.merchant ?? "");
    setCategory(parsed.category ?? "기타");
    setTimestamp(parsed.timestamp ?? null);
    setSource("sms");
    setAmountError(null);
  };

  const handleSave = () => {
    const amount = Number(amountStr) || 0;
    if (amount <= 0) {
      setAmountError("금액을 1원 이상 입력해주세요");
      return;
    }
    setAmountError(null);
    setSaving(true);
    addExpense({
      amount,
      category,
      merchant,
      memo,
      timestamp: timestamp ?? Date.now(),
      source,
    });
    setToast({ open: true, text: "지출이 추가되었어요" });
    navigate("/expenses", { state: { added: true } as RouteState["/expenses"] });
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>지출 추가</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="저장" onClick={handleSave} disabled={saving} testId="save-expense-btn" />}
    >
      <Spacing size={16} />
      <Paragraph.Text typography="t4">문자 붙여넣기</Paragraph.Text>
      <Spacing size={8} />
      <TextArea
        variant="box"
        data-testid="sms-textarea"
        value={smsText}
        onChange={(e) => setSmsText(e.target.value)}
        placeholder="예: 신한카드 승인 스타벅스강남점 8/10 09:15 12,000원"
      />
      <Spacing size={8} />
      <Button variant="weak" onClick={handleAnalyze}>
        분석
      </Button>

      <Spacing size={24} />
      <TextField
        variant="line"
        label="금액"
        placeholder="예: 12,000"
        inputMode="numeric"
        value={amountStr}
        hasError={!!amountError}
        help={amountError ?? undefined}
        data-testid="amount-input"
        onChange={(e) => {
          setAmountStr(e.target.value);
          if (amountError) setAmountError(null);
        }}
      />
      <Spacing size={16} />
      <TextField
        variant="line"
        label="가맹점"
        placeholder="예: 스타벅스강남점"
        value={merchant}
        data-testid="merchant-input"
        onChange={(e) => setMerchant(e.target.value)}
      />
      <Spacing size={16} />
      <TextField
        variant="line"
        label="메모"
        placeholder="예: 팀 회의 커피"
        value={memo}
        data-testid="memo-input"
        onChange={(e) => setMemo(e.target.value)}
      />

      <Spacing size={24} />
      <Paragraph.Text typography="t4">카테고리</Paragraph.Text>
      <Spacing size={12} />
      <Chip kind="select" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CATEGORIES.map((c) => (
          <ChipItem key={c} selected={category === c} onClick={() => setCategory(c)}>
            {c}
          </ChipItem>
        ))}
      </Chip>

      <Spacing size={80} />
      <Toast open={toast.open} text={toast.text} position="bottom" />
    </ScreenScaffold>
  );
}
