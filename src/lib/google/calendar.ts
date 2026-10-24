// Google Calendar REST API 얇은 래퍼 (fetch만 사용).
import { getAccessToken } from "./oauth";
import { APP_CALENDAR_NAME, TIME_ZONE } from "./config";

const API = "https://www.googleapis.com/calendar/v3";

export class GoogleApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleApiError(json?.error?.message ?? `Google API ${res.status}`, res.status);
  return json as T;
}

export type GEventTime = { date: string } | { dateTime: string; timeZone: string };
export type GEventBody = {
  summary: string;
  description?: string;
  start: GEventTime;
  end: GEventTime;
  colorId?: string;
  transparency?: "opaque" | "transparent";
  reminders?: { useDefault: boolean; overrides?: { method: "popup" | "email"; minutes: number }[] };
  extendedProperties?: { private: Record<string, string> };
};

export async function createAppCalendar(): Promise<string> {
  const cal = await call<{ id: string }>("/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: APP_CALENDAR_NAME, timeZone: TIME_ZONE, description: "취업 일정 앱이 관리하는 캘린더예요. 여기서 고친 내용은 다음 동기화 때 덮어써질 수 있어요." }),
  });
  return cal.id;
}

export async function deleteCalendar(calendarId: string): Promise<void> {
  await call(`/calendars/${encodeURIComponent(calendarId)}`, { method: "DELETE" });
}

/** 캘린더가 아직 있는지 (사용자가 직접 지웠을 수 있다) */
export async function calendarExists(calendarId: string): Promise<boolean> {
  try {
    await call(`/calendars/${encodeURIComponent(calendarId)}`);
    return true;
  } catch (e) {
    if (e instanceof GoogleApiError && (e.status === 404 || e.status === 403)) return false;
    throw e;
  }
}

export async function insertEvent(calendarId: string, body: GEventBody): Promise<string> {
  const ev = await call<{ id: string }>(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST", body: JSON.stringify(body),
  });
  return ev.id;
}

/** 전체 교체. 이벤트가 없어졌으면(404/410) false */
export async function updateEvent(calendarId: string, eventId: string, body: GEventBody): Promise<boolean> {
  try {
    await call(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "PUT", body: JSON.stringify(body),
    });
    return true;
  } catch (e) {
    if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) return false;
    throw e;
  }
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  try {
    await call(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  } catch (e) {
    if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) return;
    throw e;
  }
}

/** 바쁜 시간 구간 (ISO 문자열). calendarIds 기본은 기본 캘린더 */
export async function freeBusy(timeMin: string, timeMax: string, calendarIds = ["primary"]): Promise<{ start: string; end: string }[]> {
  const res = await call<{ calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> }>("/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin, timeMax, timeZone: TIME_ZONE, items: calendarIds.map((id) => ({ id })) }),
  });
  return Object.values(res.calendars).flatMap((c) => c.busy ?? []);
}
