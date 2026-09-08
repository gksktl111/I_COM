import { ArrowUpRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import type { Place } from "@/features/map/types/place";

interface ISearchResultListProps {
  results?: Place[];
  isLoading?: boolean;
  onSelect?: (p: Place) => void;
  selectedId?: string;
  query?: string;
  hasLocation?: boolean;
}

export function SearchResultList({
  results = [],
  isLoading = false,
  onSelect,
  selectedId,
  query = "",
  hasLocation = true,
}: ISearchResultListProps) {
  if (isLoading)
    return (
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        role="status"
        aria-label="시설 검색 중"
      >
        <span className="sr-only">주변 시설을 검색하고 있습니다.</span>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-4 border-b p-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );

  if (!results.length)
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EmptyState
          title={
            !hasLocation
              ? "내 위치를 먼저 확인해 주세요"
              : query
                ? "검색된 시설이 없습니다"
                : "우리 동네 시설을 찾아보세요"
          }
          description={
            !hasLocation
              ? "위치 권한을 허용하면 현재 위치를 기준으로 시설을 검색할 수 있어요."
              : query
                ? "다른 시설명이나 키워드로 검색하거나 시설 유형 선택을 해제해 보세요."
                : "어린이집, 도서관 등 시설명이나 키워드를 입력해 주세요."
          }
        />
      </div>
    );

  return (
    <ul
      className="min-h-0 flex-1 divide-y overflow-y-auto"
      aria-label="시설 검색 결과"
    >
      {results.map((result) => (
        <li key={result.id}>
          <button
            type="button"
            onClick={() => onSelect?.(result)}
            aria-pressed={selectedId === result.id}
            className={`group w-full border-l-4 p-5 text-left transition-colors focus-visible:relative focus-visible:z-10 ${selectedId === result.id ? "border-l-primary bg-accent" : "hover:bg-muted/50 border-l-transparent"}`}
          >
            <Badge
              variant="secondary"
              className="max-w-full text-left whitespace-normal"
            >
              {result.category || "시설"}
            </Badge>
            <h3 className="group-hover:text-primary mt-3 text-lg leading-snug font-bold">
              {result.name}
            </h3>
            <p className="text-muted-foreground mt-2 flex gap-2 text-sm leading-relaxed">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {result.address || "주소 정보가 제공되지 않았습니다."}
            </p>
            <span className="text-primary mt-4 flex items-center justify-end gap-1 text-sm font-semibold">
              지도에서 보기
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
