"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/shadcn_utils";

const navItems = [
  { href: "/policy/match", label: "맞춤 정책 찾기" },
  { href: "/policy", label: "정책 둘러보기" },
  { href: "/map", label: "주변 시설 찾기" },
  { href: "/community", label: "커뮤니티" },
];

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const preferred = localStorage.getItem("icom-text-size") === "large";
    document.documentElement.style.setProperty(
      "font-size",
      preferred ? "115%" : "100%",
    );
    // Read the browser preference once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLarge(preferred);
  }, []);
  function changeSize(value: boolean) {
    setLarge(value);
    document.documentElement.style.setProperty(
      "font-size",
      value ? "115%" : "100%",
    );
    localStorage.setItem("icom-text-size", value ? "large" : "normal");
  }
  return (
    <header className="site-header sticky top-0 z-50 border-b bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-60 focus:rounded-lg focus:bg-white focus:p-3"
      >
        본문 바로가기
      </a>
      <div className="page-container flex h-16 items-center gap-3">
        <Link
          href="/"
          aria-label="아이콤 홈"
          className="text-primary flex min-h-11 shrink-0 items-center gap-2"
        >
          <Compass className="hidden size-7 md:block" />
          <span className="text-xl font-semibold tracking-tight">아이콤</span>
        </Link>

        <nav
          id="desktop-service-navigation"
          aria-label="주요 서비스"
          className="ml-3 hidden min-w-0 flex-1 self-stretch lg:flex lg:items-stretch lg:gap-6"
        >
          {navItems.map(({ href, label }) => {
            const active =
              href === "/policy"
                ? pathname === href ||
                  (pathname.startsWith("/policy/") &&
                    !pathname.startsWith("/policy/match"))
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "hover:text-primary flex min-h-16 items-center border-b-2 px-1 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-primary text-primary font-semibold"
                    : "text-muted-foreground border-transparent",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={large}
            aria-label={large ? "글자 크기 기본으로" : "글자 크게 보기"}
            onClick={() => changeSize(!large)}
            className="text-foreground px-2 sm:px-3"
          >
            <span className="sm:hidden">{large ? "글자 기본" : "글자 +"}</span>
            <span className="hidden sm:inline">
              {large ? "기본 크기" : "글자 크게"}
            </span>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-border text-foreground px-3"
          >
            <Link href="/login">로그인</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
            aria-controls="service-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "absolute inset-x-0 top-full border-t bg-white shadow-md lg:hidden",
          menuOpen ? "block" : "hidden",
        )}
      >
        <div className="page-container">
          <nav
            id="service-navigation"
            aria-label="주요 서비스"
            className="flex flex-col py-2"
          >
            {navItems.map(({ href, label }) => {
              const active =
                href === "/policy"
                  ? pathname === href ||
                    (pathname.startsWith("/policy/") &&
                      !pathname.startsWith("/policy/match"))
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "hover:text-primary flex min-h-12 items-center border-l-2 px-3 text-sm font-medium transition-colors",
                    active
                      ? "border-primary text-primary font-bold"
                      : "text-muted-foreground border-transparent",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
