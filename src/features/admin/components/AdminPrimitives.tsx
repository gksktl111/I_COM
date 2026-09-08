import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="admin-page-actions">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  hint,
  icon,
  tone = "teal",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "teal" | "blue" | "amber" | "violet";
}) {
  return (
    <article className={`admin-stat admin-tone-${tone}`}>
      <div className="admin-stat-top">
        <h2>{label}</h2>
        {icon && <span className="admin-stat-icon">{icon}</span>}
      </div>
      <div className="admin-stat-value">{value}</div>
      {(detail || hint) && (
        <div className="admin-stat-detail">{detail ?? hint}</div>
      )}
    </article>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-panel ${className}`}>
      {(title || action) && (
        <div className="admin-panel-heading">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="admin-panel-body">{children}</div>
    </section>
  );
}

export function EmptyState({
  title = "표시할 데이터가 없습니다",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty">
      <span>
        <Inbox size={27} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
