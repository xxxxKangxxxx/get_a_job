// 현재단계 → 다음 일정의 종류와 이름 (sync, track이 같이 쓴다)
export function eventKindFor(stage: string): { kind: "인적성" | "면접" | "서류발표" | "기타"; label: string } {
  if (stage.includes("인적성 대기")) return { kind: "인적성", label: "인적성검사" };
  if (stage.includes("2차면접 대기")) return { kind: "면접", label: "2차면접" };
  if (stage.includes("1차면접 대기")) return { kind: "면접", label: "1차면접" };
  if (stage.includes("최종 대기")) return { kind: "서류발표", label: "최종 발표" };
  if (stage.includes("결과 대기")) return { kind: "서류발표", label: stage.split(" ")[0] + " 결과 발표" };
  return { kind: "기타", label: "다음 일정" };
}
