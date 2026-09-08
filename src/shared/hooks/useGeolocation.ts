"use client";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLocationStore } from "../store/location.store";

type ReverseGeocodeResponse = {
  error?: string;
  emd?: string | null;
  address?: string | null;
};

export function useGeolocation(options?: { auto?: boolean }) {
  const attemptedAutoLocation = useRef(false);
  const {
    location,
    address,
    setLocation,
    setAddress,
    locating,
    resolving,
    setLocating,
    setResolving,
  } = useLocationStore();

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        setResolving(true);
        const res = await fetch(`/api/revgeo?lat=${lat}&lng=${lng}`);
        const data: ReverseGeocodeResponse = await res.json();
        if (!res.ok) {
          const msg = data?.error || "주소 변환에 실패했습니다.";
          toast.error(msg);
          setAddress(null);
          return;
        }
        // 동/읍/면(emd) 우선으로 저장, 없으면 전체 주소
        setAddress(data?.emd ?? data?.address ?? null);
      } catch (e) {
        console.error("Reverse geocoding failed", e);
        toast.error("주소 변환 중 오류가 발생했습니다.");
        setAddress(null);
      } finally {
        setResolving(false);
      }
    },
    [setAddress, setResolving],
  );

  const fetchLocation = useCallback(() => {
    if (useLocationStore.getState().locating) return;
    if (!navigator.geolocation) {
      console.error("이 브라우저는 Geolocation API를 지원하지 않습니다.");
      toast.error("이 브라우저에서는 위치 정보를 사용할 수 없습니다.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        setLocating(false);
        // 좌표 저장 후 바로 역지오코딩
        reverseGeocode(lat, lng);
      },
      (err) => {
        console.error("위치 권한 거부 또는 오류:", err);
        toast.error(
          err?.code === 1
            ? "위치 권한을 허용해주세요."
            : "현재 위치를 가져올 수 없습니다.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true },
    );
  }, [setLocating, setLocation, reverseGeocode]);

  // auto 옵션: 최초 마운트/변경 시 자동으로 위치를 가져옵니다.
  useEffect(() => {
    if (
      options?.auto &&
      !location &&
      !locating &&
      !attemptedAutoLocation.current
    ) {
      attemptedAutoLocation.current = true;
      fetchLocation();
    }
  }, [options?.auto, location, locating, fetchLocation]);

  return { location, address, locating, resolving, fetchLocation };
}
