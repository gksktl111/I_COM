/** Exploration preferences. These are not verified policy eligibility facts. */
export const RECOMMENDATION_FIELDS = [
  {
    id: "pregnancy",
    label: "임신·출산",
    children: false,
    needs: [
      { id: "pregnancy-planning", label: "임신 준비" },
      { id: "prenatal", label: "임신 중 지원" },
      { id: "birth-preparation", label: "출산 준비" },
      { id: "postpartum", label: "산후 회복" },
    ],
  },
  {
    id: "childcare",
    label: "양육·보육",
    children: true,
    needs: [
      { id: "childcare-costs", label: "양육비 부담" },
      { id: "daycare", label: "어린이집·보육" },
      { id: "parenting", label: "부모·양육 지원" },
    ],
  },
  {
    id: "care",
    label: "돌봄",
    children: true,
    needs: [
      { id: "after-school", label: "방과 후 돌봄" },
      { id: "temporary-care", label: "일시·긴급 돌봄" },
      { id: "night-care", label: "야간·주말 돌봄" },
    ],
  },
  {
    id: "health",
    label: "의료·건강",
    children: false,
    needs: [
      { id: "checkups", label: "검진·예방" },
      { id: "medical-costs", label: "진료·의료비" },
      { id: "development", label: "발달·재활" },
    ],
  },
  {
    id: "education",
    label: "아동 교육",
    children: true,
    needs: [
      { id: "uniform", label: "교복 구입" },
      { id: "entry-preparation", label: "입학 준비" },
      { id: "learning", label: "학습 지원" },
      { id: "education-costs", label: "교육비·장학금" },
    ],
  },
  {
    id: "housing",
    label: "주거·생활지원",
    children: false,
    needs: [
      { id: "housing-costs", label: "주거비 부담" },
      { id: "housing-search", label: "주택·이사" },
      { id: "living-costs", label: "생활비 부담" },
      { id: "meals", label: "식사·급식" },
    ],
  },
] as const;

export type ResidenceScope = {
  region: string;
  district: string;
  basis: "REGISTERED_RESIDENCE";
  reference: "CURRENT";
};

/** User-provided demographics; a birth year does not establish an exact birthday. */
export type ChildProfile = {
  id: string;
  sex: "MALE" | "FEMALE" | null;
  birthYear: number | null;
};
