import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const popularSearches = [
  "출산지원금",
  "아동수당",
  "보육료",
  "아이돌봄",
  "교육비",
  "의료비",
  "주거지원",
  "한부모",
  "다자녀",
  "산후조리",
];

export function LandingPage() {
  return (
    <main id="main-content" className="bg-card">
      <section className="border-border bg-background border-b">
        <div className="page-container py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-4xl">
            <h1 className="text-accent-foreground text-center text-[2.125rem] leading-[1.3] font-semibold tracking-[-0.02em] sm:text-[2.75rem] lg:text-[3.25rem]">
              아이와 가족에게 필요한 지원을
              <br className="hidden sm:block" /> 한곳에서 찾아보세요
            </h1>

            <form
              action="/policy"
              method="get"
              role="search"
              className="mx-auto mt-8 flex max-w-3xl gap-2"
            >
              <div className="min-w-0 flex-1">
                <label htmlFor="landing-policy-search" className="sr-only">
                  정책 검색어
                </label>
                <Input
                  id="landing-policy-search"
                  name="q"
                  type="search"
                  maxLength={100}
                  placeholder="정책명이나 지원 내용을 검색해 보세요"
                  className="border-primary h-12 border-2 bg-white px-4"
                />
              </div>
              <Button type="submit" className="min-h-12 px-5 sm:px-7">
                검색
              </Button>
            </form>

            <div className="mx-auto mt-10 max-w-3xl">
              <h2
                id="popular-policy-heading"
                className="text-foreground text-xl leading-[1.45] font-semibold"
              >
                자주 찾는 정책
              </h2>

              <ol className="border-border mt-4 grid border-t md:grid-cols-2 md:gap-x-10">
                {popularSearches.map((keyword, index) => (
                  <li key={keyword} className="border-border border-b">
                    <Link
                      href={`/policy?q=${encodeURIComponent(keyword)}`}
                      className="group flex min-h-14 items-center gap-4 py-3"
                    >
                      <span className="text-primary w-5 shrink-0 text-sm font-semibold tabular-nums">
                        {index + 1}
                      </span>
                      <span className="text-foreground font-medium underline-offset-4 group-hover:underline">
                        {keyword}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="notice-heading"
        className="border-border bg-background border-y py-10 sm:py-12"
      >
        <div className="page-container">
          <h2
            id="notice-heading"
            className="text-foreground text-2xl leading-[1.4] font-semibold"
          >
            공지사항
          </h2>
          <p className="text-muted-foreground border-border mt-5 border-y py-5 text-sm leading-6">
            공개된 공지사항이 없습니다.
          </p>
        </div>
      </section>
    </main>
  );
}
