"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  INTERESTS,
  matchesInterests,
  policyText,
  REGIONS,
} from "../public/types";
import {
  CatalogState,
  Pagination,
  PolicyCard,
  PolicyNotice,
  usePolicyCatalog,
} from "./PolicyShared";
import styles from "./policy-public.module.css";
export function PolicyFinder() {
  const catalog = usePolicyCatalog();
  const searchParams = useSearchParams();
  const initialQuery = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const [query, setQuery] = useState(initialQuery);
  const [keyword, setKeyword] = useState(initialQuery);
  const [interest, setInterest] = useState("");
  const [region, setRegion] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const filtered = useMemo(
    () =>
      catalog.items
        .filter(
          (policy) =>
            policyText(policy).toLowerCase().includes(keyword.toLowerCase()) &&
            matchesInterests(policy, interest ? [interest] : []) &&
            (!region ||
              policyText(policy).includes(
                region.replace(/특별자치도|특별자치시|특별시|광역시|도$/g, ""),
              )),
        )
        .sort((a, b) =>
          sort === "updated"
            ? (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
            : a.name.localeCompare(b.name, "ko"),
        ),
    [catalog.items, keyword, interest, region, sort],
  );
  function reset() {
    setQuery("");
    setKeyword("");
    setInterest("");
    setRegion("");
    setPage(1);
  }
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.content}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className={styles.pageTitle}>정책 둘러보기</h1>
            <p className={`${styles.bodyCopy} mt-3 max-w-2xl`}>
              수집된 정부·지자체의 육아·가족 지원 정책을 살펴보고, 지원 내용과
              신청 방법을 확인해 보세요.
            </p>
          </div>
          <Button asChild>
            <Link href="/policy/match">
              우리 가족 맞춤 정책 찾기
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <section
          aria-label="정책 검색 필터"
          className={`${styles.questionSurface} mb-8 p-5 md:p-6`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="policy-region"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <MapPin className="text-primary size-4" />
              지역 키워드
            </label>
            <Select
              id="policy-region"
              value={region}
              onChange={(event) => {
                setRegion(event.target.value);
                setPage(1);
              }}
              className="w-48"
            >
              <option value="">전체 지역</option>
              {REGIONS.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
            <Button
              variant="ghost"
              className="ml-auto text-slate-500"
              onClick={reset}
            >
              <RotateCcw />
              필터 초기화
            </Button>
          </div>
          <div className="my-5 flex flex-wrap items-center gap-2">
            <span className="mr-3 text-sm font-semibold">관심 분야</span>
            {["전체", ...INTERESTS].map((name) => (
              <Chip
                key={name}
                selected={interest === (name === "전체" ? "" : name)}
                onClick={() => {
                  setInterest(name === "전체" ? "" : name);
                  setPage(1);
                }}
              >
                {name}
              </Chip>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setKeyword(query.trim());
              setPage(1);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <label htmlFor="policy-search" className="sr-only">
                정책명, 지원 내용 또는 기관명
              </label>
              <Search className="absolute top-3.5 left-3 size-4 text-slate-400" />
              <Input
                id="policy-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="정책명, 지원 내용, 기관명으로 검색해 보세요"
                className="pl-10"
              />
            </div>
            <Button type="submit">검색</Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            지역과 분야는 정책 원문 속 단어로 검색합니다. 실제 적용 지역과 신청
            자격은 상세 요건을 확인해 주세요.
          </p>
        </section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold" aria-live="polite">
            검색 결과{" "}
            <span className="text-primary">
              {filtered.length.toLocaleString()}
            </span>
            건
            {catalog.nextOffset !== null && (
              <span className="ml-2 font-normal text-slate-500">
                불러온 정책 기준
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-slate-400" />
            <Select
              aria-label="정책 정렬"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              className="w-40"
            >
              <option value="name">정책명순</option>
              <option value="updated">저장 정보 변경순</option>
            </Select>
          </div>
        </div>
        <CatalogState
          loading={catalog.loading}
          error={catalog.error}
          empty={!filtered.length}
          retry={catalog.reload}
        />
        {!catalog.loading && !catalog.error && (
          <div className={styles.cardGrid}>
            {filtered.slice((page - 1) * 8, page * 8).map((policy) => (
              <PolicyCard key={policy.id} policy={policy} variant="catalog" />
            ))}
          </div>
        )}
        <Pagination
          page={page}
          total={Math.ceil(filtered.length / 8)}
          onChange={setPage}
        />
        {catalog.nextOffset !== null && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              disabled={catalog.loading}
              onClick={catalog.loadMore}
            >
              다음 정책 더 불러오기
            </Button>
          </div>
        )}
        <PolicyNotice />
      </div>
    </main>
  );
}
