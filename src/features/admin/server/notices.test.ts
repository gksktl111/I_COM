import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

let db: PGlite;
before(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  await db.exec(
    await readFile(
      new URL(
        "../../../../supabase/migrations/20260908063708_admin_notices.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
after(async () => {
  await db.close();
});

const author = "00000000-0000-4000-8000-000000000001";
async function draft(title = "공지 초안", kind = "NOTICE") {
  return db.query<{ id: string; status: string; updated_at: string }>(
    "insert into public.admin_notices(title,body,kind,author_id,author_email,updated_by) values ($1,'내용',$2,$3,'admin@example.test',$3) returning id,status,updated_at::text",
    [title, kind, author],
  );
}

test("draft lifecycle rejects stale editing and edits after archive", async () => {
  await db.exec("set role service_role");
  try {
    const original = (await draft()).rows[0];
    assert.equal(original.status, "DRAFT");
    const edited = await db.query<{ updated_at: string }>(
      "update public.admin_notices set title='수정된 초안', updated_at=updated_at + interval '1 second' where id=$1 and status='DRAFT' and updated_at=$2 returning updated_at::text",
      [original.id, original.updated_at],
    );
    assert.equal(edited.rows.length, 1);
    const stale = await db.query(
      "update public.admin_notices set title='오래된 내용' where id=$1 and status='DRAFT' and updated_at=$2 returning id",
      [original.id, original.updated_at],
    );
    assert.equal(stale.rows.length, 0);
    const archived = await db.query(
      "update public.admin_notices set status='ARCHIVED' where id=$1 and status='DRAFT' and updated_at=$2 returning id",
      [original.id, edited.rows[0].updated_at],
    );
    assert.equal(archived.rows.length, 1);
    const afterArchive = await db.query(
      "update public.admin_notices set title='재수정' where id=$1 and status='DRAFT' returning id",
      [original.id],
    );
    assert.equal(afterArchive.rows.length, 0);
  } finally {
    await db.exec("reset role");
  }
});

test("database refuses blank or oversized content and unsupported delivery states", async () => {
  await assert.rejects(draft("   "), /check constraint/);
  await assert.rejects(draft("x".repeat(121)), /check constraint/);
  await assert.rejects(draft("제목", "EMAIL"), /check constraint/);
  const row = (await draft("알림 초안", "NOTIFICATION")).rows[0];
  await assert.rejects(
    db.query("update public.admin_notices set body='' where id=$1", [row.id]),
    /check constraint/,
  );
  await assert.rejects(
    db.query("update public.admin_notices set body=$1 where id=$2", [
      "x".repeat(10001),
      row.id,
    ]),
    /check constraint/,
  );
  await assert.rejects(
    db.query("update public.admin_notices set status='PUBLISHED' where id=$1", [
      row.id,
    ]),
    /check constraint/,
  );
});

test("anonymous and signed-in users cannot read or mutate internal drafts", async () => {
  const rls = await db.query<{ relrowsecurity: boolean }>(
    "select relrowsecurity from pg_class where oid='public.admin_notices'::regclass",
  );
  assert.equal(rls.rows[0].relrowsecurity, true);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(
        db.query("select * from public.admin_notices"),
        /permission denied/,
      );
      await assert.rejects(draft(), /permission denied/);
      await assert.rejects(
        db.query("update public.admin_notices set status='ARCHIVED'"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("delete from public.admin_notices"),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  }
  await db.exec("set role service_role");
  try {
    await assert.rejects(
      db.query("delete from public.admin_notices"),
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
});
