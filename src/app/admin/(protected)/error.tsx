"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section className="admin-panel" role="alert">
      <div className="admin-panel-body">
        <h1 className="text-xl font-bold">관리 데이터를 불러오지 못했습니다</h1>
        <p className="my-4 text-sm text-slate-500">
          연결 상태를 확인한 뒤 다시 시도해주세요. 오류 응답이나 인증 정보는
          표시하지 않습니다.
        </p>
        <button className="admin-button" onClick={reset}>
          다시 시도
        </button>
      </div>
    </section>
  );
}
