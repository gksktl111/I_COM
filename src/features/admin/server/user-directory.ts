import "server-only";
import { requireAdmin } from "./auth";
import { authRequest } from "./auth-core";

export type UserProvider = "kakao" | "naver" | "google";
export type UserStatus = "active" | "restricted";
export type UserFilters = {
  q: string;
  provider: "all" | UserProvider;
  status: "all" | UserStatus;
  sort: "newest" | "oldest" | "recent_login";
  activity: "all" | "7d" | "30d" | "90d" | "never";
  perPage: 15 | 30 | 50;
  page: number;
};
export type DirectoryUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  providers: UserProvider[];
  status: UserStatus;
};
export type UserDirectory = {
  items: DirectoryUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: {
    total: number;
    recentlyJoined: number;
    restricted: number;
    recentlyActive: number;
  };
  filters: UserFilters;
};

function choice<T extends string>(
  value: string | string[] | undefined,
  options: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && options.includes(value as T)
    ? (value as T)
    : fallback;
}

export function normalizeUserFilters(
  raw: Record<string, string | string[] | undefined> = {},
): UserFilters {
  const page = typeof raw.page === "string" ? Number(raw.page) : NaN;
  const perPage = typeof raw.perPage === "string" ? Number(raw.perPage) : NaN;
  return {
    q: (typeof raw.q === "string" ? raw.q : "").trim().slice(0, 100),
    provider: choice(raw.provider, ["all", "kakao", "naver", "google"], "all"),
    status: choice(raw.status, ["all", "active", "restricted"], "all"),
    sort: choice(raw.sort, ["newest", "oldest", "recent_login"], "newest"),
    activity: choice(raw.activity, ["all", "7d", "30d", "90d", "never"], "all"),
    perPage: perPage === 15 || perPage === 50 ? perPage : 30,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("ADMIN_USERS_INVALID_RESPONSE");
  return value as Record<string, unknown>;
}
function optionalString(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string")
    throw new Error("ADMIN_USERS_INVALID_RESPONSE");
  return value;
}
function date(value: unknown): string | null {
  const result = optionalString(value);
  if (result && !Number.isFinite(Date.parse(result)))
    throw new Error("ADMIN_USERS_INVALID_RESPONSE");
  return result;
}
function providers(value: unknown): UserProvider[] {
  const metadata = value == null ? {} : object(value);
  if (
    metadata.providers != null &&
    (!Array.isArray(metadata.providers) ||
      metadata.providers.some((p) => typeof p !== "string"))
  )
    throw new Error("ADMIN_USERS_INVALID_RESPONSE");
  const primary = optionalString(metadata.provider);
  const all = [
    ...((metadata.providers as string[] | undefined) ?? []),
    ...(primary ? [primary] : []),
  ];
  return [
    ...new Set(
      all.filter(
        (provider): provider is UserProvider =>
          provider === "kakao" || provider === "naver" || provider === "google",
      ),
    ),
  ];
}

/** Complete Auth directory; recent join and activity counts cover the preceding 30 days. */
export async function loadUserDirectory(
  rawFilters: Record<string, string | string[] | undefined> = {},
): Promise<UserDirectory> {
  const started = performance.now();
  await requireAdmin();
  const checkBudget = () => {
    if (performance.now() - started >= 30_000)
      throw new Error("ADMIN_USERS_TIME_LIMIT");
  };
  checkBudget();
  const signal = AbortSignal.timeout(
    Math.max(1, Math.floor(30_000 - (performance.now() - started))),
  );
  const filters = normalizeUserFilters(rawFilters);
  const now = Date.now();
  const rows: { item: DirectoryUser; search: string }[] = [];
  const ids = new Set<string>();
  let completed = false;
  for (let page = 1; page <= 100; page++) {
    checkBudget();
    let body: unknown;
    try {
      const response = await authRequest(
        `admin/users?page=${page}&per_page=1000`,
        {},
        (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.any([
              signal,
              ...(init?.signal ? [init.signal] : []),
            ]),
          }),
      );
      if (!response.ok) throw new Error("ADMIN_USERS_FETCH_FAILED");
      body = await response.json();
    } catch {
      checkBudget();
      if (signal.aborted) throw new Error("ADMIN_USERS_TIME_LIMIT");
      throw new Error("ADMIN_USERS_FETCH_FAILED");
    }
    checkBudget();
    const users = object(body).users;
    if (!Array.isArray(users) || users.length > 1000)
      throw new Error("ADMIN_USERS_INVALID_RESPONSE");
    for (const value of users) {
      const user = object(value);
      if (typeof user.id !== "string" || !user.id.trim())
        throw new Error("ADMIN_USERS_INVALID_RESPONSE");
      if (ids.has(user.id)) throw new Error("ADMIN_USERS_UNSTABLE_PAGINATION");
      ids.add(user.id);
      const email = optionalString(user.email);
      const banned = date(user.banned_until);
      const status: UserStatus =
        banned && Date.parse(banned) > now ? "restricted" : "active";
      const at = email?.lastIndexOf("@") ?? -1;
      rows.push({
        search: `${user.id}\n${email ?? ""}`.toLowerCase(),
        item: {
          id: user.id,
          email:
            email && at > 0
              ? `${email.slice(0, 1)}***@${email.slice(at + 1)}`
              : null,
          created_at: date(user.created_at),
          last_sign_in_at: date(user.last_sign_in_at),
          banned_until: banned,
          status,
          providers: providers(user.app_metadata),
        },
      });
    }
    if (users.length < 1000) {
      completed = true;
      break;
    }
  }
  if (!completed) throw new Error("ADMIN_USERS_PAGE_LIMIT");
  checkBudget();
  const within = (value: string | null, days: number) =>
    value !== null &&
    Date.parse(value) >= now - days * 86_400_000 &&
    Date.parse(value) <= now;
  const summary = {
    total: rows.length,
    recentlyJoined: rows.filter(({ item }) => within(item.created_at, 30))
      .length,
    restricted: rows.filter(({ item }) => item.status === "restricted").length,
    recentlyActive: rows.filter(({ item }) => within(item.last_sign_in_at, 30))
      .length,
  };
  const query = filters.q.toLowerCase();
  const matches = rows
    .filter(
      ({ item, search }) =>
        (!query || search.includes(query)) &&
        (filters.provider === "all" ||
          item.providers.includes(filters.provider)) &&
        (filters.status === "all" || item.status === filters.status) &&
        (filters.activity === "all" ||
          (filters.activity === "never"
            ? item.last_sign_in_at === null
            : within(
                item.last_sign_in_at,
                Number.parseInt(filters.activity, 10),
              ))),
    )
    .map(({ item }) => item);
  matches.sort((a, b) => {
    const left =
      filters.sort === "recent_login" ? a.last_sign_in_at : a.created_at;
    const right =
      filters.sort === "recent_login" ? b.last_sign_in_at : b.created_at;
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    const difference = left && right ? Date.parse(left) - Date.parse(right) : 0;
    return (
      (filters.sort === "oldest" ? difference : -difference) ||
      a.id.localeCompare(b.id)
    );
  });
  const total = matches.length;
  const totalPages = Math.max(1, Math.ceil(total / filters.perPage));
  filters.page = Math.min(filters.page, totalPages);
  const offset = (filters.page - 1) * filters.perPage;
  checkBudget();
  return {
    items: matches.slice(offset, offset + filters.perPage),
    page: filters.page,
    pageSize: filters.perPage,
    total,
    totalPages,
    summary,
    filters,
  };
}
