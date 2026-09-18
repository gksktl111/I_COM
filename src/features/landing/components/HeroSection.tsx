import Link from "next/link";
import { ArrowRight, Check, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const guideItems = [
  "거주 지역과 가족 상황을 입력해요",
  "관심 분야와 관련된 정책을 모아 봐요",
  "지원 내용과 신청 안내를 확인해요",
];

export function HeroSection() {
  return (
    <section className="border-border bg-background border-b">
      <div className="page-container grid items-center gap-10 py-10 sm:py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:gap-12 lg:py-16">
        <div className="max-w-2xl">
          <div className="text-primary mb-4 flex items-center gap-2 text-sm font-semibold">
            <Compass aria-hidden="true" className="size-5" />
            아이와 가족을 위한 공공 복지 나침반
          </div>
          <h1 className="text-accent-foreground text-[2.125rem] leading-[1.35] font-semibold tracking-[-0.02em] sm:text-[2.75rem] lg:text-[3.25rem] lg:leading-[1.25]">
            가족에게 필요한 공공 지원,
            <br className="hidden sm:block" /> 덜 헤매고 찾아보세요
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl text-base leading-7 sm:text-lg sm:leading-8">
            흩어진 정부·지자체 정책을 한곳에서 살펴보고, 우리 가족과 관련된 지원
            내용과 신청 방법을 확인할 수 있어요.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="w-full text-base sm:w-auto">
              <Link href="/policy/match">
                맞춤 진단 시작하기
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Link
              href="/policy"
              className="text-primary inline-flex min-h-11 items-center justify-center gap-1.5 text-base font-semibold underline-offset-4 hover:underline sm:justify-start"
            >
              정책 먼저 둘러보기
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <p className="text-muted-foreground mt-4 text-sm leading-6">
            로그인 없이 시작할 수 있으며, 결과는 수혜 자격 확정이 아닌 정보 탐색
            안내입니다.
          </p>
        </div>

        <aside
          aria-label="맞춤 정책 탐색 안내"
          className="border-border bg-card rounded-lg border p-5 sm:p-7"
        >
          <p className="text-muted-foreground text-sm font-semibold">
            아이콤에서 확인하는 순서
          </p>
          <ol className="mt-5 space-y-5">
            {guideItems.map((item, index) => (
              <li key={item} className="flex gap-4">
                <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {index + 1}
                </span>
                <div className="border-border min-w-0 border-b pb-5 last:border-0 last:pb-0">
                  <p className="text-foreground pt-1 text-base leading-6 font-semibold">
                    {item}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="bg-muted text-muted-foreground mt-6 flex gap-3 rounded-lg p-4 text-sm leading-6">
            <Check
              aria-hidden="true"
              className="text-primary mt-0.5 size-5 shrink-0"
            />
            세부 조건은 정책 상세와 공식 신청처에서 마지막으로 확인해 주세요.
          </div>
        </aside>
      </div>
    </section>
  );
}
