"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Baby,
  ChevronRight,
  Database,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Users,
  Files,
} from "lucide-react";
import type { ReactNode } from "react";
import "../admin.css";

const navigation = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/users", label: "사용자 관리", icon: Users },
  { href: "/admin/policies", label: "정책 관리", icon: Files },
  { href: "/admin/collection", label: "정책 수집", icon: Database },
  { href: "/admin/community", label: "커뮤니티 / 신고", icon: MessageSquare },
  { href: "/admin/notices", label: "공지 / 알림", icon: Megaphone },
  { href: "/admin/accounts", label: "관리자 계정", icon: ShieldCheck },
];

export function AdminShell({
  children,
  email,
}: {
  children: ReactNode;
  email: string;
}) {
  const pathname = usePathname();
  const active = navigation.find(({ href }) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href),
  );

  return (
    <div className="admin-app">
      <a className="admin-skip" href="#admin-content">
        본문으로 건너뛰기
      </a>
      <aside className="admin-sidebar">
        <Link
          className="admin-brand"
          href="/admin"
          aria-label="아이콤 관리자 대시보드"
        >
          <span className="admin-brand-icon">
            <Baby size={25} aria-hidden="true" />
          </span>
          <span>
            아이콤 <small>ADMIN CONSOLE</small>
          </span>
        </Link>
        <p className="admin-nav-label">WORKSPACE</p>
        <nav className="admin-nav" aria-label="관리자 메뉴">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={active?.href === href ? "is-active" : undefined}
              aria-current={active?.href === href ? "page" : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
              {active?.href === href && (
                <ChevronRight
                  className="admin-nav-arrow"
                  size={15}
                  aria-hidden="true"
                />
              )}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link className="admin-service-link" href="/">
            서비스 바로가기 <ExternalLink size={15} aria-hidden="true" />
          </Link>
          <div className="admin-account">
            <span className="admin-avatar">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <span>
              <strong>관리자</strong>
              <small title={email}>{email}</small>
            </span>
          </div>
          <form action="/admin/logout" method="post">
            <button className="admin-logout" type="submit">
              <LogOut size={16} aria-hidden="true" />
              로그아웃
            </button>
          </form>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            관리자 콘솔 <ChevronRight size={14} aria-hidden="true" />
            <strong>{active?.label ?? "관리"}</strong>
          </div>
          <span className="admin-access-badge">
            <ShieldCheck size={14} aria-hidden="true" />
            관리자 전용
          </span>
          <form
            className="admin-mobile-logout"
            action="/admin/logout"
            method="post"
          >
            <button className="admin-logout" type="submit">
              <LogOut size={15} aria-hidden="true" />
              로그아웃
            </button>
          </form>
        </header>
        <main id="admin-content" className="admin-content">
          {children}
        </main>
        <footer className="admin-footer">
          © 아이콤 · 더 나은 육아를 위한 연결
        </footer>
      </div>
    </div>
  );
}
