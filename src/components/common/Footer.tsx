import Link from "next/link";
import { Compass } from "lucide-react";
import { Notice } from "@/components/ui/feedback";

export function Footer() {
  return (
    <footer className="text-muted-foreground bg-background border-t py-12 text-[13px]">
      <div className="page-container">
        <div className="grid gap-8 pb-8 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              className="text-primary inline-flex min-h-11 items-center gap-2 text-lg font-semibold"
            >
              <Compass className="size-6" />
              아이콤{" "}
              <span className="text-muted-foreground text-xs font-normal">
                I-Compass
              </span>
            </Link>
            <p className="mt-3 max-w-md leading-relaxed">
              아이와 가족의 현재 상황에 맞는 정부 및 지자체 복지 정책을
              연결합니다. 복잡한 지원 요건을 한곳에서 살펴보세요.
            </p>
          </div>
          <div>
            <h2 className="text-foreground mb-3 text-sm font-semibold">
              안내 및 고객지원
            </h2>
            <div className="flex flex-col items-start gap-2">
              <Link
                href="/guide#faq"
                className="hover:text-primary inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                자주 묻는 질문
              </Link>
              <Link
                href="/guide#sources"
                className="hover:text-primary inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                공공데이터 출처 안내
              </Link>
              <Link
                href="/community"
                className="hover:text-primary inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                육아·정책 커뮤니티
              </Link>
            </div>
          </div>
          <div>
            <h2 className="text-foreground mb-3 text-sm font-semibold">
              서비스 이용 안내
            </h2>
            <div className="flex flex-col items-start gap-2">
              <Link
                href="/guide#privacy"
                className="hover:text-primary inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                개인정보 이용 안내
              </Link>
              <Link
                href="/guide#principles"
                className="hover:text-primary inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                서비스 취지 및 원칙
              </Link>
              <Link
                href="/guide#notice"
                className="hover:text-primary inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                정책 정보 이용 시 유의사항
              </Link>
            </div>
          </div>
        </div>
        <Notice>
          정책 정보는 공공데이터를 가공해 안내합니다. 실제 수혜 자격 확인과 최종
          신청은 소관 기관의 공식 안내 및 심사를 통해 진행해 주세요.
        </Notice>
        <p className="mt-5 text-xs">
          © {new Date().getFullYear()} I-Compass. 우리 가족을 위한 복지 나침반.
        </p>
      </div>
    </footer>
  );
}
