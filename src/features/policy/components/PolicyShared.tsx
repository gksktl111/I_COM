"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight, Bookmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice, Skeleton } from "@/components/ui/feedback";
import type { PublicPolicy } from "../public/types";
import { PolicyDetailModal } from "./PolicyDetailModal";
import styles from "./policy-public.module.css";

const categoryLabels: Record<string, string> = {
  pregnancy: "임신·출산",
  childcare: "양육·보육",
  care: "돌봄",
  health: "의료·건강",
  education: "아동 교육",
  housing: "주거·생활지원",
};

export function PolicyNotice() {
  return (
    <Notice className="mt-10 py-5">
      공공데이터를 바탕으로 정책 정보를 안내합니다. 접수 일정과 지원 기준은
      변경될 수 있으며, 최종 지원 대상과 지급액은 소관 기관의 심사로 결정됩니다.
      신청 전 공식 안내를 확인해 주세요.
    </Notice>
  );
}
function bookmarkSnapshot() {
  try {
    return localStorage.getItem("icom-policy-bookmarks") ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribeBookmarks(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("icom-bookmarks", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("icom-bookmarks", listener);
  };
}
export function PolicyBookmark({ id }: { id: string }) {
  const snapshot = useSyncExternalStore(
    subscribeBookmarks,
    bookmarkSnapshot,
    () => "[]",
  );
  let saved = false;
  try {
    const ids: unknown = JSON.parse(snapshot);
    saved = Array.isArray(ids) && ids.includes(id);
  } catch {
    /* 잘못된 브라우저 저장값은 보관한 정책으로 처리하지 않습니다. */
  }
  const [message, setMessage] = useState("");
  function toggle() {
    try {
      const raw: unknown = JSON.parse(
        localStorage.getItem("icom-policy-bookmarks") ?? "[]",
      );
      const ids: string[] = Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === "string")
        : [];
      localStorage.setItem(
        "icom-policy-bookmarks",
        JSON.stringify(
          saved
            ? ids.filter((item) => item !== id)
            : [...new Set([...ids, id])],
        ),
      );
      window.dispatchEvent(new Event("icom-bookmarks"));
      setMessage(
        saved
          ? "이 기기의 보관함에서 삭제했어요."
          : "이 기기의 보관함에 저장했어요.",
      );
    } catch {
      setMessage("브라우저 저장 공간을 사용할 수 없어요.");
    }
  }
  return (
    <span className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={saved}
        onClick={toggle}
        className="min-h-11 text-slate-500"
      >
        <Bookmark className={saved ? "fill-primary text-primary" : ""} />
        {saved ? "저장됨" : "보관함"}
      </Button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </span>
  );
}
export function PolicyCard({
  policy,
  personalized = false,
  recommendation,
  variant = "recommendation",
}: {
  policy: PublicPolicy;
  personalized?: boolean;
  recommendation?: { rank: number; reasons: string[]; tags: string[] };
  variant?: "catalog" | "recommendation";
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const primaryBenefit =
    policy.summary ||
    policy.benefit_text ||
    policy.purpose_text ||
    "상세 화면에서 지원 내용을 확인해 주세요.";
  const detailTags = recommendation
    ? [
        ...new Set(
          recommendation.tags.filter(
            (tag) => tag !== "잠정 추천" && !tag.includes("추가 확인"),
          ),
        ),
      ]
    : [];
  const reviewLabel = recommendation?.tags.includes("직접 확인 필요")
    ? "직접 확인 필요"
    : "추가 확인 필요";
  const categoryTags = [
    ...new Set(
      (policy.reviewedScope ?? policy.classifiedScope)?.categories
        .map((category) => categoryLabels[category])
        .filter((label): label is string => Boolean(label)) ?? [],
    ),
  ];

  if (variant === "catalog") {
    return (
      <article
        className={`${styles.policyCard} flex h-full flex-col gap-5 p-5 sm:p-6`}
      >
        <div className="flex flex-wrap gap-2" aria-label="관련 분야">
          {(categoryTags.length ? categoryTags : ["관련 분야 확인 중"]).map(
            (tag) => (
              <span
                key={tag}
                className="border-border rounded-sm border px-2.5 py-1 text-xs font-semibold text-slate-600"
              >
                {tag}
              </span>
            ),
          )}
        </div>
        <h2 className="text-lg leading-7 font-bold">
          <Link
            href={`/policy/${policy.id}`}
            className="hover:text-primary focus-visible:outline-primary inline-flex min-h-11 items-center rounded [overflow-wrap:anywhere] break-keep focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {policy.name}
          </Link>
        </h2>
        <dl className="border-y border-slate-200 py-4 text-sm">
          <div>
            <dt className="font-semibold text-slate-800">신청 기간</dt>
            <dd
              className={`${styles.shortPreviewText} mt-1 leading-6 break-words text-slate-600`}
            >
              {policy.application_period_text ||
                "원문 정보 없음 · 기관 확인 필요"}
            </dd>
          </div>
        </dl>
        <div className="mt-auto flex justify-end">
          <Button asChild size="sm" className="min-h-11">
            <Link href={`/policy/${policy.id}`}>
              상세보기
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`${styles.policyCard} mb-4 flex flex-col gap-4 p-5 sm:p-6`}
    >
      {recommendation && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={
              recommendation.rank <= 5
                ? "border-primary rounded-md border bg-white px-2.5 py-1 font-semibold text-[#164b46]"
                : "font-semibold text-slate-600"
            }
          >
            {recommendation.rank <= 5
              ? `우선 추천 ${recommendation.rank}`
              : `추천 ${recommendation.rank}`}
          </span>
          <span className="text-slate-600">{reviewLabel}</span>
        </div>
      )}
      <h2 className="text-lg leading-7 font-bold">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setDetailOpen(true)}
          className="hover:text-primary focus-visible:outline-primary min-h-11 cursor-pointer rounded text-left [overflow-wrap:anywhere] break-keep focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {policy.name}
        </button>
      </h2>
      <p
        className={`${styles.previewText} text-sm leading-6 break-words text-slate-700`}
      >
        {primaryBenefit}
      </p>
      <dl className="grid gap-3 border-y border-slate-200 py-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-800">지원 대상</dt>
          <dd
            className={`${styles.previewText} mt-1 leading-6 break-words text-slate-600`}
          >
            {policy.target_text || "공식 안내에서 지원 대상을 확인해 주세요."}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-800">신청 기간</dt>
          <dd
            className={`${styles.shortPreviewText} mt-1 leading-6 break-words text-slate-600`}
          >
            {policy.application_period_text ||
              "원문 정보 없음 · 기관 확인 필요"}
          </dd>
        </div>
      </dl>
      {recommendation && (
        <details className="border-b border-slate-200 pb-4 text-sm leading-6 text-slate-700">
          <summary className="text-primary flex min-h-11 cursor-pointer items-center font-semibold">
            추천 이유와 확인 조건
          </summary>
          {recommendation.reasons.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {recommendation.reasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {detailTags.length > 0 && (
            <p className="mt-3 text-slate-600">
              확인할 조건: {detailTags.join(" · ")}
            </p>
          )}
        </details>
      )}
      {personalized && (
        <p className="text-primary text-sm leading-6">
          관심 분야와 관련된 원문입니다. 자격 충족 여부는 공식 안내에서 확인해
          주세요.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-slate-500">
          {policy.provider_name || "소관 기관 확인 필요"}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PolicyBookmark id={policy.id} />
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            aria-haspopup="dialog"
            aria-label={`${policy.name} 상세 요건 및 신청 안내`}
            onClick={() => setDetailOpen(true)}
          >
            상세보기
            <ArrowRight />
          </Button>
        </div>
      </div>
      <PolicyDetailModal
        policy={detailOpen ? policy : null}
        onClose={() => setDetailOpen(false)}
        tags={recommendation ? ["추가 확인 필요", ...recommendation.tags] : []}
      />
    </article>
  );
}
async function fetchCatalog(
  offset = 0,
  signal?: AbortSignal,
): Promise<{ items: PublicPolicy[]; nextOffset: number | null }> {
  const response = await fetch(`/api/policies?offset=${offset}`, { signal });
  if (!response.ok) throw new Error("unavailable");
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error("invalid");
  return data;
}
export function usePolicyCatalog() {
  const [items, setItems] = useState<PublicPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  async function load(offset = 0) {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchCatalog(offset);
      setItems((previous) =>
        offset ? [...previous, ...data.items] : data.items,
      );
      setNextOffset(data.nextOffset);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(0, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setItems(data.items);
          setNextOffset(data.nextOffset);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);
  return {
    items,
    loading,
    error,
    nextOffset,
    reload: () => load(),
    loadMore: () => nextOffset !== null && load(nextOffset),
  };
}
export function CatalogState({
  loading,
  error,
  empty,
  retry,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  retry: () => void;
}) {
  if (loading)
    return (
      <div
        role="status"
        aria-label="정책을 불러오는 중"
        className="space-y-5 py-8"
      >
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  if (error || empty)
    return (
      <EmptyState
        title={error ? "정책 정보를 불러오지 못했어요" : "표시할 정책이 없어요"}
        description={
          error
            ? "잠시 후 다시 시도해 주세요."
            : "검색어와 관심 분야를 넓혀 다시 찾아보세요."
        }
        action={
          error ? (
            <Button variant="outline" onClick={retry}>
              <RefreshCw />
              다시 불러오기
            </Button>
          ) : undefined
        }
      />
    );
  return null;
}
export function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= 1) return null;
  return (
    <nav
      aria-label="정책 목록 페이지"
      className="mt-8 flex items-center justify-center gap-2"
    >
      <Button
        variant="ghost"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        이전
      </Button>
      <span className="text-muted-foreground min-w-16 text-center text-sm font-semibold tabular-nums sm:hidden">
        {page} / {total}
      </span>
      <div className="hidden items-center gap-2 sm:flex">
        {Array.from(
          { length: Math.min(5, total) },
          (_, index) =>
            Math.min(Math.max(1, page - 2), Math.max(1, total - 4)) + index,
        ).map((number) => (
          <Button
            key={number}
            size="icon"
            variant={number === page ? "default" : "ghost"}
            aria-current={number === page ? "page" : undefined}
            onClick={() => onChange(number)}
          >
            {number}
          </Button>
        ))}
      </div>
      <Button
        variant="ghost"
        disabled={page === total}
        onClick={() => onChange(page + 1)}
      >
        다음
      </Button>
    </nav>
  );
}
