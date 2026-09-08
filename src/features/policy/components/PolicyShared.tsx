"use client";
import Link from "next/link";
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
    /* Malformed browser storage is not a saved policy. */
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
}: {
  policy: PublicPolicy;
  personalized?: boolean;
}) {
  return (
    <article className="mb-4 space-y-4 rounded-xl border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-500">
        <span>{policy.provider_name || "소관 기관 확인 필요"}</span>
        <span className="rounded bg-slate-100 px-2 py-1">
          신청 일정 원문 확인
        </span>
      </div>
      <Link href={`/policy/${policy.id}`} className="group block">
        <h2 className="group-hover:text-primary text-lg leading-7 font-bold">
          {policy.name}
        </h2>
      </Link>
      <p className="line-clamp-2 text-sm leading-6 text-slate-600">
        {policy.summary ||
          policy.purpose_text ||
          "상세 화면에서 정책의 지원 내용을 확인해 주세요."}
      </p>
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
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <PolicyBookmark id={policy.id} />
          <Button asChild size="sm" className="min-h-11">
            <Link href={`/policy/${policy.id}`}>
              상세 요건 및 신청 안내
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
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
