import Link from "next/link";
import { POLICY_RELEVANCE_CATEGORIES } from "@/features/policy/server/relevance";
import { requireAdmin } from "@/features/admin/server/auth";
import { listPolicies, relevanceOverview } from "@/features/admin/server/data";
import { qualityRows } from "@/features/admin/server/policy";
import { PageHeading, Panel, EmptyState } from "@/features/admin/components";
import { dateTime, providerNames } from "@/features/admin/format";

type Params = {
  q?: string;
  provider?: string;
  page?: string;
  tab?: string;
  status?: string;
  before?: string;
  relevanceStatus?: string;
  category?: string;
  catalogStatus?: string;
};
const catalogNames = {
  ACTIVE: "활성 후보",
  REVIEW: "검토 대기",
  EXCLUDED: "제외 보관",
  ALL: "전체 보관",
};
const relevanceNames = {
  RELATED: "관련",
  UNRELATED: "무관",
  REVIEW: "검토 필요",
  UNASSESSED: "미평가",
};
export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const provider = Object.hasOwn(providerNames, params.provider ?? "")
    ? params.provider
    : undefined;
  const query = (params.q ?? "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  const page = Math.floor(
    Math.min(10000, Math.max(1, Number(params.page) || 1)),
  );
  const quality = params.tab === "quality";
  const catalogStatus = Object.hasOwn(catalogNames, params.catalogStatus ?? "")
    ? params.catalogStatus!
    : "ACTIVE";
  const relevanceStatus = Object.hasOwn(
    relevanceNames,
    params.relevanceStatus ?? "",
  )
    ? params.relevanceStatus
    : undefined;
  const category =
    Object.values(POLICY_RELEVANCE_CATEGORIES).find(
      (label) => label === params.category,
    ) ?? "";
  const status = ["PASS", "REVIEW", "ERROR", "NOT_EVALUATED"].includes(
    params.status ?? "",
  )
    ? params.status
    : undefined;
  const filters = new URLSearchParams({
    ...(provider ? { provider } : {}),
    ...(query ? { q: query } : {}),
    ...(!quality && relevanceStatus ? { relevanceStatus } : {}),
    ...(!quality && category ? { category } : {}),
    ...(!quality ? { catalogStatus } : {}),
  });
  const [result, overview] = quality
    ? [null, null]
    : await Promise.all([
        listPolicies({
          query,
          provider,
          page,
          relevanceStatus,
          category,
          catalogStatus,
        }),
        relevanceOverview(),
      ]);
  const observations = quality
    ? await qualityRows({
        provider: provider as "GOV24" | undefined,
        status,
        beforeId: /^\d+$/.test(params.before ?? "") ? params.before : undefined,
        limit: 30,
      })
    : null;
  return (
    <>
      <PageHeading
        title="정책 관리"
        description="저장된 정책과 정제 품질을 확인합니다. 자격 검수·서비스 공개 상태와는 구분됩니다."
      />
      <nav className="admin-tabs">
        <Link
          aria-current={!quality ? "page" : undefined}
          href="/admin/policies"
        >
          정책 목록
        </Link>
        <Link
          aria-current={quality ? "page" : undefined}
          href="/admin/policies?tab=quality"
        >
          품질 이력
        </Link>
      </nav>
      {overview && (
        <Panel title="정책 보관 현황">
          <p className="admin-muted">
            원본을 보존한 전체 보관 기준 · 목록 필터와 별도
          </p>
          <dl className="flex flex-wrap gap-6 py-3">
            {(
              [
                ["전체 보관", overview.total],
                ["활성 후보", overview.related],
                [
                  "검토 대기 (미평가 포함)",
                  overview.review + overview.unassessed,
                ],
                ["제외 보관", overview.unrelated],
              ] as const
            ).map(([label, count]) => (
              <div key={label}>
                <dt className="admin-muted">{label}</dt>
                <dd className="text-xl font-semibold">
                  {count.toLocaleString("ko-KR")}건
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}
      <Panel title={quality ? "정제 품질 이력" : "정책 목록"}>
        {!quality && (
          <p className="admin-muted">
            기본 목록은 서비스 관련성이 확인된 활성 후보입니다. 검토 대기와 제외
            보관 정책도 원본을 보존하며 보관 상태를 선택하면 확인할 수 있습니다.
            활성 후보는 신청 자격 판정이나 서비스 공개 승인을 뜻하지 않습니다.
          </p>
        )}
        <form className="admin-filters">
          <input
            type="hidden"
            name="tab"
            value={quality ? "quality" : "policies"}
          />
          {!quality && (
            <input
              className="admin-field"
              aria-label="정책명 검색"
              name="q"
              defaultValue={query}
              placeholder="정책명 검색"
              maxLength={100}
            />
          )}
          <select
            className="admin-field"
            name="provider"
            aria-label="출처"
            defaultValue={provider ?? ""}
          >
            <option value="">모든 출처</option>
            {Object.entries(providerNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          {quality && (
            <select
              className="admin-field"
              name="status"
              aria-label="품질 상태"
              defaultValue={status ?? ""}
            >
              <option value="">모든 품질 상태</option>
              <option value="PASS">기술 검사 통과</option>
              <option value="REVIEW">추가 확인</option>
              <option value="ERROR">반영 보류</option>
              <option value="NOT_EVALUATED">미평가</option>
            </select>
          )}
          {!quality && (
            <>
              <select
                className="admin-field"
                name="catalogStatus"
                aria-label="보관 상태"
                defaultValue={catalogStatus}
              >
                {Object.entries(catalogNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="admin-field"
                name="relevanceStatus"
                aria-label="서비스 관련성"
                defaultValue={relevanceStatus ?? ""}
              >
                <option value="">모든 관련성 상태</option>
                {Object.entries(relevanceNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="admin-field"
                name="category"
                aria-label="관련 분야"
                defaultValue={category}
              >
                <option value="">모든 관련 분야</option>
                {Object.values(POLICY_RELEVANCE_CATEGORIES).map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </>
          )}
          <button className="admin-button">조회</button>
          <Link href={quality ? "?tab=quality" : "/admin/policies"}>
            초기화
          </Link>
        </form>
        {result &&
          (result.items.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>정책명·상세</th>
                    <th>기관</th>
                    <th>보관 상태</th>
                    <th>서비스 관련성</th>
                    <th>출처</th>
                    <th>최근 저장 (KST)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((policy) => (
                    <tr key={policy.id}>
                      <td className="max-w-xl min-w-72">
                        <details>
                          <summary className="cursor-pointer font-semibold">
                            {policy.name || policy.external_id}
                          </summary>
                          <div className="space-y-3 py-4 text-sm font-normal">
                            <p className="admin-muted">{policy.external_id}</p>
                            <div>
                              <strong>
                                서비스 관련성 ·{" "}
                                {
                                  relevanceNames[
                                    policy.relevance?.status ?? "UNASSESSED"
                                  ]
                                }
                              </strong>
                              {policy.relevance ? (
                                <>
                                  <p>
                                    관련 분야:{" "}
                                    {policy.relevance.categories.join(", ") ||
                                      "해당 없음"}
                                  </p>
                                  <p>{policy.relevance.reason}</p>
                                  {policy.relevance.truncated && (
                                    <p className="admin-muted">
                                      긴 평가 내용은 일부만 표시합니다.
                                    </p>
                                  )}
                                  <ul className="space-y-2 py-2">
                                    {policy.relevance.evidence.map(
                                      (evidence, i) => (
                                        <li key={i}>
                                          <p className="whitespace-pre-wrap">
                                            {evidence.excerpt}
                                          </p>
                                          <p className="admin-muted">
                                            {evidence.field} · {evidence.rule}
                                          </p>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                  <p className="admin-muted">
                                    {policy.relevance.version} ·{" "}
                                    {dateTime(policy.relevance_assessed_at)} KST
                                  </p>
                                </>
                              ) : (
                                <p>아직 서비스 관련성을 평가하지 않았습니다.</p>
                              )}
                            </div>
                            {[
                              ["요약", policy.summary],
                              ["지원 대상", policy.target_text],
                              ["선정 기준", policy.criteria_text],
                              ["지원 내용", policy.benefit_text],
                              ["신청 방법", policy.application_method_text],
                              ["신청 기간", policy.application_period_text],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <strong>{label}</strong>
                                <p className="whitespace-pre-wrap">
                                  {value || "원문 정보 확인 필요"}
                                </p>
                              </div>
                            ))}
                            {policy.source_url && (
                              <a
                                href={policy.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                공식 출처 열기 ↗
                              </a>
                            )}
                          </div>
                        </details>
                      </td>
                      <td>{policy.provider_name || "—"}</td>
                      <td>
                        <span className="admin-badge">
                          {catalogNames[policy.catalog_status]}
                        </span>
                      </td>
                      <td>
                        <span className="admin-badge">
                          {
                            relevanceNames[
                              policy.relevance?.status ?? "UNASSESSED"
                            ]
                          }
                        </span>
                        <p className="admin-muted">
                          {policy.relevance?.categories.join(", ")}
                        </p>
                      </td>
                      <td>{providerNames[policy.provider]}</td>
                      <td>{dateTime(policy.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="조건에 맞는 정책이 없습니다"
              description="보관 상태, 검색어, 출처 또는 관련성 필터를 변경해보세요."
            />
          ))}
        {observations &&
          (observations.items.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>정책 ID</th>
                    <th>출처</th>
                    <th>상태</th>
                    <th>필수값</th>
                    <th>문제·평가 이력</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.external_id}</td>
                      <td>{providerNames[row.provider]}</td>
                      <td>
                        <span className="admin-badge">
                          {
                            {
                              PASS: "기술 검사 통과",
                              REVIEW: "추가 확인",
                              ERROR: "반영 보류",
                              NOT_EVALUATED: "미평가",
                            }[row.status]
                          }
                        </span>
                        <p className="admin-muted">
                          {row.matches_current ? "현재 데이터" : "과거 평가"}
                        </p>
                      </td>
                      <td>
                        {row.present_count}/{row.required_count}
                      </td>
                      <td>
                        <details>
                          <summary>{row.issues.length}개 항목 확인</summary>
                          <ul className="max-w-lg space-y-2 py-3">
                            {row.issues.map((issue, i) => (
                              <li key={i}>
                                <strong>{issue.code}</strong>
                                <p>{issue.message}</p>
                              </li>
                            ))}
                          </ul>
                          <p className="admin-muted">
                            {row.evaluator_version} ·{" "}
                            {dateTime(row.assessed_at)} KST
                          </p>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="조건에 맞는 품질 이력이 없습니다" />
          ))}
        <nav className="admin-pagination" aria-label="정책 페이지">
          {result && page > 1 && (
            <Link href={`?${filters}&page=${page - 1}`}>← 이전</Link>
          )}
          {result?.hasNext && (
            <Link href={`?${filters}&page=${page + 1}`}>다음 →</Link>
          )}
          {observations?.nextCursor && (
            <Link
              href={`?tab=quality&${filters}&status=${status ?? ""}&before=${observations.nextCursor.beforeId}`}
            >
              다음 이력 →
            </Link>
          )}
        </nav>
      </Panel>
    </>
  );
}
