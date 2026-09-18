export type Truth = "TRUE" | "FALSE" | "UNKNOWN";
export type Eligibility = "ELIGIBLE" | "INELIGIBLE" | "UNKNOWN";
export type Subject = {
  kind: "CHILD" | "HOUSEHOLD" | "PERSON" | "EVENT";
  id: string;
};
export type FactKey = {
  attribute: string;
  subject: Subject;
  basis: string;
  reference: string;
};
export type FactValue =
  | { kind: "CODE"; value: string }
  | { kind: "BOOLEAN"; value: boolean }
  | {
      kind: "NUMBER_RANGE";
      min: number | null;
      max: number | null;
      minInclusive: boolean;
      maxInclusive: boolean;
      unit: string;
    }
  | { kind: "DATE_RANGE"; earliest: string; latest: string };
export type Answer = {
  key: FactKey;
  recordedAt: string;
  questionId?: string;
  questionVersion?: string;
  active?: boolean;
} & (
  | { state: "PROVIDED"; value: FactValue; source: "USER_DECLARED" }
  | { state: "UNASKED" | "DONT_KNOW" | "SKIPPED" | "EXPLICIT_NOT_APPLICABLE" }
);
export type Unknown = {
  kind:
    | "USER_MISSING"
    | "USER_PRECISION"
    | "USER_CONFLICT"
    | "POLICY_MISSING"
    | "UNREVIEWED_RULE"
    | "STALE_RULE"
    | "INCOMPLETE_PATHS"
    | "INCOMPLETE_SUBJECTS";
  ruleId?: string;
  factKey?: FactKey;
  resolvableByQuestion: boolean;
};
export type Evaluation<T> = {
  value: T;
  reasonCodes: string[];
  evidenceRefs: string[];
  usedAnswerKeys: FactKey[];
  unknowns: Unknown[];
};
export type FactRef = {
  attribute: string;
  subject: "BENEFICIARY" | "HOUSEHOLD";
  basis: string;
  reference: string;
};
export type Predicate = {
  id: string;
  fact: FactRef;
  label: string;
  evidenceRefs: string[];
  review: "HUMAN" | "FIXTURE" | "UNREVIEWED";
  sourceVersion: string;
} & (
  | { operator: "EQ"; expected: string | boolean }
  | { operator: "IN_SET"; expected: string[] }
  | {
      operator: "NUMBER_RANGE";
      min: number | null;
      max: number | null;
      minInclusive: boolean;
      maxInclusive: boolean;
      unit: string;
    }
  | { operator: "DATE_RANGE"; earliest: string; latest: string }
);
export type Expression =
  | { kind: "PREDICATE"; ruleId: string }
  | { kind: "ALL" | "ANY"; children: Expression[] }
  | { kind: "NOT"; child: Expression }
  | { kind: "UNRESOLVED" };
export type RankedFeature = { expression: Expression; evidenceRefs: string[] };
export type PolicyPath = {
  id: string;
  subject: Subject["kind"];
  complete: boolean;
  expression: Expression;
  purposes: string[];
  /** Absent preserves the legacy complete-purpose interpretation. */
  purposesComplete?: boolean;
  purposeEvidence: string[];
  availability: "OPEN" | "UPCOMING" | "CLOSED" | "UNKNOWN";
  availabilityEvidence: string[];
  deadline?: string;
  features?: {
    timing?: RankedFeature;
    lifeStage?: RankedFeature;
    delivery?: RankedFeature;
  };
};
export type Policy = {
  id: string;
  title: string;
  category: string;
  sourceVersion: string;
  release: "HUMAN" | "FIXTURE" | "HIDDEN";
  releaseSourceVersion: string;
  completePaths: boolean;
  rules: Predicate[];
  paths: PolicyPath[];
};
export type QuestionDefinition = {
  id: string;
  version: string;
  fact: FactRef;
  prompt: string;
  whyAsked: string;
  burden: 1 | 2 | 3 | 4;
  options: { label: string; value: FactValue }[];
  prerequisites: { questionId: string; equals: FactValue }[];
};
export type Catalog = {
  version: string;
  policies: Policy[];
  questions: QuestionDefinition[];
};
export type Context = {
  answers: Answer[];
  beneficiary: Subject;
  household: Subject;
  sourceVersion: string;
  mode: "FIXTURE" | "PUBLIC";
};
export type Request = {
  /** Current declared residence; never substitute for a policy's historical date. */
  residence?: import("./intake.ts").ResidenceScope;
  childProfiles?: import("./intake.ts").ChildProfile[];
  revision: number;
  category: string;
  selectedChildren: string[];
  /** Additional PERSON/EVENT beneficiaries; CHILD scope remains selectedChildren. */
  selectedSubjects?: Subject[];
  subjectsComplete: boolean;
  householdId: string;
  needs: string[];
  answers: Answer[];
  phase: "QUESTIONING" | "RESULTS";
  questionCount: number;
  evaluatedAt: string;
  view: "CURRENT" | "UPCOMING" | "CLOSED";
  mode: "FIXTURE" | "PUBLIC";
};
export type FeatureEvaluation = Evaluation<
  "MATCH" | "UNKNOWN" | "OTHER" | "NOT_USED"
>;
export type PathResult = {
  policyId: string;
  pathId: string;
  subject: Subject;
  eligibility: Evaluation<Eligibility>;
  features: FeatureEvaluation[];
  rank: number[];
  purpose: string;
  availability: PolicyPath["availability"];
  reasons: string[];
};
export type Card = {
  policyId: string;
  title: string;
  eligibility: Eligibility;
  representative: PathResult;
  pathResults: PathResult[];
  tags: { subject: Subject; eligibility: Eligibility; label: string }[];
  checksNeeded: Unknown[];
};
export type QuestionInstance = {
  key: string;
  definitionId: string;
  version: string;
  factKey: FactKey;
  prompt: string;
  whyAsked: string;
  options: QuestionDefinition["options"];
  affectedPolicyIds: string[];
  burden: number;
  utility: number;
};
export type Result = {
  revision: number;
  catalogVersion: string;
  evaluatedAt: string;
  mode: Request["mode"];
  cards: Card[];
  top5: string[];
  candidateCount: number;
  nextQuestion: QuestionInstance | null;
  stopReason:
    | "RESULTS_REQUESTED"
    | "QUESTION_LIMIT"
    | "NO_USEFUL_QUESTION"
    | null;
};
