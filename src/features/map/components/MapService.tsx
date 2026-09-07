"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapSidebar } from "./MapSidebar";
import { MapView } from "./MapView";
import { useSearchParams, useRouter } from "next/navigation";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import type { Place } from "@/features/map/types/place";
import { toast } from "sonner";

type PlacesResponse = { results?: Place[]; error?: string };

// 지도 서비스 메인 컴포넌트
export function MapService() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q")?.trim() || "";

  const { location } = useGeolocation({ auto: true });

  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);

  const canSearch = useMemo(() => !!query && !!location, [query, location]);

  const runSearch = useCallback(async () => {
    if (!canSearch) return;
    try {
      setIsLoading(true);
      const url = `/api/places?q=${encodeURIComponent(query)}&lat=${location!.lat}&lng=${location!.lng}`;
      const res = await fetch(url);
      const data: PlacesResponse = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "검색에 실패했습니다.");
        setResults([]);
        return;
      }
      setResults(data?.results || []);
      setFocus(null); // 새 검색 시 포커스 초기화
    } catch (e) {
      console.error(e);
      toast.error("검색 중 오류가 발생했습니다.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [canSearch, query, location]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const handleSearch = useCallback(
    (q: string) => {
      const base = "/map";
      router.push(`${base}?q=${encodeURIComponent(q)}`);
    },
    [router],
  );

  const handleSelect = useCallback((p: Place) => {
    setFocus({ lat: p.lat, lng: p.lng });
  }, []);

  return (
    <div className="h-screen flex">
      <MapSidebar searchResults={results} isLoading={isLoading} onSearch={handleSearch} onSelect={handleSelect} />
      <MapView places={results} focus={focus ?? undefined} />
    </div>
  );
}
