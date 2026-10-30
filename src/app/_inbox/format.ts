import type { PostingSummary } from "@/contracts/types";

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/** "D-3", "오늘 마감", "수시" */
export function ddayLabel(p: Pick<PostingSummary, "dday" | "rolling" | "deadline">): string {
  if (p.dday === null || !p.deadline) return p.rolling ? "수시" : "마감 미정";
  if (p.dday === 0) return "오늘 마감";
  return p.dday > 0 ? `D-${p.dday}` : "마감";
}

export const isUrgent = (p: Pick<PostingSummary, "dday">) => p.dday !== null && p.dday >= 0 && p.dday <= 2;

/** "10/20 ~ 10/31 18:00" */
export function periodLabel(p: Pick<PostingSummary, "openDate" | "deadline" | "deadlineTime" | "rolling">): string {
  if (!p.deadline) return p.rolling ? "수시 채용" : "마감일 미정";
  const end = `${md(p.deadline)}${p.deadlineTime ? ` ${p.deadlineTime}` : ""}`;
  return p.openDate && p.openDate < p.deadline ? `${md(p.openDate)} ~ ${end}` : `~ ${end}`;
}

export const metaLine = (p: Pick<PostingSummary, "jobCategory" | "location" | "employmentType">) =>
  [p.jobCategory, p.location, p.employmentType].filter(Boolean).join(" · ");
