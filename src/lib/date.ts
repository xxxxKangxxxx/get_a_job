// 날짜는 모두 한국 시간 기준 "YYYY-MM-DD" 문자열로 다룬다.

export function todayKST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

function toUTC(d: string): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

export function addDays(d: string, n: number): string {
  return new Date(toUTC(d) + n * 86400000).toISOString().slice(0, 10);
}

/** b - a (일) */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

/** 0=일 ... 6=토 */
export function weekday(d: string): number {
  return new Date(toUTC(d)).getUTCDay();
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];
export function formatShort(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  return `${m}/${day}(${WD[weekday(d)]})`;
}

export function dday(today: string, d: string): string {
  const n = diffDays(today, d);
  if (n === 0) return "D-day";
  return n > 0 ? `D-${n}` : `D+${-n}`;
}
