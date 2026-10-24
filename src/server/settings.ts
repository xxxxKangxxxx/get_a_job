// 설정 기본값과 검증. DB 없이 동작하는 순수 함수만 둔다.
import type { AppSettings } from "../contracts/types";

/** DECISIONS D4·D5 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  weekdayHours: 3,
  weekendHours: 6,
  bufferDays: 1,
  defaultEstHours: 4,
  overrides: {},
  workWindow: { weekday: { start: "19:00", end: "23:00" }, weekend: { start: "10:00", end: "18:00" } },
  morningBriefTime: "08:00",
};

const isHours = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 24;
const isTime = (s: unknown) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 저장된 값(일부일 수 있음)을 기본값과 합친다. */
export function mergeSettings(stored: unknown): AppSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<AppSettings>;
  return {
    ...DEFAULT_APP_SETTINGS,
    ...s,
    overrides: { ...(s.overrides ?? {}) },
    workWindow: {
      weekday: { ...DEFAULT_APP_SETTINGS.workWindow.weekday, ...(s.workWindow?.weekday ?? {}) },
      weekend: { ...DEFAULT_APP_SETTINGS.workWindow.weekend, ...(s.workWindow?.weekend ?? {}) },
    },
  };
}

/** 잘못된 값이면 오류 메시지, 괜찮으면 null */
export function validateSettingsPatch(p: Partial<AppSettings>): string | null {
  for (const k of ["weekdayHours", "weekendHours"] as const) {
    if (k in p && !isHours(p[k])) return `${k}는 0~24 사이 숫자여야 해요`;
  }
  if ("defaultEstHours" in p && !(isHours(p.defaultEstHours) && p.defaultEstHours! > 0)) return "기본 예상 시간은 0보다 커야 해요";
  if ("bufferDays" in p && !(Number.isInteger(p.bufferDays) && p.bufferDays! >= 0 && p.bufferDays! <= 14)) return "여유 일수는 0~14 사이 정수여야 해요";
  if (p.overrides) {
    for (const [d, h] of Object.entries(p.overrides)) {
      if (!isDate(d) || !isHours(h)) return `날짜별 예외 값이 잘못됐어요: ${d}`;
    }
  }
  if (p.workWindow) {
    for (const w of [p.workWindow.weekday, p.workWindow.weekend]) {
      if (w && (!isTime(w.start) || !isTime(w.end))) return "작업 시간대는 HH:MM 형식이어야 해요";
    }
  }
  if ("morningBriefTime" in p && !isTime(p.morningBriefTime)) return "아침 브리핑 시각은 HH:MM 형식이어야 해요";
  return null;
}
