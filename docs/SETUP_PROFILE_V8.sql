-- Dán toàn bộ vào Supabase Dashboard > SQL Editor, chọn dự án ExamLab hiện tại.
-- Lưu ý: bảng này chỉ ghi nhận các lần đăng nhập do ứng dụng ExamLab phiên bản V8 gửi.
-- Không phải audit log đáng tin cậy cho bảo mật, và không có IP hay dữ liệu đăng nhập quá khứ.
create table if not exists public.examlab_login_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  device text not null check (char_length(device) <= 100),
  event text not null default 'Đăng nhập' check (char_length(event) <= 80)
);
create index if not exists examlab_login_history_user_time
  on public.examlab_login_history(user_id, logged_at desc);
alter table public.examlab_login_history enable row level security;
drop policy if exists "Examlab user read own login history" on public.examlab_login_history;
create policy "Examlab user read own login history"
  on public.examlab_login_history for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Examlab user insert own login history" on public.examlab_login_history;
create policy "Examlab user insert own login history"
  on public.examlab_login_history for insert to authenticated
  with check (user_id = (select auth.uid()));
grant select, insert on public.examlab_login_history to authenticated;
grant usage, select on sequence public.examlab_login_history_id_seq to authenticated;
