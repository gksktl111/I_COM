import { PageHeading, Panel, EmptyState } from "@/features/admin/components";
import { requireAdmin } from "@/features/admin/server/auth";
import {
  listAdminNotices,
  type AdminNotice,
} from "@/features/admin/server/notices";
import { archiveNoticeAction, saveNoticeAction } from "./actions";

const messages: Record<string, string> = {
  saved: "초안을 저장했습니다.",
  archived: "초안을 보관했습니다.",
  invalid: "제목(120자 이내), 내용(10,000자 이내), 유형을 확인해 주세요.",
  conflict:
    "다른 관리자가 수정하거나 보관한 초안입니다. 최신 내용을 확인해 주세요.",
  error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

function DraftFields({ notice }: { notice?: AdminNotice }) {
  return (
    <>
      {notice && (
        <>
          <input type="hidden" name="id" value={notice.id} />
          <input type="hidden" name="updated_at" value={notice.updated_at} />
        </>
      )}
      <label className="admin-field">
        유형
        <select name="kind" defaultValue={notice?.kind ?? "NOTICE"}>
          <option value="NOTICE">공지</option>
          <option value="NOTIFICATION">알림</option>
        </select>
      </label>
      <label className="admin-field">
        제목
        <input
          name="title"
          required
          maxLength={120}
          defaultValue={notice?.title}
          placeholder="제목을 입력하세요"
        />
      </label>
      <label className="admin-field">
        내용
        <textarea
          name="body"
          required
          maxLength={10000}
          rows={5}
          defaultValue={notice?.body}
          placeholder="초안 내용을 입력하세요"
        />
      </label>
      <button className="admin-button justify-self-start" type="submit">
        {notice ? "수정 저장" : "초안 저장"}
      </button>
    </>
  );
}

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireAdmin();
  const { result } = await searchParams;
  let notices: AdminNotice[] = [];
  let unavailable = false;
  try {
    notices = await listAdminNotices();
  } catch {
    unavailable = true;
  }
  return (
    <>
      <PageHeading
        title="공지 · 알림 관리"
        description="초안 저장 · 사용자 게시/발송 연결 예정"
      />
      {result && messages[result] && (
        <p className="admin-notice" role="status">
          {messages[result]}
        </p>
      )}
      {unavailable ? (
        <Panel>
          <EmptyState
            title="초안을 불러오지 못했습니다"
            description="저장소 연결을 확인한 뒤 다시 시도해 주세요."
          />
        </Panel>
      ) : (
        <>
          <Panel
            title="새 초안 작성"
            description="저장한 내용은 관리자만 확인할 수 있습니다."
          >
            <form action={saveNoticeAction} className="grid gap-4">
              <DraftFields />
            </form>
          </Panel>
          <Panel
            title="저장된 초안"
            description="최근 수정 순으로 최대 100건을 표시합니다."
          >
            {notices.length === 0 ? (
              <EmptyState
                title="저장된 초안이 없습니다"
                description="첫 공지 또는 알림 초안을 작성해 주세요."
              />
            ) : (
              notices.map((notice) => (
                <article className="admin-panel" key={notice.id}>
                  <div className="admin-panel-body">
                    <div className="admin-panel-heading">
                      <h2>{notice.title}</h2>
                      <span className="admin-badge">
                        {notice.kind === "NOTICE" ? "공지" : "알림"} ·{" "}
                        {notice.status === "DRAFT" ? "초안" : "보관"}
                      </span>
                    </div>
                    <p className="admin-muted">
                      작성자 {notice.author_email} · 수정{" "}
                      {new Date(notice.updated_at).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })}
                    </p>
                    {notice.status === "DRAFT" ? (
                      <>
                        <details className="my-4">
                          <summary className="mb-3 cursor-pointer">
                            초안 수정
                          </summary>
                          <form
                            action={saveNoticeAction}
                            className="grid gap-4"
                          >
                            <DraftFields notice={notice} />
                          </form>
                        </details>
                        <form action={archiveNoticeAction}>
                          <input type="hidden" name="id" value={notice.id} />
                          <input
                            type="hidden"
                            name="updated_at"
                            value={notice.updated_at}
                          />
                          <button
                            className="admin-button admin-button-secondary"
                            type="submit"
                          >
                            보관하기
                          </button>
                        </form>
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{notice.body}</p>
                    )}
                  </div>
                </article>
              ))
            )}
          </Panel>
        </>
      )}
    </>
  );
}
