/** Keep the original commercial terms authoritative, including tiered/service pricing. */
export function commercialTerms(terms: string | null) {
  const payment = terms?.match(/\bPay(?:ment)?(?:\s+(?:after|aft\.?|within|in))?\s+(\d+)\s*Days?/i);
  const replacement = terms?.match(/\bReplace(?:ment)?(?:\s+period)?\s+(\d+)\s*Days?/i);
  const firstClause = Math.min(payment?.index ?? Infinity, replacement?.index ?? Infinity);
  const fee = (Number.isFinite(firstClause) ? terms?.slice(0, firstClause) : terms)
    ?.replace(/\s+[I|]\s*$/, "")
    .trim();
  return {
    fee: fee || "Not recorded",
    payment: payment?.[1],
    replacement: replacement?.[1],
  };
}
