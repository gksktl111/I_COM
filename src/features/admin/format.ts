export const providerNames: Record<string, string> = {
  BOKJIRO_CENTRAL: "복지로 중앙",
  BOKJIRO_LOCAL: "복지로 지자체",
  GOV24: "Gov24",
};
export function dateTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
export const stopReasons: Record<string, string> = {
  CALL_BUDGET: "실행 호출 예산 도달",
  DAILY_BUDGET: "일일 호출 상한 도달",
  ITEM_LIMIT: "한 번에 처리할 건수 도달",
  PAGE_LIMIT: "페이지 상한 도달 · 새 범위 설정 필요",
  UPSTREAM_ERROR: "출처 응답 오류",
  SOURCE_DRIFT: "목록 변경 감지 · 새 수집 필요",
};
export function runLabel(run: {
  status: string;
  stop_reason: string | null;
  lease_active: boolean | null;
}) {
  if (run.stop_reason) return "일시정지";
  if (run.status === "RUNNING")
    return run.lease_active ? "실행 중" : "상태 확인 필요";
  return (
    (
      { SUCCESS: "완료", FAILED: "실패", PARTIAL: "일부 처리" } as Record<
        string,
        string
      >
    )[run.status] ?? run.status
  );
}
