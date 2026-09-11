import { createHash } from "node:crypto";
import type { PublicPolicy } from "../public/types.ts";

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
/** Scope corrections from the archived education audit, not eligibility rules or HUMAN releases.
 * Only the exact classification text is covered. Changed text falls back to ordinary discovery.
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
] as const;
export function classifyProvisionalScope(
  policy: PublicPolicy,
  category: string,
): boolean | undefined {
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
