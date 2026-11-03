-- EXAMLAB FRIENDS & COMPETITION BETA (v1)
-- Chạy trong Supabase > SQL Editor, dùng DỰ ÁN SUPABASE CŨ.
-- Chỉ tạo bảng exβ riêng. Không sửa bảng bài thi chính hay auth.users.
-- Không chèn khóa bí mật vào mã GitHub.

create table if not exists public.examlab_beta_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  discoverable boolean not null default false,
  joined_at timestamptz not null default now()
);

create table if not exists public.examlab_beta_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (sender_id <> receiver_id)
);
create unique index if not exists ex_beta_unique_friend_pair
  on public.examlab_beta_requests (least(sender_id,receiver_id), greatest(sender_id,receiver_id));
create index if not exists ex_beta_receiver_idx on public.examlab_beta_requests (receiver_id,status);

create table if not exists public.examlab_beta_lookup_quota (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  used integer not null default 0
);

create table if not exists public.examlab_beta_questions (
  id integer primary key,
  subject text not null,
  prompt text not null,
  choice_a text not null,
  choice_b text not null,
  choice_c text not null,
  choice_d text not null,
  correct text not null check (correct in ('A','B','C','D'))
);

create table if not exists public.examlab_beta_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_day date not null,
  question_ids integer[] not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb,
  correct_count integer,
  score integer,
  duration_seconds integer,
  unique (user_id, challenge_day)
);
create index if not exists ex_beta_sessions_week_idx on public.examlab_beta_sessions(challenge_day, user_id);

-- Chỉ các RPC kiểm soát quyền được phép đọc/ghi bảng Beta.
alter table public.examlab_beta_profiles enable row level security;
alter table public.examlab_beta_requests enable row level security;
alter table public.examlab_beta_lookup_quota enable row level security;
alter table public.examlab_beta_questions enable row level security;
alter table public.examlab_beta_sessions enable row level security;
revoke all on public.examlab_beta_profiles, public.examlab_beta_requests,
  public.examlab_beta_lookup_quota, public.examlab_beta_questions,
  public.examlab_beta_sessions from anon, authenticated;

-- Câu hỏi tự biên soạn cho bản BETA, không lấy đáp án từ ExamLab chính.
insert into public.examlab_beta_questions
(id, subject, prompt, choice_a, choice_b, choice_c, choice_d, correct) values
  (1, 'Toán', 'Kết quả của 12 × 8 là bao nhiêu?', '86', '96', '108', '112', 'B'),
  (2, 'Toán', 'Nếu 3x + 5 = 20 thì x bằng bao nhiêu?', '3', '4', '5', '6', 'C'),
  (3, 'Toán', 'Số nào là số nguyên tố?', '21', '27', '29', '33', 'C'),
  (4, 'Toán', '25% của 240 bằng bao nhiêu?', '40', '50', '60', '80', 'C'),
  (5, 'Toán', 'Tổng các góc trong một tam giác bằng bao nhiêu độ?', '90', '120', '180', '360', 'C'),
  (6, 'Toán', 'Giá trị của √144 là bao nhiêu?', '11', '12', '13', '14', 'B'),
  (7, 'Toán', 'Một hình vuông có cạnh 7 cm, diện tích bằng bao nhiêu?', '14 cm²', '28 cm²', '49 cm²', '56 cm²', 'C'),
  (8, 'Toán', 'Tung một đồng xu công bằng, xác suất xuất hiện mặt ngửa là bao nhiêu?', '1/4', '1/2', '2/3', '1', 'B'),
  (9, 'Toán', 'Số tiếp theo của dãy 2, 4, 8, 16 là số nào?', '18', '24', '32', '64', 'C'),
  (10, 'Toán', 'Giá trị của 2⁵ là bao nhiêu?', '10', '16', '25', '32', 'D'),
  (11, 'Hóa học', 'Công thức hóa học của nước là gì?', 'H₂O', 'CO₂', 'O₂', 'NaCl', 'A'),
  (12, 'Hóa học', 'Kí hiệu hóa học của nguyên tố natri là gì?', 'N', 'Na', 'Ni', 'Ne', 'B'),
  (13, 'Hóa học', 'Dung dịch có pH = 7 ở 25°C thường được gọi là gì?', 'Axit', 'Bazơ', 'Trung tính', 'Chất oxi hóa', 'C'),
  (14, 'Hóa học', 'Khí nào cần thiết cho quá trình hô hấp hiếu khí ở người?', 'Nitơ', 'Oxi', 'Hiđro', 'Heli', 'B'),
  (15, 'Hóa học', 'Số proton của nguyên tử bằng đại lượng nào?', 'Số khối', 'Số hiệu nguyên tử', 'Số nơtron', 'Khối lượng mol', 'B'),
  (16, 'Hóa học', 'Chất nào sau đây là đơn chất?', 'Nước', 'Muối ăn', 'Khí oxi', 'Đường glucose', 'C'),
  (17, 'Hóa học', 'Công thức của carbon dioxide là gì?', 'CO', 'CO₂', 'CaO', 'H₂CO₃', 'B'),
  (18, 'Hóa học', 'Trong các kim loại sau, kim loại nào có kí hiệu Fe?', 'Đồng', 'Sắt', 'Nhôm', 'Kẽm', 'B'),
  (19, 'Sinh học', 'Đơn vị cấu tạo cơ bản của cơ thể sống là gì?', 'Mô', 'Tế bào', 'Cơ quan', 'Hệ cơ quan', 'B'),
  (20, 'Sinh học', 'Bào quan nào tham gia chủ yếu vào quá trình quang hợp ở thực vật?', 'Lục lạp', 'Ti thể', 'Ribosome', 'Bộ máy Golgi', 'A'),
  (21, 'Sinh học', 'ADN có các bazơ A, T, G và bazơ nào?', 'U', 'C', 'X', 'P', 'B'),
  (22, 'Sinh học', 'Cơ quan nào bơm máu trong hệ tuần hoàn của người?', 'Gan', 'Phổi', 'Tim', 'Thận', 'C'),
  (23, 'Vật lí', 'Đơn vị SI của lực là gì?', 'Joule', 'Newton', 'Watt', 'Pascal', 'B'),
  (24, 'Vật lí', 'Đơn vị SI của cường độ dòng điện là gì?', 'Volt', 'Ohm', 'Ampere', 'Coulomb', 'C'),
  (25, 'Vật lí', 'Một vật đi 100 m trong 20 s với tốc độ đều. Tốc độ là bao nhiêu?', '2 m/s', '4 m/s', '5 m/s', '10 m/s', 'C'),
  (26, 'Vật lí', 'Năng lượng trong hệ SI được đo bằng đơn vị nào?', 'Joule', 'Newton', 'Kelvin', 'Tesla', 'A'),
  (27, 'Vật lí', 'Ở điều kiện thông thường, ánh sáng truyền trong chân không với tốc độ xấp xỉ bao nhiêu?', '3×10⁶ m/s', '3×10⁸ m/s', '3×10¹⁰ m/s', '300 m/s', 'B'),
  (28, 'Sinh học', 'Trong mã di truyền, bộ ba mở đầu thường là gì?', 'UAA', 'AUG', 'UGA', 'UAG', 'B'),
  (29, 'Hóa học', 'Hạt mang điện tích âm trong nguyên tử là hạt nào?', 'Proton', 'Nơtron', 'Electron', 'Hạt nhân', 'C'),
  (30, 'Toán', 'Trung bình cộng của 4, 6 và 8 là bao nhiêu?', '5', '6', '7', '8', 'B')
on conflict (id) do nothing;

-- Tất cả hàm SECURITY DEFINER đặt search_path rỗng, tự kiểm tra auth.uid().
create or replace function public.examlab_beta_register(p_name text, p_discoverable boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_email_confirmed timestamptz; v_name text;
begin
  if v_uid is null then raise exception 'Cần đăng nhập tài khoản ExamLab.'; end if;
  select email_confirmed_at into v_email_confirmed from auth.users where id=v_uid;
  if v_email_confirmed is null then raise exception 'Cần xác nhận email trước khi dùng Beta.'; end if;
  v_name := btrim(coalesce(p_name,''));
  if char_length(v_name) < 2 or char_length(v_name)>40 then raise exception 'Tên hiển thị phải có 2–40 ký tự.'; end if;
  insert into public.examlab_beta_profiles(user_id,display_name,discoverable)
  values(v_uid,v_name,coalesce(p_discoverable,false))
  on conflict (user_id) do update set display_name=excluded.display_name,
  discoverable=excluded.discoverable;
  return jsonb_build_object('name',v_name,'discoverable',coalesce(p_discoverable,false));
end $$;

create or replace function public.examlab_beta_find_friend(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_email text := lower(btrim(coalesce(p_email,'')));
  v_quota public.examlab_beta_lookup_quota%rowtype;
  v_target uuid; v_name text; v_status text;
begin
  if v_uid is null then raise exception 'Cần đăng nhập.'; end if;
  if not exists (select 1 from public.examlab_beta_profiles where user_id=v_uid) then
    raise exception 'Hãy tạo hồ sơ Beta trước khi tìm bạn.';
  end if;
  if length(v_email)>254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then raise exception 'Email không hợp lệ.'; end if;
  -- Giới hạn 12 tra cứu/giờ/người để giảm việc dò danh sách email.
  insert into public.examlab_beta_lookup_quota(user_id,window_start,used)
    values(v_uid,now(),0) on conflict (user_id) do nothing;
  select * into v_quota from public.examlab_beta_lookup_quota where user_id=v_uid for update;
  if v_quota.window_start < now()-interval '1 hour' then
    update public.examlab_beta_lookup_quota set window_start=now(), used=1 where user_id=v_uid;
  elsif v_quota.used >= 12 then
    raise exception 'Đã hết lượt tìm trong giờ. Thử lại sau.';
  else
    update public.examlab_beta_lookup_quota set used=used+1 where user_id=v_uid;
  end if;
  select u.id,p.display_name into v_target,v_name
    from auth.users u join public.examlab_beta_profiles p on p.user_id=u.id
    where lower(u.email)=v_email and u.email_confirmed_at is not null
      and p.discoverable=true and u.id<>v_uid limit 1;
  if v_target is null then return jsonb_build_object('found',false); end if;
  select case when r.status='accepted' then 'friend'
        when r.sender_id=v_uid then 'sent' else 'received' end
    into v_status from public.examlab_beta_requests r
    where (r.sender_id=v_uid and r.receiver_id=v_target)
       or (r.receiver_id=v_uid and r.sender_id=v_target);
  return jsonb_build_object('found',true,'user_id',v_target,
    'name',v_name,'relationship',coalesce(v_status,'none'));
end $$;

create or replace function public.examlab_beta_send_invite(p_recipient uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_existing public.examlab_beta_requests%rowtype;
begin
  if v_uid is null then raise exception 'Cần đăng nhập.'; end if;
  if p_recipient is null or p_recipient=v_uid then raise exception 'Không thể kết bạn với chính mình.'; end if;
  if not exists (select 1 from public.examlab_beta_profiles where user_id=v_uid) then
    raise exception 'Hãy tạo hồ sơ Beta trước.'; end if;
  if not exists (select 1 from public.examlab_beta_profiles where user_id=p_recipient and discoverable=true) then
    raise exception 'Không tìm thấy người dùng hoặc họ đã tắt tìm kiếm.'; end if;
  if (select count(*) from public.examlab_beta_requests where sender_id=v_uid and status='pending') >= 20 then
    raise exception 'Bạn có quá nhiều lời mời chưa được phản hồi.'; end if;
  select * into v_existing from public.examlab_beta_requests
    where (sender_id=v_uid and receiver_id=p_recipient)
       or (sender_id=p_recipient and receiver_id=v_uid);
  if found then
    if v_existing.status='accepted' then return 'already_friends'; end if;
    if v_existing.receiver_id=v_uid then
      update public.examlab_beta_requests set status='accepted', accepted_at=now()
        where id=v_existing.id;
      return 'accepted';
    end if;
    return 'pending';
  end if;
  insert into public.examlab_beta_requests(sender_id,receiver_id) values(v_uid,p_recipient)
  on conflict do nothing;
  return 'sent';
end $$;

create or replace function public.examlab_beta_friend_action(p_request_id uuid,p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_request public.examlab_beta_requests%rowtype;
begin
  if v_uid is null then raise exception 'Cần đăng nhập.'; end if;
  select * into v_request from public.examlab_beta_requests where id=p_request_id for update;
  if not found then raise exception 'Lời mời không còn tồn tại.'; end if;
  if p_action='accept' and v_request.receiver_id=v_uid and v_request.status='pending' then
    update public.examlab_beta_requests set status='accepted',accepted_at=now() where id=p_request_id;
    return 'accepted';
  elsif p_action='decline' and v_request.receiver_id=v_uid and v_request.status='pending' then
    delete from public.examlab_beta_requests where id=p_request_id; return 'declined';
  elsif p_action='cancel' and v_request.sender_id=v_uid and v_request.status='pending' then
    delete from public.examlab_beta_requests where id=p_request_id; return 'cancelled';
  elsif p_action='remove' and v_request.status='accepted'
    and (v_request.sender_id=v_uid or v_request.receiver_id=v_uid) then
    delete from public.examlab_beta_requests where id=p_request_id; return 'removed';
  end if;
  raise exception 'Không có quyền thực hiện thao tác này.';
end $$;

create or replace function public.examlab_beta_overview()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_profile public.examlab_beta_profiles%rowtype;
  v_friends jsonb; v_incoming jsonb; v_outgoing jsonb; v_board jsonb;
  v_week date:=date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if v_uid is null then raise exception 'Cần đăng nhập.'; end if;
  select * into v_profile from public.examlab_beta_profiles where user_id=v_uid;
  if not found then
    return jsonb_build_object('joined',false,'friends','[]'::jsonb,
      'incoming','[]'::jsonb,'outgoing','[]'::jsonb,'leaderboard','[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,
      'user_id',p.user_id,'name',p.display_name) order by p.display_name),'[]'::jsonb)
    into v_friends
    from public.examlab_beta_requests r
    join public.examlab_beta_profiles p on p.user_id=case when r.sender_id=v_uid then r.receiver_id else r.sender_id end
    where r.status='accepted' and (r.sender_id=v_uid or r.receiver_id=v_uid);
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',p.display_name,'created_at',r.created_at)
    order by r.created_at desc),'[]'::jsonb) into v_incoming
    from public.examlab_beta_requests r join public.examlab_beta_profiles p on p.user_id=r.sender_id
    where r.receiver_id=v_uid and r.status='pending';
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',p.display_name,'created_at',r.created_at)
    order by r.created_at desc),'[]'::jsonb) into v_outgoing
    from public.examlab_beta_requests r join public.examlab_beta_profiles p on p.user_id=r.receiver_id
    where r.sender_id=v_uid and r.status='pending';
  with participants as (
    select v_uid as user_id
    union
    select case when r.sender_id=v_uid then r.receiver_id else r.sender_id end
      from public.examlab_beta_requests r
      where r.status='accepted' and (r.sender_id=v_uid or r.receiver_id=v_uid)
  ), totals as (
    select pa.user_id,p.display_name,coalesce(sum(s.score),0)::integer as points,
      count(s.id)::integer as plays,coalesce(sum(s.duration_seconds),0)::integer as seconds
      from participants pa join public.examlab_beta_profiles p on p.user_id=pa.user_id
      left join public.examlab_beta_sessions s on s.user_id=pa.user_id
        and s.challenge_day >= v_week and s.submitted_at is not null
      group by pa.user_id,p.display_name
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id',b.user_id,'name',b.display_name,
     'points',b.points,'plays',b.plays,'seconds',b.seconds,'me',b.user_id=v_uid)
     order by b.points desc,b.seconds asc,b.display_name),'[]'::jsonb)
     into v_board from totals b;
  return jsonb_build_object('joined',true,'name',v_profile.display_name,
    'discoverable',v_profile.discoverable,'friends',v_friends,
    'incoming',v_incoming,'outgoing',v_outgoing,'leaderboard',v_board,
    'week_start',v_week);
end $$;

create or replace function public.examlab_beta_daily()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid();
  v_day date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_session public.examlab_beta_sessions%rowtype; v_questions jsonb; v_ids integer[];
  v_remaining integer;
begin
  if v_uid is null then raise exception 'Cần đăng nhập.'; end if;
  if not exists (select 1 from public.examlab_beta_profiles where user_id=v_uid)
    then raise exception 'Hãy tạo hồ sơ Beta trước.'; end if;
  select array_agg(id order by md5(id::text||':'||v_day::text)) into v_ids
    from (select id from public.examlab_beta_questions
      order by md5(id::text||':'||v_day::text) limit 10) chosen;
  if cardinality(v_ids)<>10 then raise exception 'Bộ câu hỏi Beta chưa được cài đặt đủ.'; end if;
  insert into public.examlab_beta_sessions(user_id,challenge_day,question_ids)
    values(v_uid,v_day,v_ids)
    on conflict (user_id,challenge_day) do nothing;
  select * into v_session from public.examlab_beta_sessions
    where user_id=v_uid and challenge_day=v_day;
  if v_session.submitted_at is not null then
    return jsonb_build_object('status','done','day',v_day,'score',v_session.score,
      'correct',v_session.correct_count,'seconds',v_session.duration_seconds);
  end if;
  v_remaining:=greatest(0,600-floor(extract(epoch from now()-v_session.started_at))::integer);
  if v_remaining=0 then
    return jsonb_build_object('status','expired','day',v_day);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'subject',q.subject,
       'prompt',q.prompt,'options',jsonb_build_array(q.choice_a,q.choice_b,q.choice_c,q.choice_d))
       order by u.ord),'[]'::jsonb) into v_questions
    from unnest(v_session.question_ids) with ordinality as u(qid,ord)
    join public.examlab_beta_questions q on q.id=u.qid;
  return jsonb_build_object('status','ready','day',v_day,'id',v_session.id,
    'seconds_left',v_remaining,'questions',v_questions);
end $$;

create or replace function public.examlab_beta_submit(p_session_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid();v_s public.examlab_beta_sessions%rowtype;
  v_correct integer; v_seconds integer;
begin
  if v_uid is null then raise exception 'Cần đăng nhập.'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' then
    raise exception 'Dữ liệu đáp án không hợp lệ.'; end if;
  if length(p_answers::text)>1000 or (select count(*) from jsonb_object_keys(p_answers))>10 then
    raise exception 'Có quá nhiều dữ liệu đáp án.'; end if;
  select * into v_s from public.examlab_beta_sessions
    where id=p_session_id and user_id=v_uid for update;
  if not found then raise exception 'Không tìm thấy lượt thi của bạn.'; end if;
  if v_s.submitted_at is not null then raise exception 'Bạn đã nộp bài hôm nay.'; end if;
  if now()>v_s.started_at+interval '10 minutes' then raise exception 'Đã hết 10 phút; lượt thi hôm nay đã kết thúc.'; end if;
  select count(*)::integer into v_correct
    from public.examlab_beta_questions q where q.id=any(v_s.question_ids)
      and upper(coalesce(p_answers->>q.id::text,''))=q.correct;
  v_seconds:=greatest(1,ceil(extract(epoch from now()-v_s.started_at))::integer);
  update public.examlab_beta_sessions set submitted_at=now(),answers=p_answers,
    correct_count=v_correct,score=v_correct*100,duration_seconds=v_seconds
    where id=p_session_id;
  return jsonb_build_object('status','done','correct',v_correct,'total',cardinality(v_s.question_ids),
    'score',v_correct*100,'seconds',v_seconds);
end $$;

revoke all on function public.examlab_beta_register(text,boolean),
  public.examlab_beta_find_friend(text), public.examlab_beta_send_invite(uuid),
  public.examlab_beta_friend_action(uuid,text),public.examlab_beta_overview(),
  public.examlab_beta_daily(),public.examlab_beta_submit(uuid,jsonb) from public, anon;
grant execute on function public.examlab_beta_register(text,boolean),
  public.examlab_beta_find_friend(text), public.examlab_beta_send_invite(uuid),
  public.examlab_beta_friend_action(uuid,text),public.examlab_beta_overview(),
  public.examlab_beta_daily(),public.examlab_beta_submit(uuid,jsonb) to authenticated;

-- Bản Beta hoạt động độc lập: không chỉnh sửa public.examlab_attempts, decks, roles.
