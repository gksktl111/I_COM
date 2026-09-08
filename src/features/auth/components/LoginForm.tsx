import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";
import { SocialLoginButtons } from "./SocialLoginButtons";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Footer } from "@/components/common/Footer";

export function LoginForm() {
  return (
    <>
      <main
        id="main-content"
        className="page-container flex min-h-[640px] items-center justify-center py-14"
      >
        <Card className="w-full max-w-lg px-6 py-10 sm:px-10">
          <div className="mb-8 text-center">
            <Compass className="text-primary mx-auto mb-4 size-10" />
            <h1 className="text-[1.75rem] font-bold">아이콤 로그인</h1>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              우리 아이 맞춤 복지와 보육 정보를
              <br />
              아이콤에서 함께 찾아보세요.
            </p>
          </div>
          <SocialLoginButtons />
          <div className="my-7 border-y py-5 text-center">
            <p className="text-sm font-semibold">
              회원가입 없이 혜택을 먼저 둘러보세요
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              맞춤 정책 탐색은 로그인 없이 이용할 수 있어요.
            </p>
            <Link
              href="/policy/match"
              className="text-primary mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold"
            >
              비회원으로 정책 찾기
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <Notice className="border-0 py-0 text-xs">
            간편 로그인 연결을 준비하고 있습니다. 지금은 회원가입 없이 정책
            탐색과 주변 시설 찾기를 이용해 주세요.
          </Notice>
        </Card>
      </main>
      <Footer />
    </>
  );
}
