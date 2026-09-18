import Link from "next/link";
import { ArrowRight, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/common/Footer";

const plannedTopics = [
  "정책 신청 경험",
  "서류와 자격 질문",
  "우리 동네 육아 정보",
  "어린이집과 돌봄 정보",
];

export function Community() {
  return (
    <>
      <main id="main-content" className="bg-background py-10 sm:py-16">
        <div className="page-container">
          <div className="max-w-3xl">
            <MessageCircle aria-hidden="true" className="text-primary size-7" />
            <h1 className="mt-4 text-[1.75rem] leading-[1.4] font-semibold tracking-[-0.01em] sm:text-[2rem] sm:font-bold">
              육아·정책 커뮤니티
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-7">
              정책 신청 경험과 우리 동네 육아 정보를 나눌 공간을 준비하고
              있습니다.
            </p>

            <div className="border-border mt-8 border-y py-6">
              <p className="text-foreground font-semibold">
                현재 게시글 작성·댓글·검색은 제공하지 않습니다.
              </p>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                이용 가능한 기능이 준비되면 이 화면에서 정확한 범위를
                안내하겠습니다.
              </p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/policy">
                  정책 둘러보기
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/map">
                  <MapPin aria-hidden="true" />
                  주변 시설 찾기
                </Link>
              </Button>
            </div>

            <details className="border-border mt-10 border-t pt-5">
              <summary className="text-primary flex min-h-11 cursor-pointer items-center font-semibold underline-offset-4 hover:underline">
                준비 중인 주제와 이용 원칙 보기
              </summary>
              <div className="text-muted-foreground pt-3 pb-2 text-base leading-7">
                <ul className="list-disc space-y-1 pl-5">
                  {plannedTopics.map((topic) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
                <div className="border-border mt-5 flex gap-3 border-t pt-5">
                  <ShieldCheck
                    aria-hidden="true"
                    className="text-primary mt-1 size-5 shrink-0"
                  />
                  <p>
                    개인정보가 담긴 서류나 계좌정보는 공유하지 마세요. 지원
                    자격과 신청 기준은 반드시 공식 기관에서 확인해야 합니다.
                  </p>
                </div>
              </div>
            </details>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
