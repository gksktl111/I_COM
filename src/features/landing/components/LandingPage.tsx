import Link from "next/link";
import {
  ArrowRight,
  Baby,
  BookOpen,
  ExternalLink,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Home,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { HeroSection } from "./HeroSection";
import { TrustSection } from "./TrustSection";
import { Footer } from "@/components/common/Footer";
import { Button } from "@/components/ui/button";

const categories = [
  { icon: Baby, label: "임신·출산" },
  { icon: HandHeart, label: "양육·보육" },
  { icon: ShieldCheck, label: "돌봄" },
  { icon: HeartPulse, label: "의료·건강" },
  { icon: GraduationCap, label: "아동 교육" },
  { icon: Home, label: "주거·생활지원" },
];

const resultGuide = [
  {
    title: "관련 정책",
    description: "입력한 조건과 관심 분야를 기준으로 살펴볼 정책입니다.",
  },
  {
    title: "추가 확인 조건",
    description: "소득, 거주 기간 등 원문에서 다시 확인할 세부 조건입니다.",
  },
  {
    title: "공식 신청 정보",
    description: "제공 기관, 신청 기간과 원문 안내로 이어지는 정보입니다.",
  },
];

const services = [
  {
    icon: MapPin,
    title: "주변 시설 찾기",
    description: "현재 위치를 중심으로 보육·의료 시설을 지도에서 살펴보세요.",
    href: "/map",
    action: "시설 지도 보기",
  },
  {
    icon: MessageCircle,
    title: "육아·정책 커뮤니티",
    description: "커뮤니티의 이용 범위와 작성 안내를 확인해 보세요.",
    href: "/community",
    action: "커뮤니티 둘러보기",
  },
];

export function LandingPage() {
  return (
    <>
      <main id="main-content" className="bg-card">
        <HeroSection />
        <TrustSection />

        <section
          aria-labelledby="categories-heading"
          className="bg-background py-12 sm:py-16"
        >
          <div className="page-container">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <h2
                  id="categories-heading"
                  className="text-foreground text-2xl leading-[1.4] font-semibold sm:text-[1.75rem]"
                >
                  가족의 일상에 닿는 6개 지원 분야
                </h2>
                <p className="text-muted-foreground mt-3 text-base leading-7">
                  맞춤 탐색에서 관심 분야를 선택하고 관련 정책부터 차근차근
                  확인할 수 있어요.
                </p>
              </div>
              <Link
                href="/policy"
                className="text-primary inline-flex min-h-11 items-center gap-1.5 self-start font-semibold underline-offset-4 hover:underline sm:self-auto"
              >
                전체 정책 보기
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <ul className="border-border bg-card mt-8 grid overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="border-border flex min-h-20 items-center gap-4 border-b px-5 py-4 last:border-b-0 lg:border-b lg:[&:nth-child(2)]:border-r lg:[&:nth-child(3)]:border-r-0 lg:[&:nth-child(4)]:border-r lg:[&:nth-child(4)]:border-b-0 lg:[&:nth-child(5)]:border-r sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0"
                >
                  <Icon
                    aria-hidden="true"
                    className="text-primary size-6 shrink-0"
                  />
                  <span className="text-foreground text-base font-semibold">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              size="lg"
              className="mt-8 w-full text-base sm:w-auto"
            >
              <Link href="/policy/match">
                맞춤 진단 시작하기
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="results-heading"
          className="border-border bg-card border-y py-12 sm:py-16"
        >
          <div className="page-container grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
            <div>
              <h2
                id="results-heading"
                className="text-foreground text-2xl leading-[1.4] font-semibold sm:text-[1.75rem]"
              >
                결과는 자격 판정이 아니라, 확인할 정책을 찾는 출발점이에요
              </h2>
              <p className="text-muted-foreground mt-3 text-base leading-7">
                추천 결과와 실제 수혜 자격은 다를 수 있습니다. 정책별 원문과
                담당 기관의 최신 안내를 함께 확인해 주세요.
              </p>
            </div>
            <div className="border-border bg-background rounded-lg border p-5 sm:p-6">
              <ol className="space-y-5">
                {resultGuide.map(({ title, description }, index) => (
                  <li key={title} className="flex gap-4">
                    <span className="text-primary border-primary flex size-7 shrink-0 items-center justify-center rounded-md border text-sm font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-foreground text-base font-semibold">
                        {title}
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm leading-6">
                        {description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="information-heading"
          className="bg-background py-12 sm:py-16"
        >
          <div className="page-container">
            <h2
              id="information-heading"
              className="text-foreground text-2xl leading-[1.4] font-semibold sm:text-[1.75rem]"
            >
              정보의 범위와 출처를 먼저 확인하세요
            </h2>
            <div className="border-border bg-border mt-8 grid gap-px overflow-hidden rounded-lg border md:grid-cols-2">
              <article className="bg-card p-5 sm:p-6">
                <BookOpen aria-hidden="true" className="text-primary size-6" />
                <h3 className="text-foreground mt-4 text-lg font-semibold">
                  공공데이터 출처 안내
                </h3>
                <p className="text-muted-foreground mt-2 text-base leading-7">
                  정책 상세에서 제공 기관과 원문 링크를 확인할 수 있습니다. 수집
                  시점과 실제 시행 내용은 다를 수 있어요.
                </p>
                <Link
                  href="/guide#sources"
                  className="text-primary mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
                >
                  출처 안내 보기
                  <ExternalLink aria-hidden="true" className="size-4" />
                </Link>
              </article>
              <article className="bg-card p-5 sm:p-6">
                <ShieldCheck
                  aria-hidden="true"
                  className="text-primary size-6"
                />
                <h3 className="text-foreground mt-4 text-lg font-semibold">
                  자주 묻는 질문
                </h3>
                <p className="text-muted-foreground mt-2 text-base leading-7">
                  로그인 없이 이용할 수 있는 기능과 추천 결과를 읽는 방법을
                  안내합니다.
                </p>
                <Link
                  href="/guide#faq"
                  className="text-primary mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
                >
                  이용 안내 보기
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="discover-heading"
          className="border-border bg-card border-t py-12 sm:py-16"
        >
          <div className="page-container">
            <h2
              id="discover-heading"
              className="text-foreground text-2xl leading-[1.4] font-semibold sm:text-[1.75rem]"
            >
              정책과 함께 둘러보세요
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {services.map(
                ({ icon: Icon, title, description, href, action }) => (
                  <article
                    key={href}
                    className="border-border rounded-lg border p-5 sm:p-6"
                  >
                    <Icon aria-hidden="true" className="text-primary size-6" />
                    <h3 className="text-foreground mt-4 text-lg font-semibold">
                      {title}
                    </h3>
                    <p className="text-muted-foreground mt-2 text-base leading-7">
                      {description}
                    </p>
                    <Link
                      href={href}
                      className="text-primary mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
                    >
                      {action}
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </article>
                ),
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
