import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="border-border bg-background border-b">
      <div className="page-container py-10 sm:py-14 lg:py-16">
        <div className="max-w-3xl">
          <h1 className="text-accent-foreground text-[2.125rem] leading-[1.3] font-semibold tracking-[-0.02em] sm:text-[2.75rem] lg:text-[3.25rem]">
            우리 가족에게 맞는
            <br /> 공공 지원을 찾아보세요
          </h1>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/policy/match">맞춤 정책 찾기</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/policy">정책 둘러보기</Link>
            </Button>
          </div>
          <p className="text-foreground mt-3 text-sm leading-6">
            두 기능 모두 로그인 없이 이용할 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  );
}
