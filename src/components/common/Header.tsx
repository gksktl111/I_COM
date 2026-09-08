"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Compass, LogIn, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/shadcn_utils";

const navItems = [
  { href: "/policy/match", label: "맞춤 정책 찾기" },
  { href: "/policy", label: "정책 둘러보기" },
  { href: "/map", label: "주변 시설 찾기" },
  { href: "/community", label: "커뮤니티" },
];

export function Header({
  secondaryNavigation,
}: {
  secondaryNavigation?: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [large, setLarge] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    let anchor = Math.max(0, window.scrollY);
    const onScroll = () => {
      const current = Math.max(0, window.scrollY);
      if (current <= 64 || menuOpen) {
        setCollapsed(false);
        anchor = current;
      } else if (Math.abs(current - anchor) >= 8) {
        setCollapsed(current > anchor);
        anchor = current;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOpen]);
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
    <header
      className="site-header sticky top-0 z-50 border-b bg-white shadow-xs"
      data-collapsed={collapsed && !menuOpen}
      data-secondary={!!secondaryNavigation}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-60 focus:rounded-lg focus:bg-white focus:p-3"
      >
        본문 바로가기
      </a>
      <div
        className="page-container header-brand-row flex h-16 items-center justify-between gap-4"
        onFocusCapture={() => setCollapsed(false)}
      >
        <Link
          href="/"
          aria-label="아이콤 홈"
          className="text-primary flex min-h-11 shrink-0 items-center gap-2"
        >
          <Compass className="size-7" />
          <span className="text-xl font-bold tracking-tight">아이콤</span>
          <span className="text-muted-foreground ml-3 hidden border-l pl-4 text-xs font-normal lg:block">
            대한민국 아동 공공 복지 나침반
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="bg-muted hidden rounded-lg border p-0.5 sm:flex"
            role="group"
            aria-label="글자 크기 조절"
          >
            {[false, true].map((value) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={large === value}
                onClick={() => changeSize(value)}
                className={cn(
                  "min-h-9 rounded-md px-3 text-xs",
                  large === value
                    ? "text-primary bg-white font-semibold shadow-xs"
                    : "text-muted-foreground",
                )}
              >
                {value ? "크게" : "기본"}
              </button>
            ))}
          </div>
          <Button
            asChild
            variant="outline"
            className="border-border text-foreground"
          >
            <Link href="/login">
              <LogIn />
              로그인
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
            aria-controls="service-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {secondaryNavigation && (
        <div className="header-secondary-row border-t">
          <div className="page-container flex h-12 items-center">
            {secondaryNavigation}
          </div>
        </div>
      )}
      <div
        className={cn(
          "border-t",
          secondaryNavigation
            ? menuOpen
              ? "absolute inset-x-0 top-full bg-white shadow-md md:hidden"
              : "hidden"
            : menuOpen
              ? "block"
              : "hidden md:block",
        )}
      >
        <div className="page-container flex flex-col md:h-12 md:flex-row md:items-stretch">
          <nav
            id="service-navigation"
            aria-label="주요 서비스"
            className="flex flex-col md:flex-row md:gap-6"
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
                    "hover:text-primary flex min-h-12 items-center border-b-2 px-2 text-sm transition-colors",
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
