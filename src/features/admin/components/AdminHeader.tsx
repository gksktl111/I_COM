"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ExternalLink,
  Home,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAdminSection } from "./admin-navigation";

export function AdminHeader({
  email,
  environment,
}: {
  email: string;
  environment: string;
}) {
  const active = useAdminSection();
  const [open, setOpen] = useState(false);
  const account = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!account.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <header className="admin-topbar admin-chrome-header">
      <nav className="admin-breadcrumb" aria-label="현재 위치">
        <Link href="/admin" aria-label="관리자 홈">
          <Home size={18} aria-hidden="true" />
        </Link>
        <span className="admin-breadcrumb-separator" aria-hidden="true">
          /
        </span>
        <strong aria-current="page">
          {active.href === "/admin" ? "운영 현황" : active.label}
        </strong>
      </nav>
      <div className="admin-header-tools">
        <span className="admin-environment">
          <span aria-hidden="true" />
          {environment}
        </span>
        <span
          className="admin-header-divider admin-environment-divider"
          aria-hidden="true"
        />
        <Link
          href="/admin/notices"
          className="admin-notification-link"
          aria-label="공지·알림 관리"
        >
          <Bell size={22} aria-hidden="true" />
        </Link>
        <span className="admin-header-divider" aria-hidden="true" />
        <div
          className="admin-account-control"
          ref={account}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setOpen(false);
          }}
        >
          <button
            type="button"
            ref={trigger}
            className="admin-profile-trigger"
            aria-label="관리자 계정 메뉴"
            aria-expanded={open}
            aria-controls="admin-account-menu"
            onClick={() => setOpen(!open)}
          >
            <span className="admin-profile-avatar">
              <UserRound size={20} aria-hidden="true" />
            </span>
            <span className="admin-profile-text">
              <strong>관리자</strong>
              <small title={email}>{email}</small>
            </span>
          </button>
          {open && (
            <div id="admin-account-menu" className="admin-profile-menu">
              <p>{email}</p>
              <Link href="/admin/accounts" onClick={() => setOpen(false)}>
                <ShieldCheck size={16} />
                관리자 계정
              </Link>
              <Link href="/" onClick={() => setOpen(false)}>
                <ExternalLink size={16} />
                서비스 바로가기
              </Link>
              <form action="/admin/logout" method="post">
                <button type="submit">
                  <LogOut size={16} />
                  로그아웃
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
