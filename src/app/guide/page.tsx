import Link from "next/link";
import {
  ArrowRight,
  CircleHelp,
  Compass,
  Database,
  ExternalLink,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";

const guideLinks = [
  { href: "#faq", label: "자주 묻는 질문" },
  { href: "#sources", label: "정보 출처" },
  { href: "#privacy", label: "개인정보" },
  { href: "#principles", label: "서비스 원칙" },
  { href: "#notice", label: "유의사항" },
];

const sectionClassName =
  "border-border bg-card scroll-mt-36 rounded-lg border p-5 sm:p-7";
const headingClassName =
  "text-foreground flex items-center gap-3 text-xl leading-[1.45] font-semibold";

export default function GuidePage() {
  return (
    <>
      <Header />
      <main id="main-content" className="bg-background py-10 sm:py-16">
        <div className="page-container">
          <div className="max-w-3xl">
            <div className="text-primary flex items-center gap-2 text-sm font-semibold">
              <Compass aria-hidden="true" className="size-5" />
              서비스 이용 전 확인해 주세요
            </div>
            <h1 className="text-foreground mt-4 text-[1.75rem] leading-[1.4] font-bold tracking-[-0.02em] sm:text-[2rem]">
              아이콤 이용 안내
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-7">
              아이콤이 제공하는 정보의 범위와 출처, 정책 결과를 확인할 때 알아둘
              내용을 정리했습니다.
            </p>

            <nav
              aria-label="이용 안내 목차"
              className="border-border mt-8 border-y py-4"
            >
              <ul className="flex flex-wrap gap-x-6 gap-y-1">
                {guideLinks.map(({ href, label }) => (
                  <li key={href}>
                    <a
                      href={href}
                      className="text-primary inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-8 space-y-5">
              <section id="faq" className={sectionClassName}>
                <h2 className={headingClassName}>
                  <CircleHelp
                    aria-hidden="true"
                    className="text-primary size-6"
                  />
                  자주 묻는 질문
                </h2>
                <div className="divide-border mt-6 divide-y">
                  <article className="pb-5">
                    <h3 className="text-foreground text-base font-semibold">
                      로그인 없이 이용할 수 있나요?
                    </h3>
                    <p className="text-muted-foreground mt-2 text-base leading-7">
                      정책 탐색과 주변 시설 찾기는 로그인 없이 이용할 수
                      있습니다. 회원 로그인과 커뮤니티 글 작성은 준비 중입니다.
                    </p>
                  </article>
                  <article className="pt-5">
                    <h3 className="text-foreground text-base font-semibold">
                      정책을 찾으면 바로 지원받을 수 있나요?
                    </h3>
                    <p className="text-muted-foreground mt-2 text-base leading-7">
                      검색 결과는 정보 탐색을 돕는 안내입니다. 소득·거주 기간 등
                      세부 기준과 신청 시점에 따라 결과가 달라질 수 있습니다.
                      공식 신청처에서 최종 자격을 확인해 주세요.
                    </p>
                  </article>
                </div>
              </section>

              <section id="sources" className={sectionClassName}>
                <h2 className={headingClassName}>
                  <Database
                    aria-hidden="true"
                    className="text-primary size-6"
                  />
                  공공데이터 출처 안내
                </h2>
                <p className="text-muted-foreground mt-4 text-base leading-7">
                  정책별 상세 화면에서 제공 기관과 원문 링크를 확인할 수
                  있습니다. 수집 시점과 실제 정책 시행 시점은 다를 수 있습니다.
                </p>
                <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                  {[
                    ["공공데이터포털", "https://www.data.go.kr/"],
                    ["복지로", "https://www.bokjiro.go.kr/"],
                    ["정부24", "https://www.gov.kr/"],
                  ].map(([label, href]) => (
                    <li key={href}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex min-h-11 items-center gap-1.5 font-semibold underline underline-offset-4"
                      >
                        {label}
                        <ExternalLink aria-hidden="true" className="size-4" />
                        <span className="sr-only">새 창</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>

              <section id="privacy" className={sectionClassName}>
                <h2 className={headingClassName}>
                  <ShieldCheck
                    aria-hidden="true"
                    className="text-primary size-6"
                  />
                  개인정보 이용 안내
                </h2>
                <div className="text-muted-foreground mt-4 space-y-3 text-base leading-7">
                  <p>
                    지도에서 현재 위치 사용을 허용하면 주변 시설 검색에 위치
                    좌표가 사용됩니다. 위치 권한은 브라우저 설정에서 철회할 수
                    있습니다. 입력한 정책 탐색 조건에 주민등록번호, 연락처 등
                    직접 식별 정보는 입력하지 마세요.
                  </p>
                  <p>
                    글자 크기 설정은 이 브라우저에 저장됩니다. 회원 가입 기능은
                    현재 제공하지 않습니다.
                  </p>
                </div>
              </section>

              <section id="principles" className={sectionClassName}>
                <h2 className={headingClassName}>
                  <Compass aria-hidden="true" className="text-primary size-6" />
                  서비스 취지 및 원칙
                </h2>
                <p className="text-muted-foreground mt-4 text-base leading-7">
                  아이콤은 분산된 정책과 육아 시설 정보를 쉽게 찾아보도록
                  돕습니다. 공식 행정기관을 대신해 신청을 접수하거나 수혜 자격을
                  확정하지 않습니다.
                </p>
              </section>

              <section id="notice" className={sectionClassName}>
                <h2 className={headingClassName}>
                  <TriangleAlert
                    aria-hidden="true"
                    className="size-6 text-[#8a5700]"
                  />
                  정책 정보 이용 시 유의사항
                </h2>
                <p className="text-muted-foreground mt-4 text-base leading-7">
                  지원 금액, 신청 기간, 예산 및 대상 기준은 변경될 수 있습니다.
                  안내가 없거나 추가 확인이 필요한 항목은 정책 원문 또는 담당
                  기관에서 확인해 주세요.
                </p>
                <Link
                  href="/policy"
                  className="text-primary mt-5 inline-flex min-h-11 items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
                >
                  정책 둘러보기
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
