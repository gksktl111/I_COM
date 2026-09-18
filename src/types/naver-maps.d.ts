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
    destroy(): void;
  }

  class Marker {
    constructor(options: {
      position: LatLng;
      map: Map;
      icon?: { content: HTMLElement; anchor?: { x: number; y: number } };
      title?: string;
      clickable?: boolean;
      zIndex?: number;
    });
    setPosition(position: LatLng): void;
    setMap(map: Map | null): void;
    setZIndex(zIndex: number): void;
  }

  type MapEventListener = object;
  namespace Event {
    function addListener(
      target: Marker,
      eventName: "click",
      listener: () => void,
    ): MapEventListener;
    function removeListener(listener: MapEventListener): void;
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
