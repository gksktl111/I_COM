import Link from "next/link";
import { ArrowRight, Compass, Info } from "lucide-react";
import { SocialLoginButtons } from "./SocialLoginButtons";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/common/Footer";

export function LoginForm() {
  return (
    <>
      <main id="main-content" className="bg-background px-4 py-10 sm:py-16">
        <div className="border-border bg-card mx-auto w-full max-w-lg rounded-lg border p-5 sm:p-8">
          <div className="text-center">
            <Compass
              aria-hidden="true"
              className="text-primary mx-auto size-9"
            />
            <h1 className="text-foreground mt-4 text-[1.75rem] leading-[1.4] font-semibold sm:text-[2rem]">
              아이콤 로그인
            </h1>
            <p className="text-muted-foreground mt-3 text-base leading-7">
              로그인 기능은 현재 준비 중입니다.
              <br />
              정책 탐색과 주변 시설 찾기는 로그인 없이 이용할 수 있어요.
            </p>
          </div>

          <div className="bg-muted text-muted-foreground mt-8 flex gap-3 rounded-lg p-4 text-sm leading-6">
            <Info
              aria-hidden="true"
              className="text-primary mt-0.5 size-5 shrink-0"
            />
            카카오·네이버·구글 간편 로그인 연결을 준비하고 있습니다.
          </div>

          <div className="mt-6">
            <SocialLoginButtons />
          </div>

          <section
            aria-labelledby="guest-heading"
            className="border-border mt-8 border-t pt-7 text-center"
          >
            <h2
              id="guest-heading"
              className="text-foreground text-lg font-semibold"
            >
              회원가입 없이 먼저 둘러보세요
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              가족 상황을 입력하고 관련 정책을 찾는 기능은 바로 시작할 수
              있어요.
            </p>
            <Button asChild size="lg" className="mt-5 w-full text-base">
              <Link href="/policy/match">
                맞춤 진단 시작하기
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Link
              href="/policy"
              className="text-primary mt-3 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
            >
              정책 먼저 둘러보기
            </Link>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
