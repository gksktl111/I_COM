"use client";

import { useState } from "react";
import { LocateFixed, Loader2, SlidersHorizontal } from "lucide-react";
import { SearchBar } from "@/components/common/SearchBar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { SearchResultList } from "./SearchResultList";
import type { Place } from "@/features/map/types/place";

type Category = { name: string; count: number };
interface IMapSidebarProps {
  searchResults: Place[];
  isLoading: boolean;
  searchError?: string;
  onSearch: (q: string) => void;
  onRetry: () => void;
  onSelect: (p: Place) => void;
  query: string;
  selectedId?: string;
  categories: Category[];
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  locationLabel: string;
  hasLocation: boolean;
  locating: boolean;
  onLocate: () => void;
}

export function MapSidebar({
  searchResults,
  isLoading,
  searchError,
  onSearch,
  onRetry,
  onSelect,
  query,
  selectedId,
  categories,
  selectedCategories,
  onCategoriesChange,
  locationLabel,
  hasLocation,
  locating,
  onLocate,
}: IMapSidebarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const matchingCount = categories.reduce(
    (count, category) =>
      count +
      (!draft.length || draft.includes(category.name) ? category.count : 0),
    0,
  );

  return (
    <aside
      aria-label="시설 검색 및 목록"
      className="flex h-full min-h-0 w-full flex-col border-r bg-white md:w-[390px] lg:w-[420px]"
    >
      <div className="border-b p-4 min-[360px]:p-5">
        <h1 className="text-2xl leading-[1.4] font-semibold tracking-[-0.01em] md:text-[1.75rem]">
          주변 시설 찾기
        </h1>
        <p className="text-muted-foreground mt-2 mb-5 text-base leading-relaxed">
          아이와 함께할 우리 동네 공간을 찾아보세요.
        </p>
        <SearchBar
          key={query}
          initialQuery={query}
          currentLocation={false}
          onSearch={onSearch}
        />
        <div className="mt-3 flex items-start justify-between gap-2">
          <span className="text-muted-foreground min-w-0 flex-1 pt-2.5 text-sm leading-relaxed break-words">
            {locationLabel}
          </span>
          <Button
            variant="ghost"
            onClick={onLocate}
            disabled={locating}
            className="text-primary shrink-0"
          >
            {locating ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <LocateFixed aria-hidden="true" />
            )}
            내 위치
          </Button>
        </div>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          현재 위치를 기준으로 검색합니다. 위치 권한을 허용해 주세요.
        </p>
      </div>
      <div className="border-b px-4 py-3 min-[360px]:px-5">
        <p className="mb-2 text-sm font-semibold">빠른 검색</p>
        <div
          className="flex gap-2 overflow-x-auto pb-2"
          aria-label="시설 키워드 바로 검색"
        >
          {["어린이집", "유치원", "돌봄센터", "도서관"].map((keyword) => (
            <Chip
              key={keyword}
              selected={query === keyword}
              className="shrink-0"
              onClick={() => onSearch(keyword)}
            >
              {keyword}
            </Chip>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm leading-relaxed" aria-live="polite">
            {isLoading ? (
              "시설을 검색하고 있습니다"
            ) : (
              <>
                검색 결과{" "}
                <strong className="text-primary">
                  {searchResults.length}곳
                </strong>
              </>
            )}
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(selectedCategories);
              setFiltersOpen(true);
            }}
          >
            <SlidersHorizontal aria-hidden="true" />
            시설 유형
            {selectedCategories.length > 0 && ` (${selectedCategories.length})`}
          </Button>
        </div>
        {selectedCategories.length > 0 && (
          <Button
            variant="link"
            className="h-11 px-0"
            onClick={() => onCategoriesChange([])}
          >
            시설 유형 선택 해제
          </Button>
        )}
      </div>
      <SearchResultList
        results={searchResults}
        isLoading={isLoading}
        error={searchError}
        onSelect={onSelect}
        onRetry={onRetry}
        selectedId={selectedId}
        query={query}
        hasLocation={hasLocation}
      />
      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="시설 유형 상세 설정"
      >
        <p className="text-muted-foreground mb-5 text-base leading-relaxed">
          검색된 시설 중 보고 싶은 유형을 선택해 주세요. 여러 유형을 함께 선택할
          수 있습니다.
        </p>
        <fieldset>
          <legend className="mb-3 font-semibold">
            시설 유형{" "}
            <span className="text-primary ml-2 text-sm font-normal">
              {draft.length ? `${draft.length}개 선택됨` : "전체"}
            </span>
          </legend>
          {categories.length ? (
            <div className="space-y-2">
              {categories.map((category) => (
                <label
                  key={category.name}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-base ${draft.includes(category.name) ? "border-primary bg-accent" : "border-input bg-white"}`}
                >
                  <input
                    type="checkbox"
                    className="accent-primary size-4 shrink-0"
                    checked={draft.includes(category.name)}
                    onChange={(event) =>
                      setDraft(
                        event.target.checked
                          ? [...draft, category.name]
                          : draft.filter((name) => name !== category.name),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 break-words">
                    {category.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {category.count}곳
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-5 text-sm">
              시설을 검색하면 선택 가능한 유형이 표시됩니다.
            </p>
          )}
        </fieldset>
        <Notice className="mt-6">
          시설 유형은 검색 결과에서 제공된 정보를 기준으로 표시합니다. 방문 전
          운영시간과 이용 조건은 해당 시설에 확인해 주세요.
        </Notice>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => setDraft([])}>
            선택 초기화
          </Button>
          <Button
            className="whitespace-normal"
            onClick={() => {
              onCategoriesChange(draft);
              setFiltersOpen(false);
            }}
          >
            선택 적용하기 · {matchingCount}곳
          </Button>
        </div>
      </Dialog>
    </aside>
  );
}
