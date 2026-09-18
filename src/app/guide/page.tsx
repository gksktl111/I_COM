import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/common/Footer";

const guideLinks = [
  { href: "#faq", label: "자주 묻는 질문" },
  { href: "#sources", label: "정보 출처" },
  { href: "#privacy", label: "개인정보" },
  { href: "#principles", label: "서비스 원칙" },
  { href: "#notice", label: "유의사항" },
];

const disclosureClassName = "group scroll-mt-36 py-1";
const summaryClassName =
  "text-foreground flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold marker:content-none after:text-primary after:text-xl after:content-['＋'] group-open:after:content-['−']";
const bodyClassName =
  "text-muted-foreground max-w-2xl pb-6 text-base leading-7";

export default function GuidePage() {
  return (
    <>
      <Header />
      <main id="main-content" className="bg-background py-10 sm:py-16">
        <div className="page-container">
          <div className="max-w-3xl">
            <h1 className="text-foreground text-[1.75rem] leading-[1.4] font-bold tracking-[-0.02em] sm:text-[2rem]">
              아이콤 이용 안내
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-7">
              정책 결과의 의미와 정보 출처, 개인정보 이용 범위를 확인할 수
              있습니다.
            </p>
            <p className="border-border mt-6 border-y py-4 text-sm leading-6">
              아이콤의 정책 결과는 정보 탐색을 돕는 안내입니다. 최종 자격과 신청
              가능 여부는 공식 신청처에서 확인해 주세요.
            </p>

            <nav aria-label="이용 안내 목차" className="mt-5">
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

            <div className="border-border mt-8 divide-y border-y">
              <details id="faq" className={disclosureClassName}>
                <summary className={summaryClassName}>자주 묻는 질문</summary>
                <div className={`${bodyClassName} space-y-5`}>
                  <section>
                    <h2 className="text-foreground font-semibold">
                      로그인 없이 이용할 수 있나요?
                    </h2>
                    <p className="mt-2">
                      정책 탐색과 주변 시설 찾기는 로그인 없이 이용할 수
                      있습니다. 회원 로그인과 커뮤니티 글 작성은 준비 중입니다.
                    </p>
                  </section>
                  <section>
                    <h2 className="text-foreground font-semibold">
                      정책을 찾으면 바로 지원받을 수 있나요?
                    </h2>
                    <p className="mt-2">
                      아닙니다. 소득·거주 기간 등 세부 기준과 신청 시점에 따라
                      결과가 달라질 수 있습니다.
                    </p>
                  </section>
                </div>
              </details>

              <details id="sources" className={disclosureClassName}>
                <summary className={summaryClassName}>공공데이터 출처</summary>
                <div className={bodyClassName}>
                  <p>
                    정책 상세 화면에서 제공 기관과 원문 링크를 확인할 수
                    있습니다. 수집 시점과 실제 시행 시점은 다를 수 있습니다.
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
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
                </div>
              </details>

              <details id="privacy" className={disclosureClassName}>
                <summary className={summaryClassName}>
                  개인정보 이용 안내
                </summary>
                <div className={`${bodyClassName} space-y-3`}>
                  <p>
                    지도에서 현재 위치 사용을 허용하면 주변 시설 검색에 위치
                    좌표가 사용됩니다. 권한은 브라우저 설정에서 철회할 수
                    있습니다.
                  </p>
                  <p>
                    정책 탐색 조건에는 주민등록번호나 연락처 같은 직접 식별
                    정보를 입력하지 마세요. 글자 크기 설정만 이 브라우저에
                    저장됩니다.
                  </p>
                </div>
              </details>

              <details id="principles" className={disclosureClassName}>
                <summary className={summaryClassName}>서비스 원칙</summary>
                <p className={bodyClassName}>
                  아이콤은 분산된 정책과 육아 시설 정보를 쉽게 찾도록 돕습니다.
                  공식 행정기관을 대신해 신청을 접수하거나 수혜 자격을 확정하지
                  않습니다.
                </p>
              </details>

              <details id="notice" className={disclosureClassName}>
                <summary className={summaryClassName}>
                  정책 정보 유의사항
                </summary>
                <div className={bodyClassName}>
                  <p>
                    지원 금액, 신청 기간, 예산 및 대상 기준은 변경될 수
                    있습니다. 정보가 없거나 추가 확인이 필요한 항목은 정책 원문
                    또는 담당 기관에서 확인해 주세요.
                  </p>
                  <Link
                    href="/policy"
                    className="text-primary mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
                  >
                    정책 둘러보기
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              </details>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
