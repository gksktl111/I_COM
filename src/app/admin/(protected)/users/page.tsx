import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Search,
  Clock3,
  UserPlus,
  UserRound,
  Users,
  RotateCcw,
} from "lucide-react";
import { requireAdmin } from "@/features/admin/server/auth";
import { loadUserDirectory } from "@/features/admin/server/user-directory";
import {
  PageHeading,
  Panel,
  EmptyState,
  StatCard,
} from "@/features/admin/components";
import { Select } from "@/components/ui/select";
import { dateTime } from "@/features/admin/format";

const channels: Record<string, string> = {
  all: "전체 채널",
  kakao: "카카오",
  naver: "네이버",
  google: "구글",
};
const statuses = {
  all: "전체 상태",
  active: "정상",
  restricted: "이용 제한",
};
const statusClass = {
  active: "",
  restricted: "admin-badge-danger",
};
type Params = Record<string, string | string[] | undefined>;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const result = await loadUserDirectory(params);
  const { filters, summary } = result;
  const selected =
    result.items.find((user) => user.id === params.user) ?? result.items[0];
  const base = new URLSearchParams({
    q: filters.q,
    provider: filters.provider,
    status: filters.status,
    activity: filters.activity,
    sort: filters.sort,
    perPage: String(filters.perPage),
  });
  function href(values: Record<string, string>, anchor = "") {
    const query = new URLSearchParams(base);
    for (const [key, value] of Object.entries(values)) query.set(key, value);
    return `/admin/users?${query}${anchor}`;
  }
  const hasFilters = Boolean(
    filters.q ||
      filters.provider !== "all" ||
      filters.status !== "all" ||
      filters.activity !== "all",
  );
  const first = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  return (
    <>
      <PageHeading
        title="사용자 관리"
        description="사용자를 검색하고 연동 채널·계정 상태별로 조회합니다."
        action={
          <span className="admin-badge admin-badge-neutral">
            전체 {summary.total.toLocaleString("ko-KR")}명
          </span>
        }
      />
      <div className="admin-grid-stats">
        <StatCard
          label="전체 등록 계정"
          value={`${summary.total.toLocaleString("ko-KR")}명`}
          icon={<Users aria-hidden="true" />}
          tone="blue"
          hint="현재 등록된 계정"
        />
        <StatCard
          label="최근 30일 가입"
          value={`${summary.recentlyJoined.toLocaleString("ko-KR")}명`}
          icon={<UserPlus aria-hidden="true" />}
          hint="가입 시각 기준"
        />
        <StatCard
          label="최근 30일 로그인"
          value={`${summary.recentlyActive.toLocaleString("ko-KR")}명`}
          icon={<Clock3 aria-hidden="true" />}
          tone="amber"
          hint="최근 로그인 시각 기준"
        />
        <StatCard
          label="이용 제한"
          value={`${summary.restricted.toLocaleString("ko-KR")}명`}
          icon={<UserRound aria-hidden="true" />}
          tone="violet"
          hint="현재 제한 기간에 해당하는 계정"
        />
      </div>
      <Panel
        title="사용자 검색"
        description="검색과 필터는 전체 등록 계정에 적용됩니다."
      >
        <nav className="admin-channel-tabs" aria-label="연동 채널별 조회">
          {Object.entries(channels).map(([value, label]) => (
            <Link
              key={value}
              href={href({ provider: value, page: "1" })}
              aria-current={filters.provider === value ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form
          key={base.toString()}
          className="admin-user-filters"
          action="/admin/users"
          method="get"
          aria-label="사용자 검색 조건"
        >
          <input type="hidden" name="provider" value={filters.provider} />
          <label className="admin-field admin-user-search" htmlFor="user-query">
            사용자 검색
            <span className="admin-search-input">
              <Search size={16} aria-hidden="true" />
              <input
                id="user-query"
                name="q"
                type="search"
                maxLength={100}
                defaultValue={filters.q}
                placeholder="이메일 또는 사용자 ID 검색"
              />
            </span>
          </label>
          <label className="admin-field" htmlFor="user-status">
            계정 상태
            <Select
              id="user-status"
              name="status"
              defaultValue={filters.status}
              aria-label="계정 상태"
            >
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="admin-field" htmlFor="user-activity">
            최근 로그인
            <Select
              id="user-activity"
              name="activity"
              defaultValue={filters.activity}
              aria-label="최근 로그인"
            >
              <option value="all">전체 기간</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
              <option value="90d">최근 90일</option>
              <option value="never">로그인 기록 없음</option>
            </Select>
          </label>
          <label className="admin-field" htmlFor="user-sort">
            정렬
            <Select
              id="user-sort"
              name="sort"
              defaultValue={filters.sort}
              aria-label="정렬"
            >
              <option value="newest">최근 가입순</option>
              <option value="oldest">오래된 가입순</option>
              <option value="recent_login">최근 로그인순</option>
            </Select>
          </label>
          <label className="admin-field" htmlFor="user-per-page">
            표시 수
            <Select
              id="user-per-page"
              name="perPage"
              defaultValue={String(filters.perPage)}
              aria-label="페이지당 표시 수"
            >
              <option value="15">15개씩</option>
              <option value="30">30개씩</option>
              <option value="50">50개씩</option>
            </Select>
          </label>
          <div className="admin-user-filter-actions">
            <button className="admin-button" type="submit">
              <Search size={15} aria-hidden="true" />
              검색 실행
            </button>
            <Link
              className="admin-button admin-button-secondary"
              href="/admin/users"
            >
              <RotateCcw size={15} aria-hidden="true" />
              초기화
            </Link>
          </div>
        </form>
      </Panel>
      <div className="admin-users-layout">
        <Panel
          title="사용자 목록"
          description={`검색 결과 ${result.total.toLocaleString("ko-KR")}명 · ${first}–${Math.min(result.page * result.pageSize, result.total)}명 표시`}
          action={
            <span className="admin-badge admin-badge-neutral">
              {result.page} / {result.totalPages}페이지
            </span>
          }
        >
          {hasFilters && (
            <p className="admin-user-applied">
              {[
                filters.q && `검색: ${filters.q}`,
                filters.provider !== "all" && channels[filters.provider],
                filters.status !== "all" && statuses[filters.status],
                filters.activity !== "all" &&
                  (filters.activity === "never"
                    ? "로그인 기록 없음"
                    : `최근 ${filters.activity.slice(0, -1)}일 로그인`),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {result.items.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table admin-user-table">
                <thead>
                  <tr>
                    <th scope="col">사용자 / 연동</th>
                    <th scope="col">가입일 (KST)</th>
                    <th scope="col">최근 로그인 (KST)</th>
                    <th scope="col">상태</th>
                    <th scope="col">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((user) => (
                    <tr
                      key={user.id}
                      className={
                        user.id === selected?.id
                          ? "admin-row-selected"
                          : undefined
                      }
                    >
                      <td className="admin-table-title">
                        <div className="flex items-start gap-3">
                          <span className="admin-avatar" aria-hidden="true">
                            <UserRound size={17} />
                          </span>
                          <div className="min-w-0">
                            <Link
                              className="font-semibold break-all"
                              href={href(
                                { page: String(result.page), user: user.id },
                                "#user-detail",
                              )}
                            >
                              {user.email ?? "이메일 없음"}
                            </Link>
                            <p className="admin-record-meta">
                              {user.providers
                                .map((provider) => channels[provider])
                                .join(" · ") || "연동 정보 미확인"}
                            </p>
                            <p className="admin-record-meta">
                              ID {user.id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{dateTime(user.created_at)}</td>
                      <td>{dateTime(user.last_sign_in_at)}</td>
                      <td>
                        <span
                          className={`admin-badge ${statusClass[user.status]}`}
                        >
                          {statuses[user.status]}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="admin-user-open"
                          href={href(
                            { page: String(result.page), user: user.id },
                            "#user-detail",
                          )}
                          aria-label={`${user.email ?? user.id} 상세 보기`}
                          aria-current={
                            user.id === selected?.id ? "true" : undefined
                          }
                        >
                          <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={
                hasFilters
                  ? "조건에 맞는 사용자가 없습니다"
                  : "등록된 사용자가 없습니다"
              }
              description={
                hasFilters
                  ? "검색어나 조회 조건을 변경해 보세요."
                  : "계정이 생성되면 이곳에서 조회할 수 있습니다."
              }
              action={
                hasFilters && (
                  <Link
                    className="admin-button admin-button-secondary"
                    href="/admin/users"
                  >
                    전체 사용자 보기
                  </Link>
                )
              }
            />
          )}
          <nav className="admin-pagination" aria-label="사용자 페이지">
            {result.page > 1 && (
              <Link href={href({ page: String(result.page - 1) })}>← 이전</Link>
            )}
            <span aria-current="page">
              {result.page} / {result.totalPages}
            </span>
            {result.page < result.totalPages && (
              <Link href={href({ page: String(result.page + 1) })}>다음 →</Link>
            )}
          </nav>
        </Panel>
        <aside
          id="user-detail"
          className="admin-user-detail"
          aria-label="선택한 사용자 상세"
        >
          <Panel
            title="사용자 상세 프로필"
            description="현재 조회 결과에서 선택한 계정 정보"
          >
            {selected ? (
              <>
                <div className="admin-user-identity">
                  <span className="admin-avatar">
                    <UserRound size={22} aria-hidden="true" />
                  </span>
                  <strong>{selected.email ?? "이메일 없음"}</strong>
                  <span
                    className={`admin-badge ${statusClass[selected.status]}`}
                  >
                    {statuses[selected.status]}
                  </span>
                </div>
                <dl className="admin-user-facts">
                  <div>
                    <dt>사용자 ID</dt>
                    <dd className="font-mono">{selected.id}</dd>
                  </div>
                  <div>
                    <dt>연동 채널</dt>
                    <dd>
                      {selected.providers
                        .map((provider) => channels[provider])
                        .join(" · ") || "미확인"}
                    </dd>
                  </div>
                  <div>
                    <dt>가입일 (KST)</dt>
                    <dd>{dateTime(selected.created_at)}</dd>
                  </div>
                  <div>
                    <dt>최근 로그인 (KST)</dt>
                    <dd>{dateTime(selected.last_sign_in_at)}</dd>
                  </div>
                  {selected.status === "restricted" && (
                    <div>
                      <dt>이용 제한 종료 (KST)</dt>
                      <dd>{dateTime(selected.banned_until)}</dd>
                    </div>
                  )}
                </dl>
                <div className="admin-user-profile-note">
                  <h3>
                    <CalendarDays size={16} aria-hidden="true" />
                    맞춤 정책 프로필
                  </h3>
                  <p>
                    자녀·거주지·가구 특성·관심 분야는 계정에 저장되지 않아 아직
                    조회할 수 없습니다.
                  </p>
                  <p>이메일은 마스킹하여 표시합니다.</p>
                </div>
              </>
            ) : (
              <EmptyState
                title="선택할 사용자가 없습니다"
                description="조회 조건을 변경하면 사용자 상세를 확인할 수 있습니다."
              />
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
