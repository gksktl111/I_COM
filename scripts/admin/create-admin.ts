import { mkdir, writeFile } from "node:fs/promises";
import { authRequest } from "../../src/features/admin/server/auth-core.ts";
if (process.argv.includes("--help")) {
  console.log(
    "--email EMAIL --origin http://localhost:3002\n새 관리자 초대 계정과 일회용 비밀번호 설정 안내 파일을 생성합니다. 비밀번호 생성·저장 및 메일 발송은 하지 않습니다.",
  );
} else {
  process.loadEnvFile(".env.local");
  const arg = (name: string) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
  };
  const email = arg("--email")?.trim().toLowerCase();
  const origin = new URL(arg("--origin") || "http://localhost:3002");
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("--email EMAIL이 필요합니다.");
  if (
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(origin.hostname)
      )) ||
    origin.username ||
    origin.password
  )
    throw new Error("유효한 HTTPS 서비스 주소 또는 로컬 주소가 필요합니다.");
  for (let page = 1; ; page++) {
    const response = await authRequest(`admin/users?page=${page}&per_page=100`);
    if (!response.ok) throw new Error("기존 계정 조회 실패");
    const { users } = await response.json();
    if (!Array.isArray(users)) throw new Error("계정 응답 오류");
    if (users.some((user) => user.email?.toLowerCase() === email))
      throw new Error(
        "기존 계정이 있습니다. 자동 승격하거나 재설정하지 않습니다.",
      );
    if (users.length < 100) break;
  }
  await mkdir(".local/admin", { recursive: true, mode: 0o700 });
  const response = await authRequest("admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "invite", email }),
  });
  if (!response.ok)
    throw new Error(`계정 초대 생성 실패 (HTTP ${response.status})`);
  const data = await response.json();
  if (
    !/^[a-f\d-]{36}$/i.test(data.id ?? "") ||
    data.email?.toLowerCase() !== email ||
    !/^[A-Za-z0-9_-]{20,256}$/.test(data.hashed_token ?? "")
  )
    throw new Error("계정 초대 응답을 확인할 수 없습니다.");
  const promote = await authRequest(`admin/users/${data.id}`, {
    method: "PUT",
    body: JSON.stringify({
      app_metadata: { ...data.app_metadata, role: "admin" },
    }),
  });
  if (!promote.ok)
    throw new Error("계정은 생성되었으나 관리자 권한 설정에 실패했습니다.");
  const link = new URL("/admin/setup", origin);
  link.hash = new URLSearchParams({ token_hash: data.hashed_token }).toString();
  const path = `.local/admin/${data.id}-setup.html`;
  await writeFile(
    path,
    `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>아이콤 관리자 설정</title><body style="font-family:sans-serif;max-width:620px;margin:80px auto;padding:24px"><h1>관리자 비밀번호 설정</h1><p>아래 링크를 열고 본인이 사용할 비밀번호를 정해주세요.</p><p><a href="${link.href}" rel="noreferrer">비밀번호 설정 화면 열기</a></p><p>일회용 링크가 포함된 개인 파일입니다. 공유하지 마세요. 설정이 끝나면 이 파일은 삭제해도 됩니다.</p></body></html>`,
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    `관리자 초대 계정 생성 완료. 비밀번호는 아직 설정되지 않았습니다.\n설정 안내 파일: ${path}\n메일은 발송하지 않았습니다.`,
  );
}
