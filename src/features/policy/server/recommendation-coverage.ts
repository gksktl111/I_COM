import { RECOMMENDATION_FIELDS } from "../recommendation/intake.ts";
import { matchesInterests } from "../public/types.ts";
import { classifyProvisionalScope } from "./provisional-classification.ts";
import { hashJson } from "./normalize.ts";
import type { RecommendationSource } from "./recommendation-sources.ts";
import type { Catalog } from "../recommendation/types.ts";

const signals = {
  AGE: /(?:만\s*)?\d+\s*세|출생|생년/,
  MONTHS_UNRESOLVED: /\d+\s*개월/,
  INCOME_RECOGNIZED: /소득인정액/,
  INCOME_INSURANCE: /건강보험료/,
  INCOME_MEDIAN: /중위소득/,
  INCOME: /소득|건강보험료|수급자|차상위/,
  HOUSEHOLD: /가구|한부모|다문화|다자녀|신혼|부부/,
  RESIDENCE: /거주|주민등록|주소|관내/,
  DISABILITY: /장애인|장애의 정도|등록장애|심한장애/,
  ALTERNATIVE_PATH: /또는|하거나|예외지원|지원 가능/,
  RESIDENCE_REFERENCE: /출생일|입학일|신청일|공고일|전입|계속하여|계속 거주/,
  SUBJECT_SCOPE: /부 또는 모|막내|세대주|직계존속|신혼부부|미성년 자녀/,
  SCHOOL: /재학|입학|학교|학년/,
  EXCEPTION: /제외|중복|단,|다만|예외/,
  APPLICATION: /신청일|공고일|기준일|신청기간/,
} as const;

/** Inventory triage only. Text signals are never compiled into eligibility rules. */
export function auditRecommendationCoverage(
  inventory: { checkedAt: string; items: RecommendationSource[] },
  prepared: {
    catalog: Catalog;
    sourceVersions: Record<string, RecommendationSource["source"]>;
  },
) {
  if (
    !Number.isFinite(Date.parse(inventory.checkedAt)) ||
    !Array.isArray(inventory.items)
  )
    throw new Error("invalid-coverage-inventory");
  const seen = new Set<string>();
  const rows = inventory.items
    .map(({ policy, source }) => {
      if (
        !policy?.id ||
        seen.has(policy.id) ||
        !source?.snapshotId ||
        !/^[a-f0-9]{64}$/.test(source.normalizedFingerprint)
      )
        throw new Error("invalid-coverage-source");
      seen.add(policy.id);
      const categories = RECOMMENDATION_FIELDS.filter(
        (field) =>
          classifyProvisionalScope(policy, field.id) ??
          matchesInterests(
            {
              ...policy,
              summary: [
                policy.summary,
                policy.purpose_text,
                policy.criteria_text,
              ]
                .filter(Boolean)
                .join(" "),
            },
            [field.label],
          ),
      ).map((field) => field.id);
      const draft = prepared.catalog.policies.find((p) => p.id === policy.id);
      const current =
        !!draft &&
        hashJson(source) ===
          hashJson(prepared.sourceVersions[policy.id] ?? null);
      const status = draft
        ? current
          ? "DRAFT_UNREVIEWED"
          : "SOURCE_CHANGED"
        : categories.length
          ? "NOT_PREPARED"
          : "CLASSIFICATION_REQUIRED";
      const evidence = Object.entries(signals).flatMap(([kind, pattern]) =>
        (["target_text", "criteria_text"] as const).flatMap((field) => {
          const value = policy[field];
          if (!value) return [];
          const match = pattern.exec(value);
          if (!match) return [];
          const start = Math.max(0, match.index - 35);
          return [
            {
              kind,
              field,
              quote: value.slice(start, match.index + match[0].length + 65),
            },
          ];
        }),
      );
      return {
        policyId: policy.id,
        title: policy.name,
        provider: policy.provider_name,
        source,
        categories,
        draftCategory: draft?.category ?? null,
        status,
        conditionSignals: evidence,
        missing: [
          ...(categories.length !== 1 ? ["CATEGORY_REVIEW"] : []),
          ...(!policy.target_text && !policy.criteria_text
            ? ["CONDITION_SOURCE"]
            : []),
          ...(status === "SOURCE_CHANGED" ? ["REFRESH_DRAFT_SOURCE"] : []),
          ...(!draft ? ["WRITE_RULES_AND_EXCEPTIONS"] : []),
          "OFFICIAL_CURRENT_TERMS",
          "PUBLICATION_REVIEW",
        ],
      };
    })
    .sort((a, b) => a.policyId.localeCompare(b.policyId));
  const fields = RECOMMENDATION_FIELDS.map((field) => {
    const candidates = rows.filter((row) => row.categories.includes(field.id));
    return {
      category: field.id,
      label: field.label,
      candidateCount: candidates.length,
      currentDraftCount: candidates.filter(
        (row) =>
          row.status === "DRAFT_UNREVIEWED" && row.draftCategory === field.id,
      ).length,
      sourceChangedCount: candidates.filter(
        (row) =>
          row.status === "SOURCE_CHANGED" && row.draftCategory === field.id,
      ).length,
      pendingCount: candidates.filter(
        (row) =>
          row.draftCategory !== field.id || row.status !== "DRAFT_UNREVIEWED",
      ).length,
    };
  });
  return {
    schemaVersion: "recommendation-coverage-v1",
    signalPatterns: Object.fromEntries(
      Object.entries(signals).map(([kind, regex]) => [kind, regex.source]),
    ),
    checkedAt: inventory.checkedAt,
    inventoryDigest: hashJson(rows.map((row) => [row.policyId, row.source])),
    catalogVersion: prepared.catalog.version,
    summary: {
      activeCount: rows.length,
      currentDraftCount: rows.filter((r) => r.status === "DRAFT_UNREVIEWED")
        .length,
      changedDraftCount: rows.filter((r) => r.status === "SOURCE_CHANGED")
        .length,
      noDraftCount: rows.filter((r) => !r.draftCategory).length,
      unclassifiedCount: rows.filter((r) => !r.categories.length).length,
      multiCategoryCount: rows.filter((r) => r.categories.length > 1).length,
      inactiveDraftIds: prepared.catalog.policies
        .filter((p) => !seen.has(p.id))
        .map((p) => p.id),
    },
    fields,
    reviewPriorities: Object.keys(signals).map((kind) => ({
      kind,
      policyCount: rows.filter((row) =>
        row.conditionSignals.some((signal) => signal.kind === kind),
      ).length,
    })),
    rows,
    limitations: [
      "분야는 문구 기반 후보이며 중복될 수 있습니다.",
      "조건 신호는 검토할 원문 위치이며 자격 규칙·공개 승인이 아닙니다.",
      "조회 시점의 고정 자료입니다. 공개 전 최신 원본을 다시 검증해야 합니다.",
    ],
  };
}
