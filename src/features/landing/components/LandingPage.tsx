import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { HeroSection } from "./HeroSection";
import { TrustSection } from "./TrustSection";
import { Footer } from "@/components/common/Footer";

const destinations = [
  {
    icon: FileSearch,
    title: "정책 직접 둘러보기",
    description: "지원 분야나 지역 키워드로 정책을 검색합니다.",
    href: "/policy",
    action: "정책 목록 보기",
  },
  {
    icon: MapPin,
    title: "주변 시설 찾기",
    description: "어린이집·돌봄센터·도서관 등 가까운 시설을 찾습니다.",
    href: "/map",
    action: "시설 지도 보기",
  },
  {
    icon: MessageCircle,
    title: "커뮤니티",
    description: "정책 경험과 육아 정보를 나눌 공간의 준비 상태를 확인합니다.",
    href: "/community",
    action: "커뮤니티 안내 보기",
  },
];

export function LandingPage() {
  return (
    <>
      <main id="main-content" className="bg-card">
        <HeroSection />
        <TrustSection />

        <section
          aria-labelledby="destinations-heading"
          className="bg-background py-12 sm:py-16"
        >
          <div className="page-container">
            <div className="max-w-2xl">
              <h2
                id="destinations-heading"
                className="text-foreground text-2xl leading-[1.4] font-semibold sm:text-[1.75rem]"
              >
                필요한 정보로 바로 이동하세요
              </h2>
              <p className="text-muted-foreground mt-3 text-base leading-7">
                맞춤 질문 없이도 정책과 시설을 직접 찾아볼 수 있습니다.
              </p>
            </div>

            <ul className="border-border mt-7 divide-y border-y">
              {destinations.map(
                ({ icon: Icon, title, description, href, action }) => (
                  <li
                    key={href}
                    className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8"
                  >
                    <div className="flex min-w-0 gap-3">
                      <Icon
                        aria-hidden="true"
                        className="text-primary mt-0.5 size-5 shrink-0"
                      />
                      <div>
                        <h3 className="text-foreground text-lg font-semibold">
                          {title}
                        </h3>
                        <p className="text-muted-foreground mt-1 text-base leading-7">
                          {description}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={href}
                      className="text-primary ml-8 inline-flex min-h-11 items-center gap-1.5 self-start font-semibold underline-offset-4 hover:underline sm:ml-0 sm:self-auto"
                    >
                      {action}
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </li>
                ),
              )}
            </ul>

            <div className="border-border mt-8 flex max-w-3xl gap-3 border-t pt-6">
              <ShieldCheck
                aria-hidden="true"
                className="text-primary mt-0.5 size-5 shrink-0"
              />
              <p className="text-muted-foreground text-sm leading-6">
                정책 정보는 공공데이터를 바탕으로 안내합니다. 신청 전 최신
                기준을 확인해 주세요.{" "}
                <Link
                  href="/guide"
                  className="text-primary font-semibold underline underline-offset-4"
                >
                  정보 이용 기준 보기
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
