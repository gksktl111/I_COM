import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="border-b px-4 py-16 text-center sm:py-20">
      <span className="border-primary/15 bg-accent text-primary mb-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
        <Compass className="size-3.5" />
        공공 맞춤 복지 나침반
      </span>
      <h1 className="text-[1.75rem] leading-[1.4] font-bold sm:text-4xl">
        우리 아이와 가족을 위한
        <br />
        정부·지자체 맞춤 복지 나침반
      </h1>
      <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-sm leading-7 sm:text-base">
        임신·출산부터 양육·보육까지, 흩어져 있는 지원 정책을 한곳에서.
        <br className="hidden sm:block" />
        우리 가족의 상황을 입력하고 필요한 지원 정보를 살펴보세요.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/policy/match">
          맞춤 진단 시작하기
          <ArrowRight />
        </Link>
      </Button>
      <p className="text-muted-foreground mt-3 text-xs">
        별도 회원가입 없이 바로 확인할 수 있어요
      </p>
    </section>
  );
}
