import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
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
              className="text-primary mx-auto size-8"
            />
            <h1 className="text-foreground mt-4 text-[1.75rem] leading-[1.4] font-semibold sm:text-[2rem]">
              아이콤 로그인
            </h1>
            <p className="text-muted-foreground mt-3 text-base leading-7">
              로그인은 준비 중입니다. 정책 탐색과 주변 시설 찾기는 로그인 없이
              이용할 수 있어요.
            </p>
          </div>

          <div className="border-border mt-8 border-y py-5 text-center">
            <h2 className="text-foreground text-xl font-semibold">
              바로 이용해 보세요
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              가족 상황을 입력하고 관련 정책을 찾을 수 있습니다.
            </p>
            <Button asChild size="lg" className="mt-5 w-full text-base">
              <Link href="/policy/match">
                맞춤 정책 찾기
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Link
              href="/policy"
              className="text-primary mt-3 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
            >
              전체 정책 보기
            </Link>
          </div>

          <details className="mt-5">
            <summary className="text-primary flex min-h-11 cursor-pointer items-center justify-center text-sm font-semibold underline-offset-4 hover:underline">
              지원 예정 로그인 방식 보기
            </summary>
            <p className="text-muted-foreground mt-2 text-center text-sm leading-6">
              카카오·네이버·구글 간편 로그인을 연결할 예정입니다.
            </p>
          </details>
        </div>
      </main>
      <Footer />
    </>
  );
}
