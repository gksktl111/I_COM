"use client";
import Link from "next/link";
import styles from "./recommendation-playground.module.css";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import {
  evaluateRecommendation,
  replaceAnswer,
  factKey,
  activateAnswers,
} from "../recommendation/index";
import {
  educationFixture,
  educationRequest,
} from "../recommendation/education.fixture";
import { RecommendationChildren } from "./RecommendationChildren";
import {
  emptyChildProfile,
  withChildProfiles,
} from "../recommendation/child-profiles";
import { RecommendationIntake } from "./RecommendationIntake";
import { RECOMMENDATION_FIELDS } from "../recommendation/intake";
import { PolicyAccordion } from "./PolicyAccordion";
import { PolicyDetailModal } from "./PolicyDetailModal";
import { useRecommendation } from "../hooks/useRecommendation";
import type { PublicPolicy } from "../public/types";
import type {
  Answer,
  FactValue,
  QuestionInstance,
  Request,
} from "../recommendation/types";

const labels: Record<string, string> = {
  GIJANG: "부산 기장군",
  GWANAK: "서울 관악구",
  SEOUL: "서울",
  BUSAN: "부산",
  OTHER: "그 외 / 해당하지 않음",
  HIGH_SCHOOL: "고등학교",
  MIDDLE_SCHOOL: "중학교",
  ELEMENTARY: "초등학교",
  REGULAR: "일반 과정",
  ADULT: "성인 과정",
  FIRST: "처음 입학",
  TRANSFER: "전학",
  REENTRY: "재입학",
  "2026": "2026년",
  "1": "1학년",
};
const valueLabel = (value: FactValue) =>
  value.kind === "BOOLEAN"
    ? value.value
      ? "예"
      : "아니요"
    : value.kind === "CODE"
      ? (labels[value.value] ?? value.value)
      : value.kind === "DATE_RANGE"
        ? `${value.earliest} ~ ${value.latest}`
        : `${value.min ?? "미확인"} ~ ${value.max ?? "미확인"} ${value.unit}`;
const fallbackChildLabel = (id: string) => `자녀 ${id.split("-").at(-1)}`;
const base = () => ({
  ...structuredClone(educationRequest),
  selectedChildren: ["child-1"],
  childProfiles: [emptyChildProfile("child-1")],
  needs: ["uniform"],
  answers: [],
});
const primary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-primary px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#005f5a] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-[#e8f3ef]";
function AnswerChoices({
  question,
  initial,
  onSubmit,
  testMode,
}: {
  question: QuestionInstance;
  initial?: FactValue;
  onSubmit: (value: FactValue) => void;
  testMode: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(() => {
    const index = question.options.findIndex(
      (o) => JSON.stringify(o.value) === JSON.stringify(initial),
    );
    return index < 0 ? null : index;
  });
  const submitted = useRef(false);
  return (
    <>
      <p className="mt-7 text-sm text-slate-600">
        한 개 선택 · 선택한 항목을 다시 누르면 해제돼요.
      </p>
      <div className="mt-3 grid gap-3" role="group" aria-label="답변 선택지">
        {question.options.map((option, index) => (
          <button
            key={index}
            type="button"
            aria-pressed={selected === index}
            onClick={() => setSelected(selected === index ? null : index)}
            className={`focus-visible:outline-primary flex min-h-16 items-center justify-between gap-3 rounded-full border px-5 py-3 text-left font-medium transition-colors focus-visible:outline-2 ${selected === index ? "border-primary bg-[#e8f3ef] text-[#164b46]" : "border-[#7b8d87] bg-white hover:bg-[#f1f3f0]"}`}
          >
            <span>{testMode ? valueLabel(option.value) : option.label}</span>
            <Check
              size={20}
              aria-hidden="true"
              className={selected === index ? "shrink-0" : "invisible shrink-0"}
            />
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`${primary} mt-5 w-full`}
        disabled={selected === null}
        onClick={() => {
          if (selected === null || submitted.current) return;
          submitted.current = true;
          onSubmit(question.options[selected].value);
        }}
      >
        선택한 답변으로 다음 <ArrowRight size={18} aria-hidden="true" />
      </button>
    </>
  );
}
export function RecommendationPlayground({
  testMode = false,
}: {
  testMode?: boolean;
}) {
  const initialRequest = () => ({
    ...base(),
    mode: testMode ? ("FIXTURE" as const) : ("PUBLIC" as const),
    ...(testMode
      ? {}
      : {
          category: "",
          selectedChildren: [],
          childProfiles: [],
          needs: [],
          residence: {
            region: "",
            district: "",
            basis: "REGISTERED_RESIDENCE" as const,
            reference: "CURRENT" as const,
          },
        }),
  });
  const [request, setRequest] = useState<Request>(initialRequest);
  const [detail, setDetail] = useState<PublicPolicy | null>(null);
  const [stage, setStage] = useState<
    "INTRO" | "SETUP" | "QUESTIONING" | "PREPARING" | "RESULTS"
  >(testMode ? "SETUP" : "INTRO");
  const [includeChildren, setIncludeChildren] = useState(false);
  const field = RECOMMENDATION_FIELDS.find((f) => f.id === request.category);
  const childrenRequired = testMode || Boolean(field?.children);
  const showChildren = childrenRequired || includeChildren;
  const needs = testMode
    ? RECOMMENDATION_FIELDS[4].needs.slice(0, 2)
    : (field?.needs ?? []);
  const nextChildId = useRef(2);
  const profiles = request.childProfiles ?? [];
  const childLabel = (id: string) => {
    const index = profiles.findIndex((profile) => profile.id === id);
    return index < 0 ? fallbackChildLabel(id) : "자녀 " + (index + 1);
  };
  const [history, setHistory] = useState<Request[]>([]);
  const [editing, setEditing] = useState<QuestionInstance | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const evaluation = useRecommendation(
    request,
    stage !== "INTRO" && stage !== "SETUP",
    testMode,
  );
  const { result, questions } = evaluation;
  const activeAnswers = activateAnswers(request, questions);
  useEffect(() => {
    if (stage !== "QUESTIONING" || !result) return;
    const frame = requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [stage, result]);
  useEffect(() => {
    if (stage !== "PREPARING" || !result) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(
      () => {
        setStage("RESULTS");
        requestAnimationFrame(() => {
          heading.current?.focus();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      },
      reduced ? 250 : 2200,
    );
    return () => window.clearTimeout(timer);
  }, [stage, result]);
  const question = editing ?? result?.nextQuestion;
  function focus() {
    requestAnimationFrame(() => {
      heading.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  function change(next: Request, nextStage = stage) {
    setRequest({ ...next, revision: request.revision + 1 });
    setStage(nextStage);
    focus();
  }
  function respond(
    value?: FactValue,
    state: "DONT_KNOW" | "SKIPPED" = "SKIPPED",
  ) {
    if (!question) return;
    const answer: Answer = {
      key: question.factKey,
      recordedAt: new Date().toISOString(),
      questionId: question.definitionId,
      questionVersion: question.version,
      ...(value
        ? {
            state: "PROVIDED" as const,
            source: "USER_DECLARED" as const,
            value,
          }
        : { state }),
    };
    setHistory([...history, structuredClone(request)]);
    const next = {
      ...request,
      answers: replaceAnswer(request.answers, answer),
      questionCount: editing
        ? request.questionCount
        : request.questionCount + 1,
    };
    let returnResults = Boolean(editing);
    if (!returnResults && testMode) {
      try {
        returnResults =
          evaluateRecommendation(educationFixture, {
            ...next,
            phase: "QUESTIONING",
          }).stopReason === "NO_USEFUL_QUESTION";
      } catch {
        /* 렌더링 단계에서 기존 오류 복구 화면을 표시합니다. */
      }
    }
    setEditing(null);
    change(
      { ...next, phase: returnResults ? "RESULTS" : "QUESTIONING" },
      returnResults ? "PREPARING" : "QUESTIONING",
    );
  }
  function finish() {
    setEditing(null);
    change({ ...request, phase: "RESULTS" }, "PREPARING");
  }
  function previous() {
    if (editing) {
      setEditing(null);
      finish();
      return;
    }
    const previous = history.at(-1);
    if (!previous) {
      setStage("SETUP");
      focus();
      return;
    }
    setHistory(history.slice(0, -1));
    change({ ...previous, phase: "QUESTIONING" }, "QUESTIONING");
  }
  function edit(answer: Answer) {
    const definition = questions.find((q) => q.id === answer.questionId);
    if (!definition) return;
    setEditing({
      key: factKey(answer.key),
      definitionId: definition.id,
      version: definition.version,
      factKey: answer.key,
      prompt: definition.prompt,
      whyAsked: definition.whyAsked,
      options: definition.options,
      affectedPolicyIds: [],
      burden: definition.burden,
      utility: 0,
    });
    change({ ...request, phase: "QUESTIONING" }, "QUESTIONING");
  }
  function reset() {
    setRequest(initialRequest());
    nextChildId.current = 2;
    setDetail(null);
    setIncludeChildren(false);
    setHistory([]);
    setEditing(null);
    setStage(testMode ? "SETUP" : "INTRO");
    focus();
  }
  function configureScope() {
    setEditing(null);
    setHistory([]);
    setStage("SETUP");
    focus();
  }
  function changeCategory(category: string) {
    const selected = RECOMMENDATION_FIELDS.find((f) => f.id === category);
    nextChildId.current = 2;
    setIncludeChildren(false);
    setEditing(null);
    setHistory([]);
    setRequest({
      ...request,
      category,
      selectedChildren: selected?.children ? ["child-1"] : [],
      childProfiles: selected?.children ? [emptyChildProfile("child-1")] : [],
      needs: [],
      answers: [],
      questionCount: 0,
      phase: "QUESTIONING",
      revision: request.revision + 1,
    });
  }
  return (
    <main
      id="main-content"
      className="min-h-[70vh] bg-[#faf8f5] px-5 py-8 text-[#182c29] max-[359px]:px-4 sm:px-8 sm:py-12"
    >
      <div
        className={`mx-auto ${stage === "RESULTS" ? "max-w-6xl" : "max-w-[704px]"}`}
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-600"
          >
            <ArrowLeft size={16} /> 홈으로
          </Link>
          <span className="rounded-md border border-[#dce3de] bg-white px-2 py-1 text-xs font-semibold text-[#52635f]">
            {testMode ? "검증용 정책 · 테스트" : "맞춤 진단"}
          </span>
        </div>
        <p className="mb-6 text-sm leading-6 text-slate-500">
          {testMode
            ? "교복·입학준비 지원의 합성 사례 2개로 질문 흐름을 체험해요. 실제 신청 자격·접수 정보가 아니에요."
            : "거주지와 지원 분야를 선택한 뒤 필요한 정보를 차근차근 확인해요. 답변은 추천 계산을 위해 서버로 전송돼요."}{" "}
          답변은 저장하지 않으며 새로고침하면 초기화돼요.
        </p>
        <section
          className="overflow-hidden rounded-lg border border-[#dce3de] bg-white"
          aria-label={testMode ? "맞춤 추천 테스트" : "맞춤 진단"}
        >
          <div className="border-b border-slate-100 px-6 py-4 sm:px-10">
            <span className="text-sm font-semibold text-[#52635f]">
              아이콤 맞춤 지원 찾기
            </span>
          </div>
          {evaluation.error ? (
            <div className="p-8">
              <p role="alert">{evaluation.error}</p>
              {!testMode && (
                <button onClick={evaluation.retry} className={secondary}>
                  다시 시도
                </button>
              )}
              <button onClick={previous} className={secondary}>
                이전 단계
              </button>
              <button onClick={reset} className={secondary}>
                처음부터
              </button>
            </div>
          ) : stage === "PREPARING" ? (
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-[460px] flex-col items-center justify-center px-6 py-16 text-center"
            >
              <div className={styles.ripple} aria-hidden="true">
                <span />
                <span />
                <span />
                <div className={styles.core}>
                  <Sparkles size={26} />
                </div>
              </div>
              <h1
                ref={heading}
                tabIndex={-1}
                className="text-2xl font-bold outline-none"
              >
                선택한 내용과 관련된 지원을 정리하고 있어요
              </h1>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                선택한 자녀와 답변을 바탕으로
                <br />
                먼저 살펴볼 정책과 확인 사항을 모아드릴게요.
              </p>
              <button className={`${secondary} mt-6`} onClick={configureScope}>
                입력 화면으로 돌아가기
              </button>
            </div>
          ) : evaluation.pending ? (
            <div role="status" className="p-10 text-center text-slate-600">
              <p>답변을 확인하고 있어요…</p>
              <button className={`${secondary} mt-6`} onClick={configureScope}>
                입력 화면으로 돌아가기
              </button>
            </div>
          ) : stage === "INTRO" ? (
            <div className="p-6 sm:p-10">
              <h1
                ref={heading}
                tabIndex={-1}
                className="text-2xl leading-snug font-bold outline-none sm:text-3xl"
              >
                어디에서, 어떤 지원을 찾고 계신가요?
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                거주지와 분야부터 알려주세요. 이후에는 선택한 분야에 필요한 상세
                정보를 여쭤볼게요.
              </p>
              <RecommendationIntake
                residence={
                  request.residence ?? {
                    region: "",
                    district: "",
                    basis: "REGISTERED_RESIDENCE",
                    reference: "CURRENT",
                  }
                }
                category={request.category}
                onResidence={(residence) =>
                  setRequest({ ...request, residence })
                }
                onCategory={changeCategory}
              />
              <button
                className={primary + " mt-8 w-full"}
                disabled={!field}
                onClick={() => {
                  setStage("SETUP");
                  focus();
                }}
              >
                상세 정보 입력하기 <ArrowRight size={18} />
              </button>
            </div>
          ) : stage === "SETUP" ? (
            <div className="p-6 sm:p-10">
              <Users className="mb-5 text-teal-700" size={32} />
              <h1
                ref={heading}
                tabIndex={-1}
                className="text-2xl leading-snug font-bold outline-none sm:text-3xl"
              >
                {childrenRequired ? (
                  <>
                    자녀 정보를
                    <br />
                    알려주세요
                  </>
                ) : (
                  "어떤 지원이 지금 필요하세요?"
                )}
              </h1>
              <p className="mt-3 text-slate-500">
                {childrenRequired
                  ? "자녀 한 명부터 입력하고, 함께 추천받을 자녀를 추가해 주세요."
                  : "관심 있는 지원을 선택해 주세요. 필요한 정책 조건에 맞춰 추가 질문을 드릴게요."}
              </p>
              {!testMode && (
                <p className="mt-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
                  {[
                    request.residence?.region,
                    request.residence?.district,
                    field?.label,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {!childrenRequired && (
                <label className="mt-7 flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="accent-teal-700"
                    checked={includeChildren}
                    onChange={(event) => {
                      setIncludeChildren(event.target.checked);
                      setRequest(
                        withChildProfiles(
                          request,
                          event.target.checked
                            ? [
                                emptyChildProfile(
                                  "child-" + nextChildId.current++,
                                ),
                              ]
                            : [],
                        ),
                      );
                    }}
                  />
                  자녀 관련 지원도 함께 찾을게요
                </label>
              )}
              {showChildren && (
                <RecommendationChildren
                  profiles={profiles}
                  onChange={(children) =>
                    setRequest(withChildProfiles(request, children))
                  }
                  onAdd={() => {
                    if (profiles.length >= 30) return;
                    setRequest(
                      withChildProfiles(request, [
                        ...profiles,
                        emptyChildProfile("child-" + nextChildId.current++),
                      ]),
                    );
                  }}
                />
              )}
              <fieldset className="mt-7">
                <legend className="mb-3 font-semibold">
                  지금 필요한 지원{" "}
                  <span className="font-normal text-slate-500">
                    여러 개 선택 가능
                  </span>
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {needs.map((need) => (
                    <label
                      key={need.id}
                      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-[#7b8d87] p-4"
                    >
                      <input
                        type="checkbox"
                        className="accent-teal-700"
                        checked={request.needs.includes(need.id)}
                        onChange={() =>
                          setRequest({
                            ...request,
                            needs: request.needs.includes(need.id)
                              ? request.needs.filter((n) => n !== need.id)
                              : [...request.needs, need.id],
                          })
                        }
                      />
                      {need.label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  정하지 않았다면 선택하지 않아도 괜찮아요.
                </p>
              </fieldset>
              <button
                className={`${primary} mt-9 w-full`}
                disabled={showChildren && !request.selectedChildren.length}
                onClick={() =>
                  change(
                    { ...request, questionCount: 0, phase: "QUESTIONING" },
                    "QUESTIONING",
                  )
                }
              >
                질문 시작하기 <ArrowRight size={18} />
              </button>
              {!testMode && (
                <button
                  className={secondary + " mt-3 w-full"}
                  onClick={() => {
                    setEditing(null);
                    setHistory([]);
                    setStage("INTRO");
                    focus();
                  }}
                >
                  거주지·분야 변경
                </button>
              )}
            </div>
          ) : stage === "QUESTIONING" ? (
            <div className="p-6 sm:p-10">
              {question ? (
                <>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-800">
                      {question.factKey.subject.kind === "CHILD"
                        ? childLabel(question.factKey.subject.id)
                        : "가구 공통"}
                    </span>
                    <span className="text-sm text-slate-400">
                      {editing
                        ? "답변 수정"
                        : `이번 묶음 ${request.questionCount + 1} / 5`}
                    </span>
                  </div>
                  <h1
                    ref={heading}
                    tabIndex={-1}
                    className="min-h-20 text-2xl leading-snug font-bold outline-none sm:text-3xl"
                  >
                    {question.prompt.replace("[TEST ONLY] ", "")}
                  </h1>
                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {question.whyAsked}
                  </p>
                  <AnswerChoices
                    testMode={testMode}
                    key={`${question.key}:${request.revision}`}
                    question={question}
                    initial={(() => {
                      const a = request.answers.find(
                        (a) => factKey(a.key) === factKey(question.factKey),
                      );
                      return a?.state === "PROVIDED" ? a.value : undefined;
                    })()}
                    onSubmit={(value) => respond(value)}
                  />
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={() => respond(undefined, "DONT_KNOW")}
                      className={secondary}
                    >
                      잘 모르겠어요
                    </button>
                    <button
                      onClick={() => respond(undefined, "SKIPPED")}
                      className={secondary}
                    >
                      건너뛰기
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Check className="mb-5 text-teal-700" size={32} />
                  <h1
                    ref={heading}
                    tabIndex={-1}
                    className="text-2xl font-bold outline-none"
                  >
                    {result?.stopReason === "QUESTION_LIMIT"
                      ? "다섯 가지 답변을 확인했어요"
                      : "지금 확인할 질문을 마쳤어요"}
                  </h1>
                  <p className="mt-4 leading-7 text-slate-500">
                    모르는 정보가 있어도 결과를 볼 수 있어요. 확인하지 못한
                    조건은 결과에 태그로 표시해 드릴게요.
                  </p>
                  {result?.stopReason === "QUESTION_LIMIT" && (
                    <button
                      className={`${secondary} mt-7 w-full`}
                      onClick={() =>
                        change({
                          ...request,
                          questionCount: 0,
                          phase: "QUESTIONING",
                        })
                      }
                    >
                      추가 질문 계속하기
                    </button>
                  )}
                  <button className={`${primary} mt-3 w-full`} onClick={finish}>
                    추천 결과 보기 <ArrowRight size={18} />
                  </button>
                </>
              )}
              <div className="mt-9 flex items-center justify-between border-t border-slate-100 pt-5">
                <button onClick={previous} className="text-sm text-slate-500">
                  ← 이전
                </button>
                {question && (
                  <button
                    onClick={finish}
                    className="text-sm font-semibold text-teal-700"
                  >
                    질문 마치기
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-10 lg:p-12">
              <Sparkles className="mb-5 text-teal-700" size={32} />
              <h1
                ref={heading}
                tabIndex={-1}
                className="text-2xl font-bold outline-none"
              >
                {evaluation.coverage === "AWAITING_REVIEW"
                  ? "맞춤 추천을 준비하고 있어요"
                  : "입력한 내용과 관련된 정책을 모았어요"}
              </h1>
              <div
                role="note"
                aria-label="정책 신청 전 확인 안내"
                className="mt-5 flex items-start gap-3 rounded-lg bg-[#faf8f5] p-5 text-[#8a5700]"
              >
                <CircleAlert
                  size={22}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="font-semibold">
                    신청 전, 공식 안내를 꼭 확인해 주세요
                  </p>
                  <p className="mt-2 text-sm leading-7 break-keep">
                    추천 결과가 지원 대상 확정을 의미하지는 않아요. 각 정책의
                    공식 안내 또는 담당 기관에서 최신 지원 조건·신청 기간·제출
                    서류를 반드시 확인해 주세요.
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {[
                  field?.label,
                  request.residence?.region,
                  request.residence?.district,
                  ...request.selectedChildren.map(childLabel),
                ]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                · 추천 {result?.cards.length ?? 0}개 / 최대 20개
              </p>
              {evaluation.coverage === "AWAITING_REVIEW" && (
                <div className="mt-6 rounded-lg bg-[#faf8f5] p-5 text-sm leading-7 text-[#8a5700]">
                  수집한 정책의 지원 조건을 확인하고 있어요. 아직 맞춤 추천에
                  공개된 정책이 없어 추가 질문을 드리지 않았어요. 받을 수 있는
                  지원이 없다는 뜻은 아니에요.
                  <div className="mt-3 flex flex-wrap gap-4">
                    <Link className="font-semibold underline" href="/policy">
                      수집된 정책 살펴보기
                    </Link>
                    <Link
                      className="font-semibold underline"
                      href="/policy/match/test"
                    >
                      질문 흐름 미리 체험하기
                    </Link>
                  </div>
                </div>
              )}
              <h2 className="mt-8 mb-4 font-bold text-teal-800">
                {result?.cards.length
                  ? `우선 확인 ${Math.min(5, result.cards.length)}개`
                  : evaluation.coverage === "AWAITING_REVIEW"
                    ? "추천 정책 검수 중"
                    : "조건을 다시 확인해 보세요"}
              </h2>
              {!result?.cards.length &&
                evaluation.coverage !== "AWAITING_REVIEW" && (
                  <p className="rounded-lg bg-[#f1f3f0] p-5 leading-7 text-slate-600">
                    {testMode
                      ? "현재 테스트 정책 2개 중 선택한 조건에 맞는 후보가 없어요."
                      : "현재 추천 범위에서 선택한 조건에 맞는 후보가 없어요."}{" "}
                    모든 지원을 받을 수 없다는 뜻은 아니에요. 아래에서 답변을
                    수정해 볼 수 있어요.
                  </p>
                )}
              <div className="space-y-4">
                {result?.cards.map((card, index) => (
                  <article
                    key={card.policyId}
                    className={`${styles.resultRow} ${index < 5 ? styles.featured : ""}`}
                  >
                    <div className="text-center">
                      <span
                        className={`flex aspect-square items-center justify-center rounded-md text-xl font-bold sm:text-2xl ${index < 5 ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}
                      >
                        {index + 1}
                      </span>
                      {index < 5 && (
                        <span className="mt-2 block text-[10px] font-bold tracking-wider text-teal-700">
                          우선
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg leading-7 font-bold [overflow-wrap:anywhere] break-keep sm:text-xl">
                      {card.title.replace("[TEST ONLY] ", "")}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {card.tags.map((tag) => (
                        <span
                          key={tag.subject.id}
                          className="rounded-md border border-[#dce3de] bg-white px-2.5 py-1 text-xs text-slate-700"
                        >
                          {tag.subject.kind === "CHILD"
                            ? childLabel(tag.subject.id)
                            : "가구"}{" "}
                          · {tag.label}
                        </span>
                      ))}
                      {card.representative.availability === "UNKNOWN" && (
                        <span className="rounded-md bg-[#faf8f5] px-2.5 py-1 text-xs text-[#8a5700]">
                          접수 확인 필요
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {card.representative.features[0]?.value === "MATCH" && (
                        <span className="rounded-md border border-[#dce3de] bg-white px-2.5 py-1 text-xs text-slate-700">
                          관심 지원 일치
                        </span>
                      )}
                      {card.tags.filter((tag) => tag.subject.kind === "CHILD")
                        .length > 1 && (
                        <span className="rounded-md border border-[#dce3de] bg-white px-2.5 py-1 text-xs text-slate-600">
                          여러 자녀 관련
                        </span>
                      )}
                      {[
                        ...new Set(
                          card.checksNeeded.map((check) =>
                            check.factKey?.attribute.startsWith("residence.")
                              ? "거주 기준 확인"
                              : check.factKey?.attribute.startsWith("school.")
                                ? "학교 정보 확인"
                                : check.factKey?.attribute.startsWith("entry.")
                                  ? "입학 정보 확인"
                                  : check.factKey?.attribute.startsWith(
                                        "duplicate.",
                                      )
                                    ? "중복 지원 확인"
                                    : "추가 확인 필요",
                          ),
                        ),
                      ].map((label) => (
                        <span
                          key={label}
                          className="rounded-md bg-[#faf8f5] px-2.5 py-1 text-xs text-[#8a5700]"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    {card.representative.reasons.map((reason) => (
                      <p key={reason} className="mt-3 text-sm text-slate-600">
                        {reason}
                      </p>
                    ))}
                    {card.checksNeeded.length > 0 && (
                      <PolicyAccordion
                        className="mt-4 text-sm text-slate-600"
                        title="확인이 필요한 조건"
                      >
                        <ul className="mt-2 space-y-2">
                          {[
                            ...new Map(
                              card.checksNeeded.map((check) => [
                                JSON.stringify(check.factKey ?? check.kind),
                                check,
                              ]),
                            ).values(),
                          ].map((check, i) => {
                            const def = questions.find(
                              (q) =>
                                q.fact.attribute === check.factKey?.attribute &&
                                q.fact.basis === check.factKey?.basis &&
                                q.fact.reference === check.factKey?.reference,
                            );
                            return (
                              <li key={i}>
                                {check.factKey?.subject.kind === "CHILD"
                                  ? `${childLabel(check.factKey.subject.id)} · `
                                  : ""}
                                {def?.prompt ?? "정책 근거 확인이 필요해요."}
                              </li>
                            );
                          })}
                        </ul>
                      </PolicyAccordion>
                    )}
                    <button
                      aria-haspopup="dialog"
                      aria-label={
                        card.title.replace("[TEST ONLY] ", "") + " 상세보기"
                      }
                      className={`${secondary} mt-4 justify-self-start`}
                      onClick={() => {
                        const policy = evaluation.policies.find(
                          (p) => p.id === card.policyId,
                        );
                        if (policy) setDetail(policy);
                        else if (testMode)
                          setDetail({
                            id: card.policyId,
                            name: card.title.replace("[TEST ONLY] ", ""),
                            summary:
                              "질문과 추천 흐름을 검증하기 위한 합성 정책이에요. 실제 신청 가능한 정책이 아니에요.",
                            provider_name: "테스트",
                            purpose_text: null,
                            target_text: null,
                            criteria_text: null,
                            benefit_text: null,
                            application_method_text: null,
                            application_period_text: null,
                            required_documents_text: null,
                            reception_text: null,
                            contact_text: null,
                            source_url: null,
                            application_url: null,
                            updated_at: null,
                          });
                      }}
                    >
                      상세보기
                    </button>
                  </article>
                ))}
              </div>
              <PolicyAccordion
                className="mt-8"
                title={`내 답변 확인·수정 (${request.answers.length}개)`}
              >
                <div className="mt-4 space-y-4">
                  {!request.answers.length && (
                    <p className="text-sm text-slate-600">
                      아직 입력한 답변이 없어요.
                    </p>
                  )}
                  {activeAnswers.map((answer) => (
                    <div
                      key={factKey(answer.key)}
                      className="flex items-start justify-between gap-4 border-t border-slate-100 pt-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-teal-700">
                          {answer.key.subject.kind === "CHILD"
                            ? childLabel(answer.key.subject.id)
                            : "가구 공통"}
                        </p>
                        <p className="mt-1 text-sm">
                          {
                            questions.find((q) => q.id === answer.questionId)
                              ?.prompt
                          }
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {answer.state === "PROVIDED"
                            ? ((!testMode
                                ? questions
                                    .find((q) => q.id === answer.questionId)
                                    ?.options.find(
                                      (o) =>
                                        JSON.stringify(o.value) ===
                                        JSON.stringify(answer.value),
                                    )?.label
                                : null) ?? valueLabel(answer.value))
                            : answer.state === "DONT_KNOW"
                              ? "모름"
                              : "건너뜀"}
                        </p>
                      </div>
                      {!answer.active && (
                        <span className="text-xs text-slate-500">
                          현재 선택에서 사용하지 않는 답변
                        </span>
                      )}
                      <button
                        disabled={!answer.active}
                        onClick={() => edit(answer)}
                        className="shrink-0 text-sm font-semibold text-teal-700 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        수정
                      </button>
                    </div>
                  ))}
                </div>
              </PolicyAccordion>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className={secondary} onClick={configureScope}>
                  상세 정보 변경
                </button>
                <button
                  className={secondary}
                  onClick={() =>
                    change(
                      { ...request, questionCount: 0, phase: "QUESTIONING" },
                      "QUESTIONING",
                    )
                  }
                >
                  더 정확히 찾기
                </button>
                <button className={secondary} onClick={reset}>
                  <RotateCcw size={15} /> 처음부터
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      <PolicyDetailModal
        policy={detail}
        onClose={() => setDetail(null)}
        tags={testMode ? ["테스트 정책"] : []}
      />
    </main>
  );
}
