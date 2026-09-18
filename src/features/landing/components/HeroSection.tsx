import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="border-border bg-background border-b">
      <div className="page-container py-14 sm:py-20 lg:py-24">
        <div className="max-w-3xl">
          <h1 className="text-accent-foreground text-[2.125rem] leading-[1.3] font-semibold tracking-[-0.02em] sm:text-[2.75rem] lg:text-[3.25rem]">
            우리 가족에게 맞는
            <br /> 공공 지원을 찾아보세요
          </h1>
          <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">
            거주 지역과 가족 상황을 바탕으로 정부·지자체 정책을 좁혀 보고,
            신청에 필요한 정보를 확인할 수 있어요.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="w-full text-base sm:w-auto">
              <Link href="/policy/match">
                맞춤 정책 찾기
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Link
              href="/policy"
              className="text-primary inline-flex min-h-11 items-center justify-center gap-1.5 text-base font-semibold underline-offset-4 hover:underline sm:justify-start"
            >
              전체 정책 보기
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <p className="text-muted-foreground mt-4 text-sm leading-6">
            로그인 없이 이용할 수 있어요. 추천 결과는 수혜 자격 확정이 아닙니다.
          </p>
        </div>
      </div>
    </section>
  );
}
