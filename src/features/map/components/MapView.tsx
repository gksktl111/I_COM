import { MapPin } from "lucide-react";
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
      className="relative h-full min-w-0 flex-1 bg-[#e4eafa]"
    >
      <NaverMap
        places={places}
        focus={focus}
        selectedId={selectedId}
        onPlaceClick={onPlaceClick}
      />
      <div className="pointer-events-none absolute top-4 left-4 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-lg border bg-white/95 px-4 py-3 text-sm shadow-sm">
        <MapPin aria-hidden="true" className="text-primary size-4 shrink-0" />
        <span>지도에서 시설 핀을 누르면 상세 정보를 확인할 수 있어요.</span>
      </div>
      <p className="text-muted-foreground pointer-events-none absolute right-3 bottom-3 left-3 rounded border bg-white/95 px-3 py-2 text-center text-xs leading-relaxed md:left-auto">
        시설 정보는 제공처 사정에 따라 변경될 수 있습니다. · © I-Compass
      </p>
    </section>
  );
}
