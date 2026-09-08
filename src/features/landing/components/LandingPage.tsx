import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  FileText,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { HeroSection } from "./HeroSection";
import { TrustSection } from "./TrustSection";
import { Footer } from "@/components/common/Footer";

const services = [
  {
    icon: FileText,
    tag: "정책",
    title: "지원 정책, 조건을 입력하기 전에 먼저 둘러보세요",
    description: "지원 내용과 대상, 신청 방법을 확인할 수 있어요.",
    href: "/policy",
  },
  {
    icon: MapPin,
    tag: "시설",
    title: "우리 동네 어린이집과 소아과를 찾아보세요",
    description: "현재 위치를 중심으로 주변 시설을 지도에서 확인해요.",
    href: "/map",
  },
  {
    icon: MessageCircle,
    tag: "소통",
    title: "육아와 정책 이야기를 함께 나눠요",
    description: "아이콤 커뮤니티의 소식과 이용 안내를 확인해요.",
    href: "/community",
  },
];
export function LandingPage() {
  return (
    <>
      <main id="main-content" className="page-container pb-16">
        <HeroSection />
        <TrustSection />
        <section aria-labelledby="discover-heading">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 id="discover-heading" className="text-xl font-bold">
              아이콤에서 함께 찾아보세요
            </h2>
            <Link
              href="/policy"
              className="text-primary inline-flex items-center gap-1 text-xs font-semibold"
            >
              전체 정책 보기
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border bg-white">
            {services.map(({ icon: Icon, tag, title, description, href }) => (
              <Link
                key={href}
                href={href}
                className="group hover:bg-accent/50 flex items-center gap-4 border-b px-5 py-5 last:border-0"
              >
                <Icon className="text-primary hidden size-5 shrink-0 sm:block" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-muted text-primary rounded px-2 py-0.5 text-xs">
                      {tag}
                    </span>
                    <h3 className="group-hover:text-primary font-semibold">
                      {title}
                    </h3>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {description}
                  </p>
                </div>
                <ArrowUpRight className="text-muted-foreground size-4 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
