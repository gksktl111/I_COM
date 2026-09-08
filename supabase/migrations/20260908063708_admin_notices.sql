-- Internal drafts only. No publication or delivery capability is exposed.
create table public.admin_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  kind text not null check (kind in ('NOTICE', 'NOTIFICATION')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ARCHIVED')),
  author_id uuid not null,
  author_email text not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index admin_notices_updated_at_idx on public.admin_notices (updated_at desc, id);
alter table public.admin_notices enable row level security;
revoke all on public.admin_notices from public, anon, authenticated;
grant select, insert, update on public.admin_notices to service_role;
