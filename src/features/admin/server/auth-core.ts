export type AuthUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
  banned_until?: string;
  app_metadata?: { role?: string };
};

export function isAdministrator(
  user: AuthUser | null,
  now = Date.now(),
): boolean {
  return Boolean(
    user?.id &&
      user.email_confirmed_at &&
      !user.is_anonymous &&
      user.app_metadata?.role === "admin" &&
      (!user.banned_until || Date.parse(user.banned_until) <= now),
  );
}

export function authConfig() {
  const key = process.env.SUPABASE_SECRET_KEY;
  const url = new URL(process.env.SUPABASE_URL || "https://invalid.local");
  if (
    !key ||
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("ADMIN_AUTH_CONFIGURATION");
  return { key, url: url.origin };
}

export async function authRequest(
  path: string,
  init: RequestInit = {},
  fetcher = fetch,
) {
  const { key, url } = authConfig();
  return fetcher(`${url}/auth/v1/${path}`, {
    ...init,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

/** Network verification, never local JWT decoding or user-editable metadata. */
export async function verifyAdministrator(
  token: string,
  fetcher = fetch,
): Promise<AuthUser | null> {
  if (!token || token.length > 8192) return null;
  try {
    const response = await authRequest(
      "user",
      { headers: { Authorization: `Bearer ${token}` } },
      fetcher,
    );
    if (!response.ok) return null;
    const user: AuthUser = await response.json();
    return isAdministrator(user) ? user : null;
  } catch {
    return null;
  }
}
