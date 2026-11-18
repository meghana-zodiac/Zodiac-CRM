const DAY_MS = 86_400_000;

export function indiaUsageDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDay(day: string, days: number) {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function dayBounds(start: string, end: string) {
  return { start: new Date(`${start}T00:00:00+05:30`), end: new Date(`${end}T23:59:59.999+05:30`) };
}

export function usageRange(period: string, customFrom: string, customTo: string, now = new Date()) {
  const today = indiaUsageDay(now);
  if (period === "today") return dayBounds(today, today);
  if (period === "yesterday") {
    const yesterday = shiftDay(today, -1);
    return dayBounds(yesterday, yesterday);
  }
  if (period === "this_week") {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    return dayBounds(shiftDay(today, -((weekday + 6) % 7)), today);
  }
  if (period === "this_month") return dayBounds(`${today.slice(0, 7)}-01`, today);
  if (
    period === "custom" &&
    /^\d{4}-\d{2}-\d{2}$/.test(customFrom) &&
    /^\d{4}-\d{2}-\d{2}$/.test(customTo)
  ) {
    const range =
      customFrom <= customTo ? dayBounds(customFrom, customTo) : dayBounds(customTo, customFrom);
    if (!Number.isNaN(range.start.getTime()) && !Number.isNaN(range.end.getTime())) return range;
  }
  const days = ["7", "30", "90"].includes(period) ? Number(period) : 1;
  return dayBounds(shiftDay(today, -(days - 1)), today);
}
