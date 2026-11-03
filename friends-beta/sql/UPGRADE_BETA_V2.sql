-- EXAMLAB FRIENDS BETA V2 — CHẠY SAU SETUP_BETA.sql (V1)
-- Chỉ thêm bảng thách đấu và hai hàm RPC V2. Không sửa ExamLab chính,
-- không xóa dữ liệu Beta V1 hay tác động bảng auth.users.
-- Chạy trong Supabase > SQL Editor thuộc dự án ExamLab hiện tại.

begin;

create table if not exists public.examlab_beta_duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  challenge_day date not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check (challenger_id <> opponent_id)
);
create index if not exists ex_beta_duels_challenger_idx on public.examlab_beta_duels(challenger_id,challenge_day desc);
create index if not exists ex_beta_duels_opponent_idx on public.examlab_beta_duels(opponent_id,challenge_day desc);
-- Mỗi cặp chỉ có một thách đấu đang hiệu lực trong ngày.
create unique index if not exists ex_beta_duels_pair_day_active_idx
  on public.examlab_beta_duels(least(challenger_id,opponent_id),greatest(challenger_id,opponent_id),challenge_day)
  where status in ('pending','accepted');
alter table public.examlab_beta_duels enable row level security;
revoke all on public.examlab_beta_duels from public, anon, authenticated;

-- Chỉ kết bạn đã chấp nhận mới thách đấu được; tối đa 3 lời mời/người/ngày.
-- Không tạo lượt thi mới. Mỗi người dùng lượt 10 câu/ngày của Beta V1.
create or replace function public.examlab_beta_v2_duel_action(
  p_action text,
  p_other_user uuid default null,
  p_duel_id uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_duel public.examlab_beta_duels%rowtype;
  v_new_id uuid;
begin
  if v_uid is null then raise exception 'Hãy đăng nhập ExamLab.'; end if;
  if not exists (select 1 from public.examlab_beta_profiles where user_id=v_uid)
    then raise exception 'Hãy tạo hồ sơ Beta trước.'; end if;
  if p_action='invite' then
    if p_other_user is null or p_other_user=v_uid then
      raise exception 'Hãy chọn một người bạn hợp lệ.';
    end if;
    -- Ngăn gửi song song để vượt hạn mức trên cùng tài khoản.
    perform pg_advisory_xact_lock(hashtext(v_uid::text),2026);
    if not exists (
      select 1 from public.examlab_beta_requests r
      where r.status='accepted'
      and ((r.sender_id=v_uid and r.receiver_id=p_other_user)
        or (r.sender_id=p_other_user and r.receiver_id=v_uid))
    ) then raise exception 'Chỉ có thể thách đấu với người đã kết bạn.'; end if;
    if (select count(*) from public.examlab_beta_duels
        where challenger_id=v_uid and challenge_day=v_today) >= 3 then
      raise exception 'Bạn đã gửi đủ 3 lời thách đấu hôm nay.';
    end if;
    if exists (select 1 from public.examlab_beta_duels d
      where d.challenge_day=v_today and d.status in ('pending','accepted')
      and ((d.challenger_id=v_uid and d.opponent_id=p_other_user)
        or (d.opponent_id=v_uid and d.challenger_id=p_other_user))) then
      return 'already_exists';
    end if;
    insert into public.examlab_beta_duels(challenger_id,opponent_id,challenge_day)
      values(v_uid,p_other_user,v_today)
      on conflict do nothing returning id into v_new_id;
    if v_new_id is null then return 'already_exists'; end if;
    return 'invited';
  end if;

  if p_duel_id is null then raise exception 'Thiếu mã thách đấu.'; end if;
  select * into v_duel from public.examlab_beta_duels
    where id=p_duel_id for update;
  if not found then raise exception 'Không tìm thấy lời thách đấu.'; end if;
  if v_uid<>v_duel.challenger_id and v_uid<>v_duel.opponent_id then
    raise exception 'Bạn không có quyền thao tác lời thách đấu này.';
  end if;
  if p_action='accept' and v_uid=v_duel.opponent_id
      and v_duel.status='pending' and v_duel.challenge_day=v_today then
    if not exists (select 1 from public.examlab_beta_requests r
      where r.status='accepted'
      and ((r.sender_id=v_uid and r.receiver_id=v_duel.challenger_id)
        or (r.receiver_id=v_uid and r.sender_id=v_duel.challenger_id))) then
      raise exception 'Hai người không còn là bạn bè.';
    end if;
    update public.examlab_beta_duels set status='accepted',answered_at=now()
      where id=v_duel.id;
    return 'accepted';
  elsif p_action='decline' and v_uid=v_duel.opponent_id
      and v_duel.status='pending' then
    update public.examlab_beta_duels set status='declined',answered_at=now()
      where id=v_duel.id;
    return 'declined';
  elsif p_action='cancel' and v_uid=v_duel.challenger_id
      and v_duel.status='pending' then
    update public.examlab_beta_duels set status='cancelled',answered_at=now()
      where id=v_duel.id;
    return 'cancelled';
  end if;
  raise exception 'Không thể thực hiện thao tác với lời thách đấu này.';
end $$;

-- Trả về dữ liệu của CHÍNH tài khoản và điểm tổng hợp của bạn bè.
-- Không trả email, đáp án đúng, đáp án đã chọn hay bảng auth.users.
create or replace function public.examlab_beta_v2_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_month date := date_trunc('month',now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_cursor date;
  v_streak integer := 0;
  v_total integer := 0;
  v_points integer := 0;
  v_correct integer := 0;
  v_possible integer := 0;
  v_best integer := 0;
  v_month_points integer := 0;
  v_history jsonb := '[]'::jsonb;
  v_monthly jsonb := '[]'::jsonb;
  v_duels jsonb := '[]'::jsonb;
  v_badges jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Hãy đăng nhập ExamLab.'; end if;
  if not exists (select 1 from public.examlab_beta_profiles where user_id=v_uid)
    then return jsonb_build_object('joined',false); end if;

  select count(*)::integer,coalesce(sum(score),0)::integer,
    coalesce(sum(correct_count),0)::integer,
    coalesce(sum(cardinality(question_ids)),0)::integer,
    coalesce(max(score),0)::integer,
    coalesce(sum(score) filter(where challenge_day>=v_month),0)::integer
  into v_total,v_points,v_correct,v_possible,v_best,v_month_points
  from public.examlab_beta_sessions
  where user_id=v_uid and submitted_at is not null;

  v_cursor := v_today;
  if not exists(select 1 from public.examlab_beta_sessions
      where user_id=v_uid and challenge_day=v_cursor and submitted_at is not null)
    then v_cursor:=v_today-1; end if;
  while v_streak < 365 and exists(select 1 from public.examlab_beta_sessions
      where user_id=v_uid and challenge_day=v_cursor and submitted_at is not null) loop
    v_streak:=v_streak+1;
    v_cursor:=v_cursor-1;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('day',h.challenge_day,'score',h.score,
      'correct',h.correct_count,'seconds',h.duration_seconds) order by h.challenge_day desc),'[]'::jsonb)
    into v_history
    from (select challenge_day,score,correct_count,duration_seconds
      from public.examlab_beta_sessions where user_id=v_uid and submitted_at is not null
      order by challenge_day desc limit 14) h;

  with circle as (
    select v_uid as user_id
    union
    select case when r.sender_id=v_uid then r.receiver_id else r.sender_id end
      from public.examlab_beta_requests r
      where r.status='accepted' and (r.sender_id=v_uid or r.receiver_id=v_uid)
  ), ranked as (
    select p.user_id,p.display_name,
      coalesce(sum(s.score),0)::integer as points,
      count(s.id)::integer as plays,
      coalesce(sum(s.duration_seconds),0)::integer as seconds
    from circle c join public.examlab_beta_profiles p on p.user_id=c.user_id
    left join public.examlab_beta_sessions s on s.user_id=c.user_id
      and s.challenge_day>=v_month and s.submitted_at is not null
    group by p.user_id,p.display_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',r.display_name,'points',r.points,'plays',r.plays,'seconds',r.seconds,
    'me',r.user_id=v_uid) order by r.points desc,r.seconds asc,r.display_name),'[]'::jsonb)
    into v_monthly from ranked r;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'day',d.challenge_day,'status',d.status,
    'is_challenger',d.challenger_id=v_uid,
    'other_name',d.other_name,
    'mine',d.my_score,'theirs',d.other_score,
    'my_seconds',d.my_seconds,'their_seconds',d.other_seconds,
    'created_at',d.created_at) order by d.created_at desc),'[]'::jsonb)
    into v_duels
    from (
      select x.*,p.display_name as other_name,
        my.score as my_score,other_s.score as other_score,
        my.duration_seconds as my_seconds,other_s.duration_seconds as other_seconds
      from public.examlab_beta_duels x
      join public.examlab_beta_profiles p
        on p.user_id=(case when x.challenger_id=v_uid then x.opponent_id else x.challenger_id end)
      left join public.examlab_beta_sessions my on my.user_id=v_uid
        and my.challenge_day=x.challenge_day and my.submitted_at is not null
      left join public.examlab_beta_sessions other_s
        on other_s.user_id=(case when x.challenger_id=v_uid then x.opponent_id else x.challenger_id end)
        and other_s.challenge_day=x.challenge_day and other_s.submitted_at is not null
      where x.challenger_id=v_uid or x.opponent_id=v_uid
      order by x.created_at desc limit 25
    ) d;

  v_badges := jsonb_build_array(
    jsonb_build_object('icon','🌱','name','Khởi hành','detail','Hoàn thành lần thi đầu tiên','unlocked',v_total>=1),
    jsonb_build_object('icon','🔥','name','Bền chí','detail','Duy trì 3 ngày liên tiếp','unlocked',v_streak>=3),
    jsonb_build_object('icon','🏅','name','Chăm chỉ','detail','Hoàn thành 10 ngày thi đua','unlocked',v_total>=10),
    jsonb_build_object('icon','🎯','name','Chính xác','detail','Đạt 1.000 điểm trong một bài','unlocked',v_best>=1000),
    jsonb_build_object('icon','🌟','name','Tuần kiên trì','detail','Duy trì 7 ngày liên tiếp','unlocked',v_streak>=7)
  );

  return jsonb_build_object('joined',true,'stats',jsonb_build_object(
      'days',v_total,'points',v_points,'correct',v_correct,'possible',v_possible,
      'best',v_best,'streak',v_streak,'month_points',v_month_points),
    'history',v_history,'monthly',v_monthly,'duels',v_duels,'badges',v_badges,
    'server_day',v_today);
end $$;

revoke all on function public.examlab_beta_v2_duel_action(text,uuid,uuid),
  public.examlab_beta_v2_dashboard() from public, anon;
grant execute on function public.examlab_beta_v2_duel_action(text,uuid,uuid),
  public.examlab_beta_v2_dashboard() to authenticated;

commit;
