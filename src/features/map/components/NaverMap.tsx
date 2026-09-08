"use client";

import { useGeolocation } from "@/shared/hooks/useGeolocation";
import { useEffect, useRef, useState } from "react";
import type { Place } from "@/features/map/types/place";
import type { NaverMaps } from "@/types/naver-maps";
import {
  createLocationMarker,
  createPlaceMarker,
  selectPlaceMarker,
} from "./map-markers";

export function NaverMap({
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
  const elRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<NaverMaps.Map | null>(null);
  const markersRef = useRef<
    { place: Place; marker: NaverMaps.Marker; button: HTMLButtonElement }[]
  >([]);
  const { location } = useGeolocation({ auto: true });

  useEffect(() => {
    let instance: NaverMaps.Map | null = null;
    const init = () => {
      if (instance || !elRef.current || !window.naver) return;
      const { maps } = window.naver;
      instance = new maps.Map(elRef.current, {
        center: new maps.LatLng(37.5665, 126.978),
        zoom: 14,
      });
      setMap(instance);
    };
    // Handle both an already available SDK and data that arrives before the SDK.
    document.addEventListener("naver-maps-loaded", init);
    init();
    return () => {
      document.removeEventListener("naver-maps-loaded", init);
      instance?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!map || !window.naver) return;
    const { maps } = window.naver;
    const entries = places.map((place) => {
      const button = createPlaceMarker(place);
      const activate = () => {
        button.focus({ preventScroll: true });
        onPlaceClick(place);
      };
      const click = (event: MouseEvent) => {
        event.stopPropagation();
        activate();
      };
      const keydown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        activate();
      };
      button.addEventListener("click", click);
      button.addEventListener("keydown", keydown);
      const marker = new maps.Marker({
        position: new maps.LatLng(place.lat, place.lng),
        map,
        icon: { content: button, anchor: { x: 22, y: 42 } },
        title: `${place.name} 시설 상세보기`,
        zIndex: 10,
      });
      const listener = maps.Event.addListener(marker, "click", activate);
      return { place, marker, button, listener, click, keydown };
    });
    markersRef.current = entries;
    return () => {
      entries.forEach(({ marker, button, listener, click, keydown }) => {
        maps.Event.removeListener(listener);
        button.removeEventListener("click", click);
        button.removeEventListener("keydown", keydown);
        marker.setMap(null);
      });
      markersRef.current = [];
    };
  }, [map, places, onPlaceClick]);

  useEffect(() => {
    markersRef.current.forEach(({ place, marker, button }) => {
      const selected = place.id === selectedId;
      selectPlaceMarker(button, selected);
      marker.setZIndex(selected ? 100 : 10);
    });
  }, [map, places, selectedId, onPlaceClick]);

  useEffect(() => {
    if (!map || !location || !window.naver) return;
    const { maps } = window.naver;
    const marker = new maps.Marker({
      position: new maps.LatLng(location.lat, location.lng),
      map,
      icon: { content: createLocationMarker(), anchor: { x: 6, y: 6 } },
      clickable: false,
      zIndex: 1,
    });
    return () => marker.setMap(null);
  }, [map, location]);

  useEffect(() => {
    if (!map || !window.naver) return;
    const target = focus ?? location;
    if (!target) return;
    const position = new window.naver.maps.LatLng(target.lat, target.lng);
    if (focus) map.panTo(position);
    else map.setCenter(position);
  }, [map, focus, location]);

  return <div ref={elRef} style={{ width: "100%", height: "100%" }} />;
}
