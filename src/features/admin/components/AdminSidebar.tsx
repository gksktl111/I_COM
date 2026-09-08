"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  Compass,
  Menu,
  X,
  BarChart3,
  ScrollText,
  Settings,
} from "lucide-react";
import { adminNavigation, useAdminSection } from "./admin-navigation";

export function AdminSidebar() {
  const active = useAdminSection();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <aside
      className={`admin-sidebar admin-chrome-sidebar ${open ? "is-menu-open" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className="admin-sidebar-heading">
        <Link
          className="admin-brand"
          href="/admin"
          aria-label="아이콤 관리자 대시보드"
          onClick={() => setOpen(false)}
        >
          <span className="admin-brand-icon">
            <Compass size={20} aria-hidden="true" />
          </span>
          <span>아이콤</span>
          <span className="admin-brand-badge">관리자</span>
        </Link>
        <button
          ref={toggle}
          type="button"
          className="admin-menu-toggle"
          aria-controls="admin-navigation"
          aria-expanded={open}
          aria-label={open ? "관리자 메뉴 닫기" : "관리자 메뉴 열기"}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <X size={20} aria-hidden="true" />
          ) : (
            <Menu size={20} aria-hidden="true" />
          )}
          <span>메뉴</span>
        </button>
      </div>
      <nav
        id="admin-navigation"
        className="admin-navigation"
        aria-label="관리자 메뉴"
      >
        {["운영 관리", "시스템 관리"].map((group) => (
          <div className="admin-nav-group" key={group}>
            <p className="admin-nav-label">
              {group === "운영 관리" ? "운영 메뉴" : group}
            </p>
            <div className="admin-nav">
              {adminNavigation
                .filter((item) => item.group === group)
                .map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={active.href === href ? "is-active" : undefined}
                    aria-current={active.href === href ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                ))}
              {(group === "운영 관리"
                ? [{ label: "서비스 통계", icon: BarChart3 }]
                : [
                    { label: "감사 로그", icon: ScrollText },
                    { label: "설정", icon: Settings },
                  ]
              ).map(({ label, icon: Icon }) => (
                <span
                  className="admin-nav-unavailable"
                  aria-disabled="true"
                  title={`${label} 기능 준비 중`}
                  key={label}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{label}</span>
                  <small>준비 중</small>
                </span>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
