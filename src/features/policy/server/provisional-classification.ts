import { createHash } from "node:crypto";
import { RECOMMENDATION_FIELDS } from "../recommendation/intake.ts";
import type { PublicPolicy } from "../public/types.ts";
import officialScope from "../../../../docs/fixtures/policy-recommendation/official-scope-link-20260913.json" with { type: "json" };

const fields = [
  "name",
  "summary",
  "provider_name",
  "purpose_text",
  "target_text",
  "criteria_text",
  "benefit_text",
  "source_url",
] as const;
export function provisionalClassificationFingerprint(
  policy: PublicPolicy,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        policy.id,
        ...fields.map((field) => policy[field] ?? null),
      ]),
    )
    .digest("hex");
}
/** 보존된 교육 검수와 공식 자료 검수의 분야 보정이며 자격 규칙·공개 승인이 아니다.
 * 분류 원문 지문이 일치할 때만 적용하고 원문 변경 시 일반 탐색으로 돌아간다.
 */
const corrections = [
  {
    id: "046f6387-44ae-4770-8181-35545094340b",
    category: "education",
    include: true,
    fingerprint:
      "89141ec80cb7c260eef91a9fdfa48dc71f887cb10e70aed734bcfb2bf25a0fb0",
    evidence: "education-mapping-a-20260909:E03",
    reason: "중·고등학교 신입생 교복 지원은 아동 교육 후보",
  },
  {
    id: "4d9da215-5c25-411c-8a4d-4ffe306f2da9",
    category: "education",
    include: false,
    fingerprint:
      "8976b1978bae4bc4e3ee71d434dc023b72ff2155d9762737e10fde314821b9f2",
    evidence: "education-mapping-b-20260909:E18",
    reason:
      "현재 지원내용은 대학생 장학금; 과거 초·고등학교 조건 문구로 아동 교육에 넣지 않음",
  },
  ...officialScope.items.flatMap((item) =>
    [
      ...item.include.map((category) => ({ category, include: true })),
      ...item.exclude.map((category) => ({ category, include: false })),
    ].map((decision) => ({
      id: item.sourceId,
      ...decision,
      fingerprint: item.fingerprint,
      evidence: `official-scope-link-20260913:${item.sourceId}`,
      reason: item.reason,
    })),
  ),
] as const;
export function classifyProvisionalScope(
  policy: PublicPolicy,
  category: string,
): boolean | undefined {
  const classified = policy.reviewedScope ?? policy.classifiedScope;
  if (classified && RECOMMENDATION_FIELDS.some((field) => field.id === category) &&
      Array.isArray(classified.categories) && classified.categories.length > 0 &&
      classified.categories.every((key) => RECOMMENDATION_FIELDS.some((field) => field.id === key)) &&
      classified.fingerprint === provisionalClassificationFingerprint(policy)) {
    // 분야 포함·제외만 적용하며 신청 자격이나 조건 검수 상태는 바꾸지 않는다.
    return classified.categories.includes(category);
  }
  const correction = corrections.find(
    (c) => c.id === policy.id && c.category === category,
  );
  if (
    !correction ||
    provisionalClassificationFingerprint(policy) !== correction.fingerprint
  )
    return undefined;
  return correction.include;
}
