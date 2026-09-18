export default function Loading() {
  return (
    <section className="admin-panel" role="status" aria-live="polite">
      <div className="admin-panel-body">
        <p className="admin-muted mb-5">관리 데이터를 불러오는 중입니다…</p>
        <div className="space-y-4 motion-safe:animate-pulse" aria-hidden="true">
          <div className="h-5 w-1/3 rounded bg-slate-100" />
          <div className="h-12 rounded bg-slate-100" />
          <div className="h-12 rounded bg-slate-100" />
        </div>
      </div>
    </section>
  );
}
