"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { MapSidebar } from "./MapSidebar";
import { MapView } from "./MapView";
import { useSearchParams, useRouter } from "next/navigation";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import type { Place } from "@/features/map/types/place";
import { toast } from "sonner";
import { List, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type PlacesResponse = { results?: Place[]; error?: string };

// 지도 서비스 메인 컴포넌트
export function MapService() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q")?.trim() || "";

  const { location, address, locating, resolving, fetchLocation } =
    useGeolocation({ auto: true });

  const [results, setResults] = useState<Place[]>([]);
  const [searchError, setSearchError] = useState<string>();
  const [isLoading, startTransition] = useTransition();
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);

  const [selectedId, setSelectedId] = useState<string>();
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    results.forEach((place) => {
      const category = place.category || "시설";
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return Array.from(counts, ([name, count]) => ({ name, count }));
  }, [results]);
  const visibleResults = useMemo(
    () =>
      selectedCategories.length
        ? results.filter((place) =>
            selectedCategories.includes(place.category || "시설"),
          )
        : results,
    [results, selectedCategories],
  );

  const canSearch = useMemo(() => !!query && !!location, [query, location]);

  const runSearch = useCallback(async () => {
    if (!canSearch) return;
    setSearchError(undefined);
    try {
      const url = `/api/places?q=${encodeURIComponent(query)}&lat=${location!.lat}&lng=${location!.lng}`;
      const res = await fetch(url);
      const data: PlacesResponse = await res.json();
      if (!res.ok) {
        const message = data?.error || "시설 검색에 실패했습니다.";
        toast.error(message);
        setSearchError(message);
        setResults([]);
        return;
      }
      setResults(data?.results || []);
      setFocus(null); // 새 검색 시 포커스 초기화
      setSelectedId(undefined);
      setSelectedCategories([]);
    } catch (e) {
      console.error(e);
      const message = "시설 정보를 불러오지 못했습니다.";
      toast.error(message);
      setSearchError(message);
      setResults([]);
    }
  }, [canSearch, query, location]);

  useEffect(() => {
    startTransition(runSearch);
  }, [runSearch, startTransition]);

  const handleSearch = useCallback(
    (q: string) => {
      const base = "/map";
      router.push(`${base}?q=${encodeURIComponent(q)}`);
    },
    [router],
  );

  const handleSelect = useCallback((p: Place) => {
    setFocus({ lat: p.lat, lng: p.lng });
    setSelectedId(p.id);
    setMobileView("map");
  }, []);

  const handleRetry = useCallback(() => {
    startTransition(runSearch);
  }, [runSearch, startTransition]);

  const handlePlaceClick = useCallback((place: Place) => {
    setFocus({ lat: place.lat, lng: place.lng });
    setSelectedId(place.id);
    setDetailPlace(place);
  }, []);

  return (
    <main
      id="main-content"
      className="bg-background relative flex h-[calc(100dvh-var(--app-header-height))] min-h-[420px] flex-col"
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`absolute inset-0 z-10 md:relative md:inset-auto md:block md:shrink-0 ${mobileView === "list" ? "block" : "hidden"}`}
        >
          <MapSidebar
            searchResults={visibleResults}
            isLoading={isLoading}
            searchError={searchError}
            onSearch={handleSearch}
            onRetry={handleRetry}
            onSelect={handleSelect}
            query={query}
            selectedId={selectedId}
            categories={categories}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            hasLocation={!!location}
            locationLabel={
              locating
                ? "현재 위치 확인 중…"
                : resolving
                  ? "주소 확인 중…"
                  : address
                    ? `${address} 주변`
                    : location
                      ? "현재 위치 주변"
                      : "위치 확인이 필요합니다"
            }
            locating={locating || resolving}
            onLocate={fetchLocation}
          />
        </div>
        <MapView
          places={visibleResults}
          focus={focus ?? undefined}
          selectedId={selectedId}
          onPlaceClick={handlePlaceClick}
        />
      </div>
      <div
        className="grid shrink-0 grid-cols-2 gap-2 border-t bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="시설 화면 전환"
      >
        <Button
          variant={mobileView === "list" ? "default" : "ghost"}
          aria-pressed={mobileView === "list"}
          className="min-h-11"
          onClick={() => setMobileView("list")}
        >
          <List aria-hidden="true" />
          목록보기
        </Button>
        <Button
          variant={mobileView === "map" ? "default" : "ghost"}
          aria-pressed={mobileView === "map"}
          className="min-h-11"
          onClick={() => setMobileView("map")}
        >
          <MapIcon aria-hidden="true" />
          지도보기
        </Button>
      </div>
      <Dialog
        open={!!detailPlace}
        onClose={() => setDetailPlace(null)}
        title={detailPlace?.name ?? "시설 상세정보"}
      >
        {detailPlace && (
          <div className="space-y-5">
            <span className="bg-muted text-muted-foreground inline-flex rounded-md px-2 py-1 text-sm font-semibold">
              {detailPlace.category || "시설"}
            </span>
            <dl className="space-y-4 text-base">
              <div>
                <dt className="text-muted-foreground mb-1 text-sm font-semibold">
                  주소
                </dt>
                <dd className="leading-relaxed break-words">
                  {detailPlace.address || "주소 정보가 제공되지 않았습니다."}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1 text-sm font-semibold">
                  위치 좌표 (위도, 경도)
                </dt>
                <dd className="break-words tabular-nums">
                  {detailPlace.lat.toFixed(6)}, {detailPlace.lng.toFixed(6)}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Dialog>
    </main>
  );
}
