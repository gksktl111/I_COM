// src/features/map/components/NaverMap.tsx
"use client";
import { useGeolocation } from "@/shared/hooks/useGeolocation";
import { useEffect, useRef } from "react";
import type { Place } from "@/features/map/types/place";
import type { NaverMaps } from "@/types/naver-maps";

export function NaverMap({
  places = [],
  focus,
}: {
  places?: Place[];
  focus?: { lat: number; lng: number };
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMaps.Map | null>(null);
  const markersRef = useRef<NaverMaps.Marker[]>([]);
  const userMarkerRef = useRef<NaverMaps.Marker | null>(null);
  const { location } = useGeolocation({ auto: true });

  // Init map once when SDK ready
  useEffect(() => {
    const init = () => {
      if (mapRef.current) return;
      const el = elRef.current;
      const w = window as Window & typeof globalThis;
      if (!el || !w.naver) return;
      const { naver } = w;
      const centerLat = location?.lat ?? 37.5665; // fallback: Seoul
      const centerLng = location?.lng ?? 126.978;
      const center = new naver.maps.LatLng(centerLat, centerLng);
      mapRef.current = new naver.maps.Map(el, { center, zoom: 14 });
      // initial user marker if we already have location
      if (location) {
        userMarkerRef.current = new naver.maps.Marker({
          position: center,
          map: mapRef.current,
        });
      }
    };

    const w = window as Window & typeof globalThis;
    if (w.__naver_maps_loaded) {
      init();
      return;
    }
    const handler = () => init();
    document.addEventListener("naver-maps-loaded", handler, { once: true });
    return () => document.removeEventListener("naver-maps-loaded", handler);
  }, [location]);

  // Update user location: pan and move user marker
  useEffect(() => {
    const m = mapRef.current;
    const w = window as Window & typeof globalThis;
    if (!m || !location || !w.naver) return;
    const { naver } = w;
    const latlng = new naver.maps.LatLng(location.lat, location.lng);
    if (!focus) m.setCenter(latlng);
    if (!userMarkerRef.current) {
      userMarkerRef.current = new naver.maps.Marker({
        position: latlng,
        map: m,
      });
    } else {
      userMarkerRef.current.setPosition(latlng);
    }
  }, [location, focus]);

  // Update places markers
  useEffect(() => {
    const m = mapRef.current;
    const w = window as Window & typeof globalThis;
    if (!m || !w.naver) return;
    const { naver } = w;
    // clear previous
    markersRef.current.forEach((mk) => mk.setMap(null));
    markersRef.current = [];
    places.forEach((p) => {
      const mk = new naver.maps.Marker({
        position: new naver.maps.LatLng(p.lat, p.lng),
        map: m,
      });
      markersRef.current.push(mk);
    });
  }, [places]);

  // Focus selection
  useEffect(() => {
    const m = mapRef.current;
    const w = window as Window & typeof globalThis;
    if (!m || !w.naver || !focus) return;
    const { naver } = w;
    const latlng = new naver.maps.LatLng(focus.lat, focus.lng);
    m.panTo(latlng);
  }, [focus]);

  return <div ref={elRef} style={{ width: "100%", height: "100%" }} />;
}
