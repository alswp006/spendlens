import type { Category, Expense } from "@/lib/types";

const CATEGORY_KEYWORDS: [Category, string[]][] = [
  ["카페/간식", ["스타벅스", "커피", "카페", "이디야", "투썸", "빽다방", "컴포즈", "메가커피", "커피빈"]],
  ["배달", ["배달의민족", "배민", "요기요", "쿠팡이츠"]],
  ["식비", ["김밥", "식당", "반점", "국밥", "백반", "분식", "김밥천국"]],
  ["교통", ["택시", "버스", "지하철", "카카오T", "티머니", "SRT", "KTX"]],
  ["쇼핑", ["쿠팡", "마켓컬리", "올리브영", "다이소", "백화점", "지마켓", "11번가"]],
  ["구독", ["넷플릭스", "유튜브", "왓챠", "멜론", "스포티파이", "디즈니플러스"]],
  ["문화/여가", ["영화", "CGV", "메가박스", "롯데시네마", "PC방", "노래방"]],
];

function inferCategory(text: string): Category {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }
  return "기타";
}

export function parseSmsText(text: string): Partial<Expense> | null {
  const amountMatch = text.match(/([\d,]+)\s*원/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const merchantMatch = text.match(/승인\s+([^\d]+?)\s+\d{1,2}\/\d{1,2}/);
  const merchant = merchantMatch ? merchantMatch[1].trim() : "";

  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  const now = new Date();
  const timestamp = dateMatch
    ? new Date(
        now.getFullYear(),
        Number(dateMatch[1]) - 1,
        Number(dateMatch[2]),
        Number(dateMatch[3]),
        Number(dateMatch[4]),
        0,
        0,
      ).getTime()
    : now.getTime();

  const category = inferCategory(`${merchant} ${text}`);

  return { amount, merchant, category, timestamp };
}
