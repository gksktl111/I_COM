import { env } from "node:process";
import type { RawBundle, NormalizedBundle } from "./normalize.ts";

export type CurrentPolicy = {
  snapshotId: string;
  raw: RawBundle;
  normalized: NormalizedBundle;
};
export interface PolicyRepository {
  command<T>(action: string, payload: Record<string, unknown>): Promise<T>;
}
export class RepositoryError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/** Server-only Data API access. Credentials and upstream error bodies never enter logs. */
export function createRepository(
  fetcher: typeof fetch = fetch,
): PolicyRepository {
  const key = env.SUPABASE_SECRET_KEY;
  if (!key || !env.SUPABASE_URL)
    throw new RepositoryError("missing-supabase-environment");
  const url = new URL(env.SUPABASE_URL);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.username ||
    url.password ||
    url.port
  )
    throw new RepositoryError("invalid-supabase-url");
  const endpoint = new URL("/rest/v1/rpc/policy_sync_command", url);
  return {
    async command<T>(
      action: string,
      payload: Record<string, unknown>,
    ): Promise<T> {
      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ p_action: action, p_payload: payload }),
        });
      } catch {
        throw new RepositoryError("database-transport-failed");
      }
      if (!response.ok)
        throw new RepositoryError(`database-http-${response.status}`);
      try {
        return (await response.json()) as T;
      } catch {
        throw new RepositoryError("database-response-invalid");
      }
    },
  };
}
