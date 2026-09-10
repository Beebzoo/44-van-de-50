-- 44 van de 50: the two tables and the row-level policy.
--
-- Run this once in the Supabase SQL editor of a fresh free project.
-- Then put the project URL and the anon key in js/config.js.
--
-- The policy is the whole security model: the anon key is public, the
-- koppelcode in the x-learner header is the secret. Test it before the
-- first insert; a request without the header must return an empty list:
--
--   curl -s "https://<project>.supabase.co/rest/v1/attempts?select=id" \
--     -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>"
--   -> []
--
-- and with a header that matches rows it returns them.

create table if not exists attempts (
  id uuid primary key,
  learner text not null,
  ts bigint not null,
  kind text not null,
  ref text,
  score integer,
  total integer,
  duration_ms integer,
  device text,
  content_version text,
  schema integer default 1,
  answers jsonb,
  extra jsonb
);
create index if not exists attempts_learner_ts on attempts (learner, ts);

create table if not exists settings (
  learner text primary key,
  data jsonb not null,
  updated_at bigint not null
);

alter table attempts enable row level security;
alter table settings enable row level security;

drop policy if exists "eigen pogingen" on attempts;
create policy "eigen pogingen" on attempts
  for all to anon
  using (learner = current_setting('request.headers', true)::json->>'x-learner')
  with check (learner = current_setting('request.headers', true)::json->>'x-learner');

drop policy if exists "eigen instellingen" on settings;
create policy "eigen instellingen" on settings
  for all to anon
  using (learner = current_setting('request.headers', true)::json->>'x-learner')
  with check (learner = current_setting('request.headers', true)::json->>'x-learner');
