import { Archive, ClipboardCheck, Files, ShieldCheck } from "lucide-react";
import { PageHeading, Panel, StatCard } from "@/features/admin/components";
import { requireAdmin } from "@/features/admin/server/auth";
import { dateTime } from "@/features/admin/format";
import {
  sixFieldPreparedCatalog as educationPreparedCatalog,
  sixFieldPreparationQueue as educationPreparationQueue,
  sixFieldSources,
  sixFieldPreparationStatus,
} from "@/features/policy/server/catalogs/six-field-prepared";
import supplementalEvidence from "../../../../../docs/fixtures/policy-recommendation/education-supplemental-evidence-20260911.json";
import sourceBundle from "../../../../../docs/fixtures/policy-recommendation/education-template-sources-20260911.json";

import coverageAudit from "../../../../../docs/fixtures/policy-recommendation/active-coverage-summary-20260911.json";

const dispositionLabels: Record<string, string> = {
  CANDIDATE: "조건 추천 후보",
  HOLD: "근거 확인 필요",
  ADJACENT: "인접 분야",
  OUTSIDE: "해당 분야 범위 밖",
};

export default async function RecommendationsPage() {
  await requireAdmin();
  const rows = sixFieldSources.map((source) => {
    const issues = educationPreparationQueue.filter(
      (issue) => issue.policyId === source.policy.id,
    );
    const policy = educationPreparedCatalog.policies.find(
      (item) => item.id === source.policy.id,
    );
    const status = issues.some((issue) => issue.status === "INVALID")
      ? "INVALID"
      : issues.some((issue) => issue.status === "PREPARED_DRAFT")
        ? "PREPARED_DRAFT"
        : "HELD";
    const officialDocuments = supplementalEvidence.items.find(
      (item) => item.policyId === source.policy.id,
    )?.documents;
    const officialUrls = Object.values(officialDocuments ?? {}).map(
      (doc) => doc.url,
    );
    return { source, issues, policy, status, officialUrls };
  });
  const invalid = educationPreparationQueue.filter(
    (issue) => issue.status === "INVALID",
  );
  const preparedCount = rows.filter(
    (row) => row.status === "PREPARED_DRAFT",
  ).length;
  const heldCount = rows.filter((row) => row.status === "HELD").length;
  const publicCount = educationPreparedCatalog.policies.filter(
    (policy) => policy.release === "HUMAN",
  ).length;

  return (
    <>
      <PageHeading
        title="추천 준비"
        description="6개 분야 표본의 조건 초안과 남은 검토 사항을 확인합니다."
      />
      <div className="admin-grid-stats">
        <StatCard
          label="입력 표본"
          value={`${rows.length}건`}
          icon={<Files aria-hidden="true" />}
          tone="blue"
          hint="고정 파일에 보존된 분야별 준비 표본"
        />
        <StatCard
          label="초안 준비"
          value={`${preparedCount}건`}
          icon={<ClipboardCheck aria-hidden="true" />}
          hint="조건을 작성한 상태 · 자격 판단 미승인"
        />
        <StatCard
          label="보류"
          value={`${heldCount}건`}
          icon={<Archive aria-hidden="true" />}
          tone="amber"
          hint="근거·분야·조건 작성 여부 확인 필요"
        />
        <StatCard
          label="공개 적용"
          value={`${publicCount}건`}
          icon={<ShieldCheck aria-hidden="true" />}
          tone="violet"
          hint="이 준비 카탈로그의 공개 승인 상태"
        />
      </div>
      <Panel
        title="활성 정책 전체 점검"
        description={`원본 조회 ${dateTime(coverageAudit.checkedAt)} KST 기준의 고정 집계입니다.`}
      >
        <p>
          활성 {coverageAudit.summary.activeCount}건 중 원본과 일치하는 초안{" "}
          {coverageAudit.summary.currentDraftCount}건, 미작성{" "}
          {coverageAudit.summary.noDraftCount}건입니다. 원본 변경 초안은{" "}
          {coverageAudit.summary.changedDraftCount}건입니다.
        </p>
        <p className="mt-3">
          분야 후보가 여러 개인 정책 {coverageAudit.summary.multiCategoryCount}
          건과 분야 분류를 확인할 정책 {coverageAudit.summary.unclassifiedCount}
          건은 별도로 점검합니다. 분야별 후보는 중복되며 자격 판정 결과가
          아닙니다.
        </p>
      </Panel>
      <Panel
        title="6개 분야 적용 준비"
        description="모든 분야가 적용 대상입니다. 초안 건수는 공개 적용 건수가 아닙니다."
      >
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>분야</th>
                <th>초안</th>
                <th>규칙</th>
                <th>충분조건 경로</th>
                <th>보류 / 오류</th>
                <th>공개</th>
              </tr>
            </thead>
            <tbody>
              {sixFieldPreparationStatus.map((field) => (
                <tr key={field.category}>
                  <td>{field.label}</td>
                  <td>{field.draftCount}</td>
                  <td>{field.ruleCount}</td>
                  <td>{field.completePathCount}</td>
                  <td>
                    {field.heldCount} / {field.invalidCount}
                  </td>
                  <td>{field.publicCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="이 화면의 기준">
        <p>
          교육 원본 확인: {dateTime(sourceBundle.checkedAt)} KST. 추가 5개
          분야는 2026-09-11 21:57 KST에 조회한 원본을 사용합니다. 이 화면은 고정
          파일과 준비된 초안을 읽습니다. 실시간 데이터베이스 검수 현황이나 현재
          신청 가능 여부를 뜻하지 않습니다.
        </p>
        <p className="mt-3">
          <strong>검토 대기·정보 부족은 자격 미충족이 아닙니다.</strong> 초안은
          전체 조건이 완성되지 않았으며 공개 자격 판단에 적용되지 않습니다.
          사용자 추천 화면은 잠정 추천을 계속 사용합니다.
        </p>
      </Panel>
      {invalid.length > 0 && (
        <Panel
          title={`입력 오류 ${invalid.length}건`}
          description="분야 보류와 별개로, 조건 준비 과정에서 입력을 처리하지 못한 항목입니다."
        >
          <ul className="space-y-3">
            {invalid.map((issue, index) => (
              <li key={`${issue.policyId}-${index}`}>
                <strong>{issue.sampleId || "표본 연결 불가"}</strong>
                <p>{issue.details.join(" · ") || issue.codes.join(" · ")}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel
        title="정책별 준비 상태"
        description="규칙과 추가 질문은 작성된 개수입니다. 질문이 0개여도 확인할 조건이 없다는 뜻은 아닙니다."
      >
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">분야 / 표본</th>
                <th scope="col">정책명·검토 사항</th>
                <th scope="col">상태</th>
                <th scope="col">규칙</th>
                <th scope="col">추가 질문</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ source, issues, policy, status, officialUrls }) => {
                const first = issues[0];
                const details = [
                  ...new Set(
                    issues.flatMap((issue) => [
                      issue.disposition_reason,
                      ...issue.details,
                    ]),
                  ),
                ];
                const labels = [
                  ...new Set(policy?.rules.map((rule) => rule.label) ?? []),
                ];
                return (
                  <tr key={source.policy.id}>
                    <td>
                      {
                        sixFieldPreparationStatus.find(
                          (field) => field.category === source.category,
                        )?.label
                      }
                      <br />
                      {source.sampleId}
                    </td>
                    <td>
                      <p className="max-w-lg font-medium whitespace-normal">
                        {source.policy.name}
                      </p>
                      <details className="admin-disclosure">
                        <summary>검토 사항 보기</summary>
                        <div className="admin-detail-body max-w-xl whitespace-normal">
                          {officialUrls.length > 0 && (
                            <p className="mb-3">
                              {officialUrls.map((url, index) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mr-3 underline"
                                >
                                  확인한 공식 자료 {index + 1}
                                </a>
                              ))}
                            </p>
                          )}
                          <ul className="space-y-2">
                            {details.map((detail) => (
                              <li key={detail}>{detail}</li>
                            ))}
                          </ul>
                          {labels.length > 0 && (
                            <>
                              <p className="mt-4 font-medium">작성된 규칙</p>
                              <ul className="mt-2 space-y-2">
                                {labels.map((label) => (
                                  <li key={label}>{label}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </details>
                    </td>
                    <td>
                      <span
                        className={`admin-badge ${status === "INVALID" ? "admin-badge-danger" : "admin-badge-warning"}`}
                      >
                        {status === "INVALID"
                          ? "입력 오류"
                          : status === "PREPARED_DRAFT"
                            ? "초안 · 검토 대기"
                            : "보류"}
                      </span>
                      <p className="admin-muted">
                        {dispositionLabels[first?.disposition ?? ""] ??
                          "분야 확인 필요"}
                      </p>
                    </td>
                    <td>{policy?.rules.length ?? 0}</td>
                    <td>{first?.questionCount ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
