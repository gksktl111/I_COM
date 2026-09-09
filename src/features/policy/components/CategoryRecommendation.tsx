"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, Check, Search } from "lucide-react";
import { RecommendationIntake } from "./RecommendationIntake";
import { RecommendationChildren } from "./RecommendationChildren";
import { PolicyCard } from "./PolicyShared";
import { PolicyAccordion } from "./PolicyAccordion";
import {
  RECOMMENDATION_FIELDS,
  type ChildProfile,
  type ResidenceScope,
} from "../recommendation/intake";
import {
  activeBankAnswers,
  getBankQuestions,
  type BankAnswer,
} from "../recommendation/category-bank";
import { DISTRICTS_BY_REGION } from "../public/districts";
import type { PublicPolicy } from "../public/types";
import styles from "./recommendation-playground.module.css";

type Results = {
  flow: "CATEGORY_BANK_V1";
  revision: number;
  policies: {
    policy: PublicPolicy;
    score: number;
    reasons: string[];
    tags: string[];
  }[];
  candidateCount: number;
};
const action =
  "min-h-12 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white hover:bg-[#005f5a] disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "min-h-12 rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-medium text-slate-700 hover:bg-slate-50";
const emptyResidence: ResidenceScope = {
  region: "",
  district: "",
  basis: "REGISTERED_RESIDENCE",
  reference: "CURRENT",
};

export function CategoryRecommendation() {
  const [stage, setStage] = useState<
    "INTRO" | "SETUP" | "QUESTIONS" | "LOADING" | "RESULTS"
  >("INTRO");
  const [category, setCategory] = useState("");
  const [residence, setResidence] = useState(emptyResidence);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<BankAnswer[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const nextId = useRef(1);
  const revision = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const field = RECOMMENDATION_FIELDS.find((item) => item.id === category);
  const context = { category, residence, childProfiles: profiles, needs };
  const active = activeBankAnswers(context, answers);
  const questions = getBankQuestions(context, active);
  const answered = (q: (typeof questions)[number]) =>
    active.find((a) => a.questionId === q.id && a.subjectId === q.subjectId);
  const question =
    questions.find((q) => q.key === editing) ??
    questions.find((q) => !answered(q));

  useEffect(() => {
    heading.current?.focus();
  }, [stage, question?.key]);
  useEffect(() => {
    if (stage !== "LOADING") return;
    const controller = new AbortController();
    let current = true;
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    const requestRevision = ++revision.current;
    let delay: ReturnType<typeof setTimeout> | undefined;
    void fetch("/api/policy-recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        flow: "CATEGORY_BANK_V1",
        revision: requestRevision,
        ...context,
        bankAnswers: active,
        phase: "RESULTS",
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const data = (await response.json()) as Results;
        if (
          data.flow !== "CATEGORY_BANK_V1" ||
          data.revision !== requestRevision ||
          !Array.isArray(data.policies)
        )
          throw new Error("stale");
        if (!current) return;
        const minimum = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? 250
          : 2200;
        delay = setTimeout(() => {
          if (current) {
            setResults(data);
            setStage("RESULTS");
          }
        }, minimum);
      })
      .catch(() => {
        if (current)
          setError(
            "정책 목록을 불러오지 못했어요. 답변은 유지되니 다시 시도해 주세요.",
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timeout);
      clearTimeout(delay);
    };
    // A completed questionnaire is immutable while loading; edits leave this stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, attempt]);

  function addChild() {
    setProfiles((previous) => [
      ...previous,
      { id: `child-${nextId.current++}`, sex: null, birthYear: null },
    ]);
  }
  function respond(state: BankAnswer["state"], value?: string) {
    if (!question) return;
    const previous = active.find(
      (a) => a.questionId === question.id && a.subjectId === question.subjectId,
    );
    const changed =
      previous && (previous.state !== state || previous.value !== value);
    const descendants: Record<string, string[]> = {
      P01: ["P02", "P03", "P04", "C-TIMING"],
      P02: ["P03", "P04"],
      H01: ["H02", "H03", "C-TIMING"],
      B02: ["B03"],
      E01: ["E02", "E03", "E04", "E05"],
      E02: ["E03"],
      L01: ["L02"],
      L03: ["L04"],
    };
    const retained = changed
      ? active.filter(
          (a) =>
            !(
              descendants[question.id]?.includes(a.questionId) &&
              (["P01", "H01"].includes(question.id) ||
                a.subjectId === question.subjectId)
            ),
        )
      : active;
    const next = activeBankAnswers(context, [
      ...retained.filter(
        (a) =>
          a.questionId !== question.id || a.subjectId !== question.subjectId,
      ),
      {
        questionId: question.id,
        subjectId: question.subjectId,
        state,
        ...(state === "PROVIDED" ? { value } : {}),
      },
    ]);
    setAnswers(next);
    setEditing(null);
  }
  function configure() {
    setEditing(null);
    setStage("SETUP");
    setError("");
  }
  function goBack() {
    setError("");
    if (stage === "SETUP") {
      setStage("INTRO");
    } else if (stage === "LOADING" || stage === "RESULTS") {
      setEditing(null);
      setStage("QUESTIONS");
    } else if (stage === "QUESTIONS") {
      const index = question
        ? questions.findIndex((q) => q.key === question.key)
        : questions.length;
      const previous = questions
        .slice(0, index)
        .reverse()
        .find((q) => answered(q));
      if (previous) setEditing(previous.key);
      else configure();
    }
  }

  function load() {
    setError("");
    setResults(null);
    setStage("LOADING");
  }

  return (
    <main
      id="main-content"
      className={`mx-auto min-h-[70vh] px-5 py-8 text-slate-900 sm:px-8 md:py-12 ${stage === "RESULTS" ? "max-w-[1200px]" : "max-w-[840px]"}`}
    >
      <nav aria-label="이전 단계" className="mb-3">
        {stage === "INTRO" ? (
          <Link
            href="/"
            className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            뒤로가기
          </Link>
        ) : (
          <button
            type="button"
            onClick={goBack}
            className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            뒤로가기
          </button>
        )}
      </nav>
      <p className="mb-4 border-b border-slate-200 pb-4 text-sm font-medium text-slate-600">
        맞춤 지원 찾기 ·{" "}
        {stage === "INTRO"
          ? "1. 거주지와 분야"
          : stage === "SETUP"
            ? "2. 기본 정보"
            : stage === "QUESTIONS"
              ? "3. 상세 질문"
              : "추천 결과"}
      </p>
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-2xl leading-snug font-bold break-keep outline-none sm:text-[28px]"
      >
        {stage === "INTRO"
          ? "어떤 지원을 찾고 계신가요?"
          : stage === "SETUP"
            ? `${field?.label ?? "지원"}에 필요한 정보를 알려 주세요`
            : stage === "QUESTIONS"
              ? (question?.prompt ?? "입력한 정보를 확인해 주세요")
              : stage === "LOADING"
                ? "나에게 맞는 정책을 찾고 있어요"
                : "맞춤 정책 추천"}
      </h1>
      {stage === "INTRO" && (
        <>
          <RecommendationIntake
            category={category}
            residence={residence}
            onResidence={setResidence}
            onCategory={(value) => {
              setCategory(value);
              setNeeds([]);
              setAnswers([]);
              setEditing(null);
              const selected = RECOMMENDATION_FIELDS.find(
                (f) => f.id === value,
              );
              setProfiles(
                selected?.children
                  ? [
                      {
                        id: `child-${nextId.current++}`,
                        sex: null,
                        birthYear: null,
                      },
                    ]
                  : [],
              );
            }}
          />
          <button
            className={`${action} mt-8`}
            disabled={!category}
            onClick={() => setStage("SETUP")}
          >
            상세 정보 입력하기
          </button>
        </>
      )}
      {stage === "SETUP" && (
        <>
          {(field?.children || profiles.length > 0) && (
            <RecommendationChildren
              profiles={profiles}
              onChange={(value) => {
                setProfiles(value);
                setAnswers([]);
              }}
              onAdd={() => {
                addChild();
                setAnswers([]);
              }}
            />
          )}
          {!field?.children && (
            <label className="mt-6 flex min-h-14 items-center gap-3 rounded-lg border border-slate-300 bg-white p-4 text-base font-medium">
              <input
                className="size-5 shrink-0"
                type="checkbox"
                checked={profiles.length > 0}
                onChange={(e) => {
                  if (e.target.checked) addChild();
                  else setProfiles([]);
                  setAnswers([]);
                }}
              />
              자녀에 대한 지원도 찾을게요
            </label>
          )}
          <fieldset className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <legend className="px-1 text-lg font-bold">
              지금 필요한 지원{" "}
              <span className="ml-2 text-sm font-normal text-slate-600">
                {category === "housing"
                  ? "필수 · 한 개 이상 선택"
                  : "여러 개 선택 가능"}
              </span>
            </legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {field?.needs.map((need) => (
                <label
                  key={need.id}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-4 text-base font-medium ${needs.includes(need.id) ? "border-primary bg-slate-50 text-slate-950" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  <input
                    className="size-5 shrink-0"
                    type="checkbox"
                    checked={needs.includes(need.id)}
                    onChange={() => {
                      setNeeds((old) =>
                        old.includes(need.id)
                          ? old.filter((id) => id !== need.id)
                          : [...old, need.id],
                      );
                      setAnswers([]);
                    }}
                  />
                  {need.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
            <button className={secondary} onClick={() => setStage("INTRO")}>
              거주지·분야 변경
            </button>
            <button
              className={action}
              disabled={
                (!!field?.children && !profiles.length) ||
                (category === "housing" && !needs.length)
              }
              onClick={() => setStage("QUESTIONS")}
            >
              상세 질문 시작하기
            </button>
          </div>
        </>
      )}
      {stage === "QUESTIONS" && (
        <>
          {question ? (
            <>
              <p className="mt-6 text-base font-semibold text-slate-900">
                {question.subjectLabel}
              </p>
              <p className="mt-2 text-base leading-7 text-slate-600">
                {question.answerType === "REGION"
                  ? "주민등록상 거주지와 다를 수 있어요. 학교가 있는 지역을 알려 주세요."
                  : "상황에 맞는 지원을 찾기 위한 질문이에요. 모르면 건너뛸 수 있어요."}
              </p>
              <BankChoices
                key={question.key}
                question={question}
                initial={answered(question)?.value}
                onSubmit={(value) => respond("PROVIDED", value)}
              />
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <button
                  className="min-h-11 text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-950"
                  onClick={() => respond("DONT_KNOW")}
                >
                  잘 모르겠어요
                </button>
                <button
                  className="min-h-11 text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-950"
                  onClick={() => respond("SKIPPED")}
                >
                  건너뛰기
                </button>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <dl className="grid gap-5 text-base sm:grid-cols-2">
                <div>
                  <dt className="mb-1 text-sm text-slate-600">지원 분야</dt>
                  <dd className="font-semibold">{field?.label}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-sm text-slate-600">거주지</dt>
                  <dd className="font-semibold">
                    {[residence.region, residence.district]
                      .filter(Boolean)
                      .join(" ") || "입력 안 함"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="mb-1 text-sm text-slate-600">관심 지원</dt>
                  <dd className="font-semibold">
                    {field?.needs
                      .filter((n) => needs.includes(n.id))
                      .map((n) => n.label)
                      .join(" · ") || "분야 전체"}
                  </dd>
                </div>
              </dl>
              <p className="mt-5 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">
                아래 답변을 수정하거나 추천 결과를 확인하세요. 모름·건너뛰기로
                남긴 정보는 자격 불충족으로 처리하지 않습니다.
              </p>
            </div>
          )}
          {active.length > 0 && (
            <PolicyAccordion
              key={question ? "answering" : "review"}
              className="mt-8"
              defaultOpen={!question}
              title={`입력한 답변 확인·수정 (${active.length}개)`}
            >
              <ul className="divide-y divide-slate-200">
                {questions
                  .filter((q) => answered(q))
                  .map((q) => (
                    <li key={q.key}>
                      <button
                        className="grid w-full gap-2 rounded py-5 text-left hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:gap-x-6"
                        onClick={() => setEditing(q.key)}
                      >
                        <span className="text-sm leading-6 text-slate-600">
                          <span className="mr-2 font-semibold text-slate-800">
                            {q.subjectLabel}
                          </span>
                          {q.prompt}
                        </span>
                        <span className="font-semibold text-slate-900 sm:col-start-1">
                          {answered(q)?.state === "PROVIDED"
                            ? (q.options.find(
                                (o) => o.value === answered(q)?.value,
                              )?.label ?? answered(q)?.value?.replace("|", " "))
                            : answered(q)?.state === "DONT_KNOW"
                              ? "잘 모름"
                              : "건너뜀"}{" "}
                        </span>
                        <span className="text-primary text-sm font-medium underline underline-offset-4 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center">
                          수정
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </PolicyAccordion>
          )}
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between">
            <button className={secondary} onClick={configure}>
              기본 정보 변경
            </button>
            {!question && (
              <button className={action} onClick={load}>
                추천 결과 보기
              </button>
            )}
          </div>
        </>
      )}
      {stage === "LOADING" && (
        <div className="mt-12 text-center" role="status">
          <div className={styles.ripple} aria-hidden="true">
            <span />
            <span />
            <span />
            <div className={styles.core}>
              <Search />
            </div>
          </div>
          <p>선택한 분야와 답변을 정책 정보와 비교하고 있어요.</p>
          {error && (
            <p className="mt-5 text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="mt-8 flex justify-center gap-3">
            <button className={secondary} onClick={() => setStage("QUESTIONS")}>
              답변으로 돌아가기
            </button>
            {error && (
              <button
                className={action}
                onClick={() => {
                  setError("");
                  setAttempt((v) => v + 1);
                }}
              >
                다시 시도
              </button>
            )}
          </div>
        </div>
      )}
      {stage === "RESULTS" && results && (
        <>
          <div
            role="note"
            aria-label="정책 신청 전 확인 안내"
            className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-800"
          >
            <p className="flex items-center gap-2 font-semibold">
              <CircleAlert size={20} />
              신청 전, 공식 안내를 꼭 확인해 주세요
            </p>
            <p className="mt-2 text-sm leading-7">
              추천 결과가 지원 대상 확정을 의미하지는 않아요. 각 정책의 공식
              안내 또는 담당 기관에서 최신 지원 조건·신청 기간·제출 서류를
              반드시 확인해 주세요.
            </p>
          </div>
          <p className="my-6 border-b border-slate-200 pb-4 text-base text-slate-700">
            관련 정책 {results.candidateCount}개 중 최대 20개를 보여드려요. 상위
            5개를 먼저 살펴보세요.
          </p>
          {!results.policies.length && (
            <p className="rounded-xl bg-slate-50 p-6">
              선택한 분야에 관련된 정책을 찾지 못했어요. 분야나 관심 목적을 바꿔
              다시 찾아보세요.
            </p>
          )}
          <ol className="list-none">
            {results.policies.map((item, index) => (
              <li key={item.policy.id}>
                <PolicyCard
                  policy={item.policy}
                  recommendation={{
                    rank: index + 1,
                    reasons: item.reasons,
                    tags: item.tags,
                  }}
                />
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
            <button className={secondary} onClick={() => setStage("QUESTIONS")}>
              답변 확인·수정
            </button>
            <button className={secondary} onClick={configure}>
              기본 정보 변경
            </button>
            <button
              className={secondary}
              onClick={() => {
                setCategory("");
                setResidence(emptyResidence);
                setProfiles([]);
                setNeeds([]);
                setAnswers([]);
                setResults(null);
                setEditing(null);
                setStage("INTRO");
              }}
            >
              처음부터 찾기
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function BankChoices({
  question,
  initial,
  onSubmit,
}: {
  question: ReturnType<typeof getBankQuestions>[number];
  initial?: string;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [region, district = ""] = value.split("|");
  return (
    <div className="mt-6">
      {question.answerType === "REGION" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            학교 시·도
            <select
              className="mt-2 block min-h-12 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
              value={region}
              onChange={(e) => setValue(`${e.target.value}|`)}
            >
              <option value="">선택해 주세요</option>
              {Object.keys(DISTRICTS_BY_REGION).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            학교 시·군·구
            <select
              className="mt-2 block min-h-12 w-full rounded-lg border border-slate-300 bg-white p-3 text-base"
              disabled={!region}
              value={district}
              onChange={(e) => setValue(`${region}|${e.target.value}`)}
            >
              <option value="">선택 안 함</option>
              {(DISTRICTS_BY_REGION[region] ?? []).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div role="group" aria-label="답변 선택" className="grid gap-3">
          {question.options.map((option) => (
            <button
              key={option.value}
              aria-pressed={value === option.value}
              className={`flex min-h-16 items-center gap-4 rounded-lg border bg-white px-5 py-4 text-left text-base leading-7 ${value === option.value ? "border-primary ring-primary font-semibold text-slate-950 ring-1" : "border-slate-300 text-slate-800 hover:bg-slate-50"}`}
              onClick={() =>
                setValue((old) => (old === option.value ? "" : option.value))
              }
            >
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${value === option.value ? "border-primary bg-primary text-white" : "border-slate-400"}`}
              >
                {value === option.value && <Check size={14} />}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      )}
      <button
        className={`${action} mt-8 w-full sm:w-auto sm:min-w-56`}
        disabled={!value || (question.answerType === "REGION" && !region)}
        onClick={() => onSubmit(value)}
      >
        선택한 답변으로 다음
      </button>
    </div>
  );
}
