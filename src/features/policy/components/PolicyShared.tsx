"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  CircleHelp,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice, Skeleton } from "@/components/ui/feedback";
import type { PublicPolicy } from "../public/types";
import { PolicyDetailModal } from "./PolicyDetailModal";
import styles from "./policy-public.module.css";

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
}: {
  policy: PublicPolicy;
  personalized?: boolean;
  recommendation?: { rank: number; reasons: string[]; tags: string[] };
}) {
  const [detailOpen, setDetailOpen] = useState(false);
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
          {[
            ...new Set([
              "추가 확인 필요",
              ...recommendation.tags.filter(
                (tag) => tag !== "잠정 추천" && !tag.includes("추가 확인"),
              ),
            ]),
          ].map((tag) => (
            <span
              key={tag}
              className="rounded border border-slate-200 px-2.5 py-1 text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-500">
        <span>{policy.provider_name || "소관 기관 확인 필요"}</span>
        <span className="rounded bg-slate-100 px-2 py-1">
          신청 일정 원문 확인
        </span>
      </div>
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
      <p className="text-sm leading-6 break-words text-slate-600">
        {policy.summary ||
          policy.purpose_text ||
          "상세 화면에서 정책의 지원 내용을 확인해 주세요."}
      </p>
      <dl className="grid gap-3 border-y border-slate-200 py-4 text-sm">
        <div>
          <dt className="font-semibold text-slate-800">지원 내용</dt>
          <dd className="mt-1 leading-6 break-words text-slate-600">
            {policy.benefit_text || "공식 안내에서 지원 내용을 확인해 주세요."}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-800">지원 대상</dt>
          <dd className="mt-1 leading-6 break-words text-slate-600">
            {policy.target_text || "공식 안내에서 지원 대상을 확인해 주세요."}
          </dd>
        </div>
      </dl>
      {recommendation && recommendation.reasons.length > 0 && (
        <div className="border-t border-slate-200 pt-4 text-sm leading-6 text-slate-700">
          <p className="mb-1 font-semibold text-slate-900">추천 이유</p>
          <ul className="list-disc space-y-1 pl-5">
            {recommendation.reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      {personalized && (
        <div className="space-y-3 border-y py-4 text-sm leading-6">
          <p className="text-primary flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0" />
            관심 분야 관련 원문을 찾았어요. 자격 충족을 의미하지는 않아요.
          </p>
          <p className="flex gap-2 text-slate-600">
            <CircleHelp className="mt-0.5 size-4 shrink-0" />
            추가 확인: 지역·연령·소득과 정책별 기준을 공식 안내에서 확인해
            주세요.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-4">
        <p className="min-w-0 flex-1 basis-56 text-xs leading-5 text-slate-500">
          신청 기간:{" "}
          {policy.application_period_text || "원문 정보 없음 · 기관 확인 필요"}
        </p>
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <PolicyBookmark id={policy.id} />
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            aria-haspopup="dialog"
            aria-label={`${policy.name} 상세 요건 및 신청 안내`}
            onClick={() => setDetailOpen(true)}
          >
            상세 요건 및 신청 안내
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
