/**
 * CP-13: 모든 금액은 Intl.NumberFormat('ko-KR') 원화 표기 ("12,000원").
 * 잘못된 입력(null/undefined/NaN/Infinity)은 0원으로 안전하게 표기한다.
 */
export function formatKRW(n: number): string {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return "0원";
  }

  const rounded = Math.round(n);
  const formatted = new Intl.NumberFormat("ko-KR").format(Math.abs(rounded));
  return rounded < 0 ? `-${formatted}원` : `${formatted}원`;
}
