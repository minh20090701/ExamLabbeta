-- ExamLab V15 - Bang lich su hoc va RLS. An toan chay lai neu bang da ton tai.
-- Chi tao bang moi, khong thay doi bang de thi, tai khoan hoac Admin.
create table if not exists public.examlab_study_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  study_at timestamptz not null,
  started_at timestamptz,
  duration_ms bigint not null check (duration_ms between 1000 and 86400000),
  mode text not null check (mode in ('stopwatch','focus')),
  subject text not null default '' check (char_length(subject) <= 75),
  complete boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint examlab_study_session_id_length check (char_length(id) between 1 and 120)
);
create index if not exists examlab_study_sessions_user_time_idx
  on public.examlab_study_sessions(user_id,study_at desc);
alter table public.examlab_study_sessions enable row level security;
-- Recreate only policies belonging to this new table (idempotent).
drop policy if exists examlab_study_select_own on public.examlab_study_sessions;
drop policy if exists examlab_study_insert_own on public.examlab_study_sessions;
drop policy if exists examlab_study_update_own on public.examlab_study_sessions;
drop policy if exists examlab_study_delete_own on public.examlab_study_sessions;
create policy examlab_study_select_own on public.examlab_study_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy examlab_study_insert_own on public.examlab_study_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy examlab_study_update_own on public.examlab_study_sessions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy examlab_study_delete_own on public.examlab_study_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.examlab_study_sessions from anon;
grant select,insert,update,delete on public.examlab_study_sessions to authenticated;

-- Không xóa dữ liệu lịch sử đã có. Chỉ giữ quyền cho chủ tài khoản.
