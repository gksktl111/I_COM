import { NaverMap } from "./NaverMap";
import type { Place } from "@/features/map/types/place";

export function MapView({
  places = [],
  focus,
  selectedId,
  onPlaceClick,
}: {
  places?: Place[];
  focus?: { lat: number; lng: number };
  selectedId?: string;
  onPlaceClick: (place: Place) => void;
}) {
  return (
    <section
      aria-label="주변 시설 지도"
      className="bg-muted relative h-full min-w-0 flex-1"
    >
      <NaverMap
        places={places}
        focus={focus}
        selectedId={selectedId}
        onPlaceClick={onPlaceClick}
      />
      <p className="text-muted-foreground pointer-events-none absolute right-3 bottom-3 left-3 rounded-md border bg-white/95 px-3 py-2 text-center text-xs leading-relaxed md:left-auto">
        방문 전 운영시간과 이용 조건을 시설에 확인해 주세요.
      </p>
    </section>
  );
}
