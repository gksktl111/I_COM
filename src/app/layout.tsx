import type React from "react";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import "./globals.css";
import Script from "next/script";
import { ToasterProvider } from "@/components/common/ToasterProvider";

// 메타데이터 설정 - 페이지 제목과 설명 정의
export const metadata: Metadata = {
  title: "아이콤 - 우리 가족을 위한 복지 나침반",
  description:
    "임신·출산부터 양육·보육까지, 정부와 지자체의 지원 정책 및 우리 동네 시설을 한곳에서 찾아보세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const key = process.env.NEXT_PUBLIC_NCP_KEY_ID;

  return (
    <html lang="ko">
      <body>
        <Suspense fallback={null}>{children}</Suspense>
        {/* 콜백 핑퐁: SDK 준비되면 커스텀 이벤트 발생 */}
        <Script id="naver-maps-callback" strategy="beforeInteractive">
          {`
            window.__naver_maps_loaded = false;
            window.__initNaverMaps = function () {
              window.__naver_maps_loaded = true;
              document.dispatchEvent(new Event('naver-maps-loaded'));
            };
          `}
        </Script>

        {/* 공식 가이드: ncpKeyId + callback (키가 있을 때만 주입) */}
        {key ? (
          <Script
            src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${key}&callback=__initNaverMaps`}
            strategy="afterInteractive"
          />
        ) : null}

        {/* 개발 환경 안내 배너: 키 미설정 시 친화적 메시지 */}
        {!key && process.env.NODE_ENV !== "production" ? (
          <div
            style={{
              position: "fixed",
              bottom: 12,
              left: 12,
              right: 12,
              zIndex: 50,
            }}
            className="pointer-events-none flex justify-center"
          >
            <div className="pointer-events-auto max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
              <p className="text-sm font-medium">
                NEXT_PUBLIC_NCP_KEY_ID가 설정되지 않았습니다. .env.local 파일에
                키를 추가하면 지도 SDK가 로드됩니다.
              </p>
            </div>
          </div>
        ) : null}
        <ToasterProvider />
        <Analytics />
      </body>
    </html>
  );
}
