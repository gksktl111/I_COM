"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  MapPin,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  initialConditions,
  conditionError,
  interestError,
  questionProfile,
  matchesInterests,
  type PolicyConditions,
} from "../public/types";
import { PolicyConditionFields } from "./PolicyConditionFields";
import {
  CatalogState,
  Pagination,
  PolicyCard,
  PolicyNotice,
  usePolicyCatalog,
} from "./PolicyShared";
export function PolicyMatch() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [conditions, setConditions] = useState(initialConditions);
  const [draft, setDraft] = useState<PolicyConditions | null>(null);
  const [editStep, setEditStep] = useState<1 | 2>(1);
  const [page, setPage] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const catalog = usePolicyCatalog();
  const results = useMemo(
    () =>
      catalog.items.filter((policy) =>
        matchesInterests(policy, conditions.interests),
      ),
    [catalog.items, conditions.interests],
  );
  function move(next: 1 | 2 | 3) {
    setStep(next);
    setPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => heading.current?.focus());
  }
  function openEdit() {
    setValidationError(null);
    setDraft(structuredClone(conditions));
    setEditStep(1);
  }
  const summary = [
    conditions.region
      ? `${conditions.region} ${conditions.district}`.trim()
      : "거주지 미입력",
    ...(conditions.interests.includes("임신·출산")
      ? [
          conditions.family.length
            ? conditions.family.join(", ")
            : "가족 상황 미입력",
        ]
      : []),
    conditions.interests.length
      ? conditions.interests.join(", ")
      : "관심 분야 미선택",
  ];
  const profile = questionProfile(conditions);
  const missing = [
    !conditions.region && "거주 지역",
    profile.children &&
      (!conditions.children.length ||
        conditions.children.some((child) => !child.birth)) &&
      "자녀 생년월일",
    profile.children &&
      conditions.childrenComplete !== "yes" &&
      "전체 자녀 정보",
    conditions.income === "unknown" && "소득 구간",
    conditions.interests[0] === "임신·출산" &&
      conditions.family.includes("임신 중") &&
      conditions.birthTiming === "unknown" &&
      "출산 예정 시기",
    profile.childcare &&
      conditions.children.some((child) => child.care === "unknown") &&
      "보육·교육 이용 현황",
    conditions.interests[0] === "돌봄" &&
      (conditions.careTime === "unknown" ||
        conditions.careType === "unknown") &&
      "필요한 돌봄 시간·형태",
    conditions.interests[0] === "의료·건강" &&
      conditions.healthNeed === "unknown" &&
      "의료·건강 지원 목적",
    conditions.interests[0] === "주거·생활지원" &&
      (conditions.housingType === "unknown" ||
        conditions.livingNeed === "unknown") &&
      "거주 형태·필요한 생활 지원",
  ].filter(Boolean);
  return (
    <main id="main-content" className="min-h-[75vh] bg-slate-50/70 pb-16">
      <nav
        aria-label="맞춤 정책 진행 단계"
        className="sticky top-[var(--app-header-visible-height)] z-30 border-b bg-white transition-[top] duration-180"
      >
        <div className="page-container flex min-h-12 items-center">
          <ol className="flex w-full items-center justify-between gap-2 text-[11px] sm:justify-start sm:gap-7 sm:text-sm">
            {["기본 및 관심 분야", "맞춤 상세 정보", "결과 확인"].map(
              (label, index) => (
                <li
                  key={label}
                  className={`flex items-center gap-2 ${step === index + 1 ? "text-primary font-bold" : "text-slate-500"}`}
                  aria-current={step === index + 1 ? "step" : undefined}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full ${step >= index + 1 ? "bg-primary text-white" : "bg-slate-100"}`}
                  >
                    {step > index + 1 ? (
                      <Check className="size-3" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {label}
                  {index < 2 && (
                    <ArrowRight className="ml-2 hidden size-3 sm:block" />
                  )}
                </li>
              ),
            )}
          </ol>
        </div>
      </nav>
      {step > 1 && (
        <div className="border-b bg-white">
          <div className="page-container flex flex-wrap items-center gap-3 py-4 text-xs">
            <MapPin className="text-primary size-4" />
            <span className="flex-1 leading-6">{summary.join(" · ")}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary min-h-11"
              onClick={openEdit}
            >
              <Pencil />
              조건 수정
            </Button>
          </div>
        </div>
      )}
      <div
        className={`mx-auto px-5 pt-9 ${step === 1 ? "max-w-[720px]" : "max-w-[1040px]"}`}
      >
        <div className="mb-7">
          <div className="mb-4">
            {step > 1 ? (
              <Button
                variant="ghost"
                type="button"
                className="-ml-3"
                onClick={() => move(step === 3 ? 2 : 1)}
              >
                <ArrowLeft />
                이전 단계
              </Button>
            ) : (
              <Button asChild variant="ghost" className="-ml-3">
                <Link href="/policy">
                  <ArrowLeft />
                  정책 둘러보기
                </Link>
              </Button>
            )}
          </div>
          <p className="text-primary mb-2 text-xs font-semibold">
            {step === 3
              ? "우리 가족 정책 탐색 결과"
              : "가족을 위한 지원, 차근차근 함께 찾아요"}
          </p>
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-[28px] leading-snug font-bold outline-none"
          >
            {step === 1
              ? "어떤 지원을 찾고 계신가요?"
              : step === 2
                ? "우리 가족에게 맞는 정책을 찾아볼게요."
                : "우리 가족이 살펴볼 지원 정책"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {step === 3
              ? "관심 분야의 원문을 기준으로 모았어요. 최종 신청 자격은 추가 확인이 필요해요."
              : step === 1
                ? "관심 분야를 먼저 선택하면 아래에 필요한 입력 항목이 표시돼요."
                : "아는 정보만 입력해 주세요. 확인이 필요한 내용은 결과에서 안내해 드릴게요."}
          </p>
        </div>
        {step !== 3 ? (
          <div
            className={
              step === 2
                ? "grid items-start gap-7 lg:grid-cols-[1fr_240px]"
                : ""
            }
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const error =
                  step === 2
                    ? conditionError(conditions)
                    : interestError(conditions);
                setValidationError(error);
                if (!error) move(step === 1 ? 2 : 3);
              }}
            >
              <PolicyConditionFields
                value={conditions}
                onChange={setConditions}
                step={step}
              />
              {validationError && (
                <p role="alert" className="text-destructive mt-4 text-sm">
                  {validationError}
                </p>
              )}
              <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
                <Button type="submit" size="lg">
                  {step === 1
                    ? "상세 정보 입력하기"
                    : "입력한 정보로 정책 찾기"}
                  <ArrowRight />
                </Button>
              </div>
            </form>
            {step === 2 && (
              <aside className="space-y-5 lg:sticky lg:top-36">
                <div className="rounded-xl border bg-white p-5">
                  <ShieldCheck className="text-primary mb-3 size-6" />
                  <h2 className="font-bold">부담 없이 입력하세요</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    입력 정보는 이 화면에서만 사용하며 서버에 저장하거나
                    전송하지 않아요.
                  </p>
                  <div className="mt-5 border-t pt-4 text-xs leading-6 text-slate-500">
                    자격 판정 기준은 검수 중이에요. 관심 분야로 정책을 탐색하고,
                    미입력 정보와 정책 기준 확인 사항을 함께 안내해요.
                  </div>
                </div>
                <div className="border-y py-4 text-xs leading-6 text-slate-500">
                  <CircleHelp className="mb-2 size-4" />
                  모르는 정보는 건너뛰어도 정책 원문과 공식 신청처를 확인할 수
                  있어요.
                </div>
              </aside>
            )}
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-primary font-semibold">
                {conditions.interests[0]} 분야
              </p>
              <Button variant="outline" onClick={openEdit}>
                분야 변경
              </Button>
            </div>
            <section className="mb-7 grid gap-5 rounded-xl border bg-white p-5 md:grid-cols-2">
              <div>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <CircleHelp className="text-primary size-4" />
                  입력 정보 확인
                </h2>
                <p className="text-sm leading-6 text-slate-500">
                  {missing.length
                    ? `아직 확인하지 않은 정보: ${missing.join(", ")}`
                    : "입력한 정보는 준비되었어요. 정책별 추가 요건을 확인해 주세요."}
                </p>
                <Button variant="link" className="px-0" onClick={openEdit}>
                  내 조건 보완하기
                  <ArrowRight />
                </Button>
              </div>
              <div className="border-t pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-5">
                <h2 className="mb-2 text-sm font-bold">정책 기준 확인 필요</h2>
                <p className="text-sm leading-6 text-slate-500">
                  지역·연령·소득과 예외 기준의 자동 비교는 아직 제공하지 않아요.
                  입력을 모두 채워도 지원 대상으로 확정하지 않아요.
                </p>
              </div>
            </section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                추가 확인이 필요한 정책{" "}
                <span className="text-primary">
                  {results.length.toLocaleString()}
                </span>
                건{catalog.nextOffset !== null ? " (불러온 정책 기준)" : ""}
              </p>
            </div>
            <CatalogState
              loading={catalog.loading}
              error={catalog.error}
              empty={!results.length}
              retry={catalog.reload}
            />
            {!catalog.loading &&
              !catalog.error &&
              results
                .slice((page - 1) * 6, page * 6)
                .map((policy) => (
                  <PolicyCard key={policy.id} policy={policy} personalized />
                ))}
            <Pagination
              page={page}
              total={Math.ceil(results.length / 6)}
              onChange={setPage}
            />
            {catalog.nextOffset !== null && (
              <Button
                className="mt-5"
                variant="outline"
                disabled={catalog.loading}
                onClick={catalog.loadMore}
              >
                다음 정책 더 불러오기
              </Button>
            )}
            <PolicyNotice />
          </>
        )}
        {step !== 3 && (
          <p className="mt-8 flex items-start gap-2 border-y py-4 text-xs leading-6 text-slate-500">
            <ShieldCheck className="mt-1 size-4 shrink-0" />
            필수 증빙이나 민감한 진단 정보는 요청하지 않아요. 최종 지원 여부는
            공식 신청처에서 확인해 주세요.
          </p>
        )}
      </div>
      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title="맞춤 조건 수정"
      >
        {draft && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const error = conditionError(draft);
              setValidationError(error);
              if (error) {
                setEditStep(interestError(draft) ? 1 : 2);
                return;
              }
              setConditions(draft);
              setDraft(null);
              setPage(1);
            }}
          >
            <p className="mb-4 text-sm leading-6 text-slate-500">
              입력한 조건을 이어서 수정할 수 있어요.
            </p>
            <div className="mb-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={editStep === 1 ? "default" : "outline"}
                onClick={() => setEditStep(1)}
              >
                기본 및 관심 분야
              </Button>
              <Button
                type="button"
                variant={editStep === 2 ? "default" : "outline"}
                onClick={() => setEditStep(2)}
              >
                맞춤 상세 정보
              </Button>
            </div>
            <PolicyConditionFields
              value={draft}
              onChange={setDraft}
              step={editStep}
            />
            {validationError && (
              <p role="alert" className="text-destructive mt-4 text-sm">
                {validationError}
              </p>
            )}
            <div className="sticky bottom-0 -mx-6 mt-6 -mb-6 flex justify-end gap-3 border-t bg-white p-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraft(null)}
              >
                취소
              </Button>
              <Button type="submit">
                수정한 조건 적용
                <Check />
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </main>
  );
}
