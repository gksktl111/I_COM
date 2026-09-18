import type { ReactNode } from "react";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";

/** The protected route layout owns one shell for every administrator page. */
export function AdminShell({
  children,
  email,
}: {
  children: ReactNode;
  email: string;
}) {
  return (
    <div className="admin-app">
      <a className="admin-skip" href="#admin-content">
        본문으로 건너뛰기
      </a>
      <AdminSidebar />
      <div className="admin-workspace">
        <AdminHeader
          email={email}
          environment={
            process.env.VERCEL_ENV === "preview"
              ? "미리보기 (PREVIEW)"
              : process.env.NODE_ENV === "production"
                ? "운영 (PROD)"
                : "개발 (DEV)"
          }
        />
        <main id="admin-content" className="admin-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="admin-footer">
          © 아이콤 · 더 나은 육아를 위한 연결
        </footer>
      </div>
    </div>
  );
}
