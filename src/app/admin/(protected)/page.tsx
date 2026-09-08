import Link from "next/link";
import { requireAdmin } from "@/features/admin/server/auth";
import { policyOverview, collectionRuns } from "@/features/admin/server/policy";
import { listUsers, catalogOverview } from "@/features/admin/server/data";
import { PageHeading, StatCard, Panel } from "@/features/admin/components";
import { dateTime, providerNames, runLabel } from "@/features/admin/format";

export default async function Dashboard() {
  await requireAdmin();
  const [overview, runs, users, catalog] = await Promise.all([
    policyOverview(),
    collectionRuns({ limit: 5 }),
    listUsers(1),
    catalogOverview(),
  ]);
  const review =
    overview.quality.find((q) => q.status === "REVIEW")?.count ?? 0;
  const errors = overview.quality.find((q) => q.status === "ERROR")?.count ?? 0;
  const required = overview.quality.reduce((n, q) => n + q.required, 0);
  const present = overview.quality.reduce((n, q) => n + q.present, 0);
  return (
    <>
      <PageHeading
        title="운영 현황"
        description={`마지막 조회 ${dateTime(new Date().toISOString())} KST`}
        action={
          <Link className="admin-button" href="/admin">
            새로고침
          </Link>
        }
      />
      <div className="admin-grid-stats">
        <StatCard
          label="등록 사용자"
          value={`${users.items.length}${users.hasNext ? "+" : ""}명`}
          hint={
            users.hasNext
              ? "첫 페이지 기준 · 전체 목록에서 확인"
              : "인증 계정 기준"
          }
        />
        <StatCard
          label="활성화된 정책"
          value={`${catalog.active}개`}
          hint="출처별 레코드 · 중복 포함"
        />
        <StatCard
          label="검토 대기"
          value={`${catalog.review}개`}
          hint="정책 관리에서 검토 대기 상태인 정책"
        />
        <StatCard
          label="반영 보류 오류"
          value={`${errors}개`}
          hint="현재 표시값에 대응하는 품질 평가"
        />
      </div>
      <div className="admin-grid-main">
        <Panel
          title="최근 정책 수집"
          action={<Link href="/admin/collection">수집 관리 바로가기 →</Link>}
        >
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>출처</th>
                  <th>발견 건수</th>
                  <th>상태</th>
                  <th>시작 시각 (KST)</th>
                </tr>
              </thead>
              <tbody>
                {runs.items.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <Link href={`/admin/collection?run=${run.id}`}>
                        {providerNames[run.provider]}
                      </Link>
                    </td>
                    <td>{run.discovered ?? "지정 표본"}</td>
                    <td>
                      <span className="admin-badge">{runLabel(run)}</span>
                    </td>
                    <td>{dateTime(run.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="출처별 활성화 현황">
          <div className="space-y-6">
            {catalog.sources.map((source) => (
              <div key={source.name}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{source.name}</span>
                  <strong>{source.count}개</strong>
                </div>
                <progress
                  className="w-full accent-teal-700"
                  value={source.count}
                  max={Math.max(1, catalog.active)}
                />
              </div>
            ))}
            <p className="admin-muted">
              출처 간 중복을 포함한 활성화된 정책 건수입니다.
            </p>
          </div>
        </Panel>
      </div>
      <div className="admin-grid-half">
        <Panel
          title="데이터 품질"
          action={
            <Link href="/admin/policies?tab=quality">품질 이력 보기 →</Link>
          }
        >
          <div className="mb-6 grid grid-cols-3 gap-3 text-center">
            <div>
              추가 확인
              <strong className="block text-2xl text-amber-600">
                {review}
              </strong>
            </div>
            <div>
              반영 보류<strong className="block text-2xl">{errors}</strong>
            </div>
            <div>
              미평가
              <strong className="block text-2xl">
                {overview.unassessedCurrent}
              </strong>
            </div>
          </div>
          <div className="rounded-lg bg-teal-50 p-4 text-sm text-teal-800">
            필수 항목 존재{" "}
            <strong className="float-right">
              {present} / {required}
            </strong>
          </div>
          <p className="admin-muted mt-3">
            필수 항목의 존재 여부이며, 내용 정확도나 자격 검수 완료를 뜻하지
            않습니다.
          </p>
        </Panel>
        <Panel title="운영 안내">
          <ul className="space-y-5 text-sm">
            <li>
              <strong>정책 수집 범위를 확대할 수 있습니다</strong>
              <p className="admin-muted">
                출처와 검색 범위를 선택해 제한된 배치로 수집하고 이어서
                처리하세요.
              </p>
            </li>
            <li>
              <strong>품질 문제를 유형별로 확인하세요</strong>
              <p className="admin-muted">
                정책 관리의 품질 이력에서 원문 누락과 정제 오류를 구분합니다.
              </p>
            </li>
            <li>
              <strong>예약 수집과 사용자 알림</strong>
              <p className="admin-muted">
                현재 수동 실행 단계입니다. 예약 실행과 외부 알림 발송은 연결
                전입니다.
              </p>
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
