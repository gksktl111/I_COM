"use client";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ClipboardCheck,
  Database,
  Files,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";

export const adminNavigation = [
  {
    href: "/admin",
    label: "대시보드",
    icon: LayoutDashboard,
    group: "운영 관리",
  },
  {
    href: "/admin/users",
    label: "사용자 관리",
    icon: Users,
    group: "운영 관리",
  },
  {
    href: "/admin/policies",
    label: "정책 관리",
    icon: Files,
    group: "운영 관리",
  },
  {
    href: "/admin/recommendations",
    label: "추천 준비",
    icon: ClipboardCheck,
    group: "운영 관리",
  },
  {
    href: "/admin/collection",
    label: "정책 수집",
    icon: Database,
    group: "운영 관리",
  },
  {
    href: "/admin/policies?tab=quality",
    label: "데이터 품질",
    icon: ClipboardCheck,
    group: "운영 관리",
  },
  {
    href: "/admin/community",
    label: "커뮤니티·신고",
    icon: MessageSquare,
    group: "운영 관리",
  },
  {
    href: "/admin/notices",
    label: "공지·알림",
    icon: Megaphone,
    group: "운영 관리",
  },
  {
    href: "/admin/accounts",
    label: "관리자 계정",
    icon: ShieldCheck,
    group: "시스템 관리",
  },
];

export function useAdminSection() {
  const pathname = usePathname();
  const search = useSearchParams();
  const href =
    pathname === "/admin/policies" && search.get("tab") === "quality"
      ? "/admin/policies?tab=quality"
      : pathname;
  return (
    adminNavigation.find((item) => item.href === href) ?? adminNavigation[0]
  );
}
