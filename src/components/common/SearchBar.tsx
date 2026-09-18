"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils/shadcn_utils";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { SEARCH_COPY } from "@/constants/copy";

interface ISearchBarProps {
  className?: string;
  currentLocation?: boolean;
  onSearch?: (q: string) => void;
  initialQuery?: string;
}

export function SearchBar({
  className,
  currentLocation = true,
  onSearch,
  initialQuery = "",
}: ISearchBarProps) {
  const router = useRouter();
  const inputId = useId();
  const [q, setQ] = useState(initialQuery);
  const { fetchLocation, address, locating, resolving } = useGeolocation({
    auto: false,
  });
  const label = locating
    ? "현재 위치 확인 중…"
    : resolving
      ? "주소 변환 중…"
      : address || "현재 위치";

  return (
    <form
      role="search"
      aria-label="주변 시설 검색"
      onSubmit={(event) => {
        event.preventDefault();
        const query = q.trim();
        if (!query) return;
        if (onSearch) onSearch(query);
        else router.push(`/map?q=${encodeURIComponent(query)}`);
      }}
      className={cn(
        "mx-auto flex w-full max-w-xl flex-wrap items-center gap-2",
        className,
      )}
    >
      {currentLocation && (
        <Button
          type="button"
          variant="outline"
          onClick={fetchLocation}
          disabled={locating || resolving}
        >
          {locating || resolving ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <MapPin aria-hidden="true" />
          )}
          <span className="max-w-36 truncate">{label}</span>
        </Button>
      )}
      <div className="min-w-0 flex-1 basis-48">
        <label
          htmlFor={inputId}
          className="text-foreground mb-1.5 block text-sm font-semibold"
        >
          시설명 또는 키워드
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            id={inputId}
            type="search"
            placeholder={SEARCH_COPY.placeholder}
            className="h-12 pl-9"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
      </div>
      <Button type="submit" className="mt-auto h-12" disabled={!q.trim()}>
        검색
      </Button>
    </form>
  );
}
