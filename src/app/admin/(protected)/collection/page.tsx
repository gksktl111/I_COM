import { PolicyDetailDialog } from "@/features/admin/components/PolicyDetailDialog";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { recentExclusions } from "@/features/admin/server/exclusions";
import { requireAdmin } from "@/features/admin/server/auth";
import { collectionRuns, policyOverview } from "@/features/admin/server/policy";
import { PageHeading, Panel, EmptyState } from "@/features/admin/components";
import {
  dateTime,
  providerNames,
  runLabel,
  stopReasons,
} from "@/features/admin/format";
import { CollectionSubmit } from "@/features/admin/components/CollectionSubmit";
import { collectPolicies } from "./actions";

export const maxDuration = 300;
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{
    run?: string;
    error?: string;
    updated?: string;
    before?: string;
    at?: string;
  }>;
}) {
  await requireAdmin();
  const p = await searchParams;
  const uuid = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
  const runId = uuid.test(p.run ?? "") ? p.run : undefined;
  const cursor =
    uuid.test(p.before ?? "") && Number.isFinite(Date.parse(p.at ?? ""))
      ? { beforeId: p.before, beforeStartedAt: p.at }
      : {};
  const [runs, overview, exclusions] = await Promise.all([
    collectionRuns({ runId, limit: 20, ...cursor }),
    policyOverview(),
    recentExclusions(),
  ]);
  const todayUsage = overview.dailyUsage.filter(
    (usage) => usage.day.slice(0, 10) === new Date().toISOString().slice(0, 10),
  );
  return (
    <>
      <PageHeading
        title="정책 수집"
        description="출처별 정책을 수집하고, 중단된 실행을 이어서 처리합니다."
        action={
          <Link
            className="admin-button admin-button-secondary"
            href="/admin/collection"
          >
            <RefreshCw size={15} aria-hidden="true" />
            새로고침
          </Link>
        }
      />
      {p.error && (
        <p role="alert" className="admin-notice">
          {p.error === "disabled"
            ? "웹 수집 실행이 비활성화되어 있습니다. 서버의 POLICY_SYNC_ENABLED 설정을 확인해주세요."
            : p.error === "key"
              ? "선택한 출처의 인증키가 설정되지 않았습니다."
              : "수집 요청을 완료하지 못했습니다. 실행 이력과 연결 상태를 확인해주세요."}
        </p>
      )}
      {p.updated && (
        <p role="status" className="admin-notice">
          처리 결과를 저장했습니다. 아래 상태와 중단 사유를 확인해주세요.
        </p>
      )}
      <Panel
        title="새 수집 시작"
        description="출처와 검색 범위를 선택하세요. 중단된 실행은 아래 이력에서 이어서 처리할 수 있습니다."
        className="mb-6"
      >
        <form action={collectPolicies} className="admin-filters">
          <Select
            className="admin-select"
            name="provider"
            aria-label="수집 출처"
          >
            {Object.entries(providerNames).map(([id, name]) => (
              <option value={id} key={id}>
                {name}
              </option>
            ))}
          </Select>
          <input
            className="admin-field"
            name="keyword"
            maxLength={100}
            placeholder="검색어 · 비워두면 출처 전체 범위"
            aria-label="수집 검색어"
          />
          <CollectionSubmit>수집 시작</CollectionSubmit>
        </form>
        <details className="admin-disclosure">
          <summary>수집 범위와 호출 한도</summary>
          <div className="admin-detail-body admin-muted">
            <p>
              한 번에 최대 5개 정책·10회 호출을 처리합니다. 전체 수집은 같은
              실행을 이어서 진행합니다.
            </p>
            <p>
              일일 예약 호출 상한은 UTC 기준 100회이며 외부 계정의 실제 잔여
              할당량과 다릅니다. 실행 중에는 완료 응답을 기다려주세요.
            </p>
          </div>
        </details>
      </Panel>
      <Panel
        title={runId ? "선택한 수집 실행" : "수집 실행 이력"}
        description={`${runs.items.length}개 실행 표시 · 시작 시각순`}
        action={runId && <Link href="/admin/collection">전체 이력 보기</Link>}
        className="mb-6"
      >
        {!runs.items.length ? (
          <EmptyState title="수집 실행 이력이 없습니다" />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>출처·실행</th>
                  <th>목록 진행</th>
                  <th>처리 결과</th>
                  <th>상태</th>
                  <th>호출</th>
                  <th>시각 (KST)</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {runs.items.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <strong>{providerNames[run.provider]}</strong>
                      <details className="admin-disclosure">
                        <summary className="admin-record-meta">
                          실행 상세
                        </summary>
                        <p className="admin-detail-body admin-record-meta">
                          실행 ID · {run.id}
                        </p>
                        <div className="admin-detail-body admin-muted">
                          <p>
                            {run.discovery_complete
                              ? "목록 탐색 완료"
                              : "전체 범위 미확인"}
                          </p>
                          <p>
                            기존 저장 건너뜀{" "}
                            {Number(run.summary.skippedExisting ?? 0)}
                          </p>
                          <p>
                            무관 제외 {Number(run.summary.excluded ?? 0)} · 대기{" "}
                            {Number(run.summary.pending ?? 0)}
                          </p>
                          <p>종료 {dateTime(run.finished_at)} KST</p>
                        </div>
                      </details>
                    </td>
                    <td>
                      {run.discovered ?? "지정 표본"} /{" "}
                      {run.expected_total ?? "확인 중"}
                    </td>
                    <td>
                      성공 {Number(run.summary.success ?? 0)}
                      <p className="admin-muted">
                        실패 {Number(run.summary.failed ?? 0)}
                      </p>
                    </td>
                    <td>
                      <span
                        className={`admin-badge ${run.status === "FAILED" ? "admin-badge-danger" : run.status === "SUCCESS" ? "" : "admin-badge-warning"}`}
                      >
                        {runLabel(run)}
                      </span>
                      {run.stop_reason && (
                        <p className="admin-muted max-w-44 whitespace-normal">
                          {stopReasons[run.stop_reason] ??
                            "실행 기록 확인 필요"}
                        </p>
                      )}
                    </td>
                    <td>{run.calls}회</td>
                    <td>{dateTime(run.started_at)}</td>
                    <td>
                      {run.next_page !== null &&
                      run.status !== "SUCCESS" &&
                      !run.lease_active &&
                      !["SOURCE_DRIFT", "PAGE_LIMIT"].includes(
                        run.stop_reason ?? "",
                      ) ? (
                        <form action={collectPolicies}>
                          <input
                            type="hidden"
                            name="provider"
                            value={run.provider}
                          />
                          <input type="hidden" name="runId" value={run.id} />
                          <CollectionSubmit>이어서 수집</CollectionSubmit>
                        </form>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {runs.nextCursor && (
          <nav className="admin-pagination" aria-label="수집 실행 페이지">
            <Link
              href={`?before=${runs.nextCursor.beforeId}&at=${encodeURIComponent(runs.nextCursor.beforeStartedAt!)}`}
            >
              이전 실행 더 보기 →
            </Link>
          </nav>
        )}
      </Panel>
      <div className="admin-grid-half">
        <Panel
          title="오늘 호출 예약량"
          description="UTC 기준 · 출처별 예약 / 설정 상한"
        >
          <ul className="space-y-4">
            {todayUsage.map((u) => (
              <li key={u.provider}>
                <div className="admin-source-heading">
                  <span>{providerNames[u.provider]}</span>
                  <strong>
                    {u.reserved_calls} / {u.configured_limit}회
                  </strong>
                </div>
                <progress
                  className="w-full"
                  aria-label={`${providerNames[u.provider]} 오늘 호출 예약량`}
                  value={u.reserved_calls}
                  max={Math.max(1, u.configured_limit)}
                />
              </li>
            ))}
          </ul>
          {!todayUsage.length && (
            <p className="admin-muted">오늘 예약된 호출이 없습니다.</p>
          )}
          <details className="admin-disclosure mt-4">
            <summary>예약량 집계 기준</summary>
            <p className="admin-detail-body admin-muted">
              예약 직후 중단된 요청도 포함됩니다. 다음 예약일은 UTC 00:00(KST
              09:00)에 시작합니다.
            </p>
          </details>
        </Panel>
        <Panel title="수집 운영 안내">
          <p className="text-sm">
            성공한 정책은 재개 시 건너뜁니다. 원문 변경이나 페이지 상한으로 멈춘
            실행은 검색 범위를 다시 설정해주세요.
          </p>
          <details className="admin-disclosure mt-4">
            <summary>예약 실행과 데이터 보관</summary>
            <p className="admin-detail-body admin-muted">
              예약 실행은 아직 연결되지 않았습니다. 원본·오류 보관과 기존 표시값
              보호는 자동으로 처리합니다.
            </p>
          </details>
        </Panel>
      </div>
      <Panel
        title="최근 무관 정책 제외 이력"
        description="최근 30건 · 모든 실행의 신규 정책 저장 제외 기록"
      >
        <p className="admin-muted mb-4">
          기존 저장 정책의 삭제 이력은 포함하지 않습니다.
        </p>
        {exclusions.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>출처·정책 ID</th>
                  <th>검사 단계</th>
                  <th>제외 근거</th>
                  <th>시각 (KST)</th>
                </tr>
              </thead>
              <tbody>
                {exclusions.map((item) => (
                  <tr key={`${item.run_id}:${item.external_id}`}>
                    <td>
                      <strong>{providerNames[item.provider]}</strong>
                      <p className="admin-record-meta">{item.external_id}</p>
                    </td>
                    <td>{item.phase === "LIST" ? "목록 검사" : "상세 검사"}</td>
                    <td className="max-w-xl whitespace-normal">
                      <PolicyDetailDialog
                        title={`정책 제외 상세 · ${item.external_id}`}
                        triggerLabel="정책 상세 보기"
                      >
                        <div className="admin-detail-body">
                          <p>{item.reason}</p>
                          {item.truncated && (
                            <p className="admin-muted">
                              긴 평가 내용은 일부만 표시합니다.
                            </p>
                          )}
                          <ul className="space-y-2 py-2">
                            {item.evidence.map((evidence, i) => (
                              <li key={i}>
                                <p className="whitespace-pre-wrap">
                                  {evidence.excerpt}
                                </p>
                                <p className="admin-record-meta">
                                  {evidence.field} · {evidence.rule}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </PolicyDetailDialog>
                    </td>
                    <td>{dateTime(item.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="무관 정책 제외 이력이 없습니다" />
        )}
      </Panel>
    </>
  );
}
