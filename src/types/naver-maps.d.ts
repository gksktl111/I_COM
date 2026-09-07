// Minimal Naver Maps (v3) types used within this project

export namespace NaverMaps {
  class LatLng {
    constructor(lat: number, lng: number);
  }

  class Map {
    constructor(
      el: HTMLElement,
      options: {
        center: LatLng;
        zoom?: number;
      },
    );
    setCenter(position: LatLng): void;
    panTo(position: LatLng): void;
  }

  class Marker {
    constructor(options: { position: LatLng; map: Map });
    setPosition(position: LatLng): void;
    setMap(map: Map | null): void;
  }
}

declare global {
  interface Window {
    naver?: { maps: typeof NaverMaps };
    __naver_maps_loaded?: boolean;
    __initNaverMaps?: () => void;
  }
}

export {};
